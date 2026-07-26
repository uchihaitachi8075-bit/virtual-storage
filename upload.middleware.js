// Multer handles reading "multipart/form-data" requests (i.e. file uploads)
// and writing the uploaded bytes to a temp folder on disk WITHOUT loading
// the whole file into memory — this is what lets us handle large files.

const multer = require('multer');
const os = require('os');

// diskStorage streams straight to disk. destination = OS temp folder;
// our storage.service then moves the finished file into its permanent home.
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, os.tmpdir()),
  filename: (req, file, cb) => cb(null, `upload-${Date.now()}-${Math.round(Math.random() * 1e9)}`),
});

// Used for a normal, single-request upload (small/medium files).
const simpleUpload = multer({ storage }).single('file');

// Used for one chunk at a time in the chunked/resumable upload flow.
const chunkUpload = multer({ storage }).single('chunk');

module.exports = { simpleUpload, chunkUpload };
