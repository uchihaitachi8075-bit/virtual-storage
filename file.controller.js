const path = require('path');
const crypto = require('crypto');
const fsp = require('fs/promises');

const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const fileModel = require('../models/file.model');
const userModel = require('../models/user.model');
const storageService = require('../services/storage.service');

// Checks the user's quota BEFORE we commit the upload to the database.
// (The bytes may already be on disk by this point for simple uploads — in a
// production system you'd also want a periodic cleanup job for orphaned
// files that fail this check, but that's beyond this beginner scope.)
async function assertHasQuota(userId, incomingBytes) {
  const user = await userModel.findById(userId);
  const remaining = Number(user.storage_limit) - Number(user.storage_used);
  if (incomingBytes > remaining) {
    throw new ApiError(413, 'Not enough storage remaining for this upload');
  }
}

// ---------------------------------------------------------------------------
// SIMPLE (non-chunked) UPLOAD — good for small/medium files.
// multer (see upload.middleware.js) has already streamed the file to a temp
// path on disk before this handler runs; req.file.path points to it.
// ---------------------------------------------------------------------------
const uploadFile = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ApiError(400, 'No file was uploaded (expected field name "file")');
  }

  await assertHasQuota(req.userId, req.file.size);

  const { storageFilename, storagePath } = await storageService.saveFinalFile(
    req.file.path,
    req.file.originalname
  );

  const folderPath = req.body.folderPath || '/';

  const fileRecord = await fileModel.createFile({
    userId: req.userId,
    filename: storageFilename,
    originalName: req.file.originalname,
    folderPath,
    size: req.file.size,
    mimeType: req.file.mimetype,
    storagePath,
  });

  await userModel.incrementStorageUsed(req.userId, req.file.size);

  res.status(201).json({ success: true, file: fileRecord });
});

// ---------------------------------------------------------------------------
// CHUNKED / RESUMABLE UPLOAD
// Flow for the client:
//   1. POST /files/upload/init                -> { uploadId }
//   2. POST /files/upload/chunk/:uploadId      (repeat per chunk, field "chunk",
//                                                body: chunkIndex, totalChunks)
//   3. POST /files/upload/complete/:uploadId   (body: originalName, totalChunks,
//                                                mimeType, folderPath)
// If the connection drops mid-way, the client can call
// GET /files/upload/status/:uploadId to see which chunk indexes already
// made it to disk, then resume from there instead of starting over.
// ---------------------------------------------------------------------------

const initChunkedUpload = asyncHandler(async (req, res) => {
  const uploadId = await storageService.initChunkUpload();
  res.status(201).json({ success: true, uploadId });
});

const uploadChunk = asyncHandler(async (req, res) => {
  const { uploadId } = req.params;
  const { chunkIndex } = req.body;

  if (!req.file) {
    throw new ApiError(400, 'No chunk was uploaded (expected field name "chunk")');
  }
  if (chunkIndex === undefined) {
    throw new ApiError(400, 'chunkIndex is required');
  }

  await storageService.saveChunk(uploadId, Number(chunkIndex), req.file.path);
  res.json({ success: true, chunkIndex: Number(chunkIndex) });
});

const getUploadStatus = asyncHandler(async (req, res) => {
  const { uploadId } = req.params;
  const uploadedChunkIndexes = await storageService.getUploadedChunkIndexes(uploadId);
  res.json({ success: true, uploadedChunkIndexes });
});

const completeChunkedUpload = asyncHandler(async (req, res) => {
  const { uploadId } = req.params;
  const { originalName, totalChunks, mimeType, folderPath } = req.body;

  if (!originalName || !totalChunks) {
    throw new ApiError(400, 'originalName and totalChunks are required');
  }

  const { storageFilename, storagePath, size } = await storageService.completeChunkUpload(
    uploadId,
    Number(totalChunks),
    originalName
  );

  await assertHasQuota(req.userId, size);

  const fileRecord = await fileModel.createFile({
    userId: req.userId,
    filename: storageFilename,
    originalName,
    folderPath: folderPath || '/',
    size,
    mimeType: mimeType || 'application/octet-stream',
    storagePath,
  });

  await userModel.incrementStorageUsed(req.userId, size);

  res.status(201).json({ success: true, file: fileRecord });
});

// ---------------------------------------------------------------------------
// LIST / DOWNLOAD / DELETE / SHARE
// ---------------------------------------------------------------------------

const listFiles = asyncHandler(async (req, res) => {
  const folderPath = req.query.folderPath; // optional filter, e.g. /photos
  const files = await fileModel.listFilesForUser(req.userId, folderPath);
  res.json({ success: true, files });
});

async function assertOwnership(fileId, userId) {
  const file = await fileModel.findById(fileId);
  if (!file) throw new ApiError(404, 'File not found');
  if (file.user_id !== Number(userId)) throw new ApiError(403, 'You do not own this file');
  return file;
}

const downloadFile = asyncHandler(async (req, res) => {
  const file = await assertOwnership(req.params.id, req.userId);

  res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${encodeURIComponent(file.original_name)}"`
  );

  const stream = storageService.readFileStream(file.storage_path);
  stream.on('error', () => {
    if (!res.headersSent) {
      res.status(404).json({ success: false, error: 'File missing from disk' });
    }
  });
  stream.pipe(res);
});

const deleteFile = asyncHandler(async (req, res) => {
  const file = await assertOwnership(req.params.id, req.userId);

  await storageService.deleteFile(file.storage_path);
  await fileModel.deleteById(file.id);
  await userModel.incrementStorageUsed(req.userId, -Number(file.size));

  res.json({ success: true, message: 'File deleted' });
});

// Generates a random, hard-to-guess token and stores it on the file row.
// Anyone with the resulting link can download the file WITHOUT logging in —
// that's the point of a "shareable link". Treat this token like a password;
// revoke it (see revokeShareLink) if it leaks.
const createShareLink = asyncHandler(async (req, res) => {
  const file = await assertOwnership(req.params.id, req.userId);
  const token = crypto.randomBytes(24).toString('hex');
  await fileModel.setShareToken(file.id, token);
  res.json({ success: true, shareUrl: `/share/${token}` });
});

const revokeShareLink = asyncHandler(async (req, res) => {
  const file = await assertOwnership(req.params.id, req.userId);
  await fileModel.setShareToken(file.id, null);
  res.json({ success: true, message: 'Share link revoked' });
});

// Public route — deliberately has NO auth middleware. Anyone with the token
// can hit this.
const downloadSharedFile = asyncHandler(async (req, res) => {
  const file = await fileModel.findByShareToken(req.params.token);
  if (!file) throw new ApiError(404, 'This share link is invalid or was revoked');

  res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${encodeURIComponent(file.original_name)}"`
  );
  storageService.readFileStream(file.storage_path).pipe(res);
});

module.exports = {
  uploadFile,
  initChunkedUpload,
  uploadChunk,
  getUploadStatus,
  completeChunkedUpload,
  listFiles,
  downloadFile,
  deleteFile,
  createShareLink,
  revokeShareLink,
  downloadSharedFile,
};
