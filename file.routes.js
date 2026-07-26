const express = require('express');
const requireAuth = require('../middleware/auth.middleware');
const { simpleUpload, chunkUpload } = require('../middleware/upload.middleware');
const controller = require('../controllers/file.controller');

const router = express.Router();

// Every route below requires a valid access token EXCEPT the public share
// download, which is registered separately in app.js under /share/:token.
router.use(requireAuth);

// Simple upload (small/medium files)
router.post('/upload', simpleUpload, controller.uploadFile);

// Chunked / resumable upload
router.post('/upload/init', controller.initChunkedUpload);
router.post('/upload/chunk/:uploadId', chunkUpload, controller.uploadChunk);
router.get('/upload/status/:uploadId', controller.getUploadStatus);
router.post('/upload/complete/:uploadId', controller.completeChunkedUpload);

router.get('/', controller.listFiles);
router.get('/:id/download', controller.downloadFile);
router.delete('/:id', controller.deleteFile);

router.post('/:id/share', controller.createShareLink);
router.delete('/:id/share', controller.revokeShareLink);

module.exports = router;
