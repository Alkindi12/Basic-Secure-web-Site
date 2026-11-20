'use strict';
/**
 * Receives the upload IN MEMORY with strict limits. Nothing is written to disk
 * until imageService has verified and re-encoded the image (finding S-03).
 */
const multer = require('multer');

module.exports = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
    files: 1,
    fields: 10,
    parts: 12,
    fieldSize: 10 * 1024,
  },
});
