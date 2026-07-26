// ============================================================================
// STORAGE SERVICE
// ============================================================================
// This is the ONLY file that knows files live on local disk. Every other
// part of the app (controllers, routes) calls these functions by name
// (saveFinalFile, readFileStream, deleteFile, ...) without knowing HOW the
// bytes are actually stored.
//
// When you're ready to move to S3-compatible storage (MinIO / Backblaze B2),
// you create a new file like `storage.service.s3.js` that exports the SAME
// function names but uses the AWS SDK internally, then swap the require()
// in the controllers. Nothing else in the app has to change.
// ============================================================================

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const env = require('../config/env');

// Make sure the storage folders exist when the app boots.
async function ensureStorageDirs() {
  await fsp.mkdir(env.storage.root, { recursive: true });
  await fsp.mkdir(env.storage.chunksRoot, { recursive: true });
}

// Generates a unique on-disk filename so two users uploading "photo.jpg"
// never collide. The original name the user typed is kept separately in
// the database (files.original_name).
function generateStorageFilename(originalName) {
  const ext = path.extname(originalName);
  return `${uuidv4()}${ext}`;
}

function resolveFinalPath(storageFilename) {
  return path.join(env.storage.root, storageFilename);
}

function resolveChunkDir(uploadId) {
  return path.join(env.storage.chunksRoot, uploadId);
}

// Used for a simple, non-chunked upload (multer already wrote the temp file
// to disk for us) — we just move it into its permanent home.
async function saveFinalFile(tempFilePath, originalName) {
  await ensureStorageDirs();
  const storageFilename = generateStorageFilename(originalName);
  const finalPath = resolveFinalPath(storageFilename);
  await fsp.rename(tempFilePath, finalPath);
  return { storageFilename, storagePath: finalPath };
}

// --- Chunked / resumable upload support -----------------------------------

async function initChunkUpload() {
  const uploadId = uuidv4();
  await fsp.mkdir(resolveChunkDir(uploadId), { recursive: true });
  return uploadId;
}

async function saveChunk(uploadId, chunkIndex, tempChunkPath) {
  const chunkDir = resolveChunkDir(uploadId);
  await fsp.mkdir(chunkDir, { recursive: true });
  const chunkPath = path.join(chunkDir, String(chunkIndex).padStart(6, '0'));
  await fsp.rename(tempChunkPath, chunkPath);
}

// Reads every saved chunk in order and writes them one after another into
// the final file. This is what makes the upload "resumable": if the
// connection drops, only the missing chunks need to be re-sent, because
// the ones already saved stay on disk under storage/chunks/<uploadId>/.
async function completeChunkUpload(uploadId, totalChunks, originalName) {
  await ensureStorageDirs();
  const chunkDir = resolveChunkDir(uploadId);

  const storageFilename = generateStorageFilename(originalName);
  const finalPath = resolveFinalPath(storageFilename);
  const writeStream = fs.createWriteStream(finalPath);

  let totalSize = 0;
  for (let i = 0; i < totalChunks; i++) {
    const chunkPath = path.join(chunkDir, String(i).padStart(6, '0'));
    const chunkBuffer = await fsp.readFile(chunkPath);
    totalSize += chunkBuffer.length;
    await new Promise((resolve, reject) => {
      writeStream.write(chunkBuffer, (err) => (err ? reject(err) : resolve()));
    });
  }
  await new Promise((resolve) => writeStream.end(resolve));

  // Clean up the temporary chunk files now that they're merged.
  await fsp.rm(chunkDir, { recursive: true, force: true });

  return { storageFilename, storagePath: finalPath, size: totalSize };
}

// Returns which chunk indexes have already been uploaded for a given
// uploadId, so the client can resume an interrupted upload by only sending
// the missing ones.
async function getUploadedChunkIndexes(uploadId) {
  const chunkDir = resolveChunkDir(uploadId);
  try {
    const files = await fsp.readdir(chunkDir);
    return files.map((name) => Number(name));
  } catch {
    return [];
  }
}

// --- Reading / deleting -----------------------------------------------------

function readFileStream(storagePath) {
  return fs.createReadStream(storagePath);
}

async function deleteFile(storagePath) {
  await fsp.rm(storagePath, { force: true });
}

module.exports = {
  ensureStorageDirs,
  saveFinalFile,
  initChunkUpload,
  saveChunk,
  completeChunkUpload,
  getUploadedChunkIndexes,
  readFileStream,
  deleteFile,
};
