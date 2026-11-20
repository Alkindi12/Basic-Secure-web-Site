'use strict';
/**
 * Image upload pipeline v2 (finding S-03).
 *
 *   1. The upload arrives in memory (multer.memoryStorage): nothing touches the disk yet.
 *   2. The real type is checked from the bytes (detectImageType, written from scratch).
 *   3. The image is decoded and RE-ENCODED with sharp. This throws away anything hidden
 *      in the file (polyglots, scripts) and strips EXIF metadata such as GPS location.
 *   4. The server chooses the name (crypto.randomUUID) AND the extension (.webp).
 *   5. Only the file name is stored in the database, never a path.
 *   6. Files live in a private folder and are served by a validated route (routes/images.js).
 *
 * Storage is behind this small interface (save / remove / pathFor), so it could later
 * be swapped for S3/MinIO without touching the controllers.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { detectImageType } = require('../security/imageType');
const { HttpError } = require('../utils/httpError');

const NAME_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$/;

function createImageService(storageDir) {
  fs.mkdirSync(storageDir, { recursive: true });

  async function save(file) {
    if (!file || !file.buffer) throw new HttpError(400, 'An image is required', { image: 'An image is required' });
    if (!detectImageType(file.buffer)) {
      throw new HttpError(400, 'Only JPEG, PNG or WebP images are allowed',
        { image: 'Only JPEG, PNG or WebP images are allowed' });
    }
    let clean;
    try {
      clean = await sharp(file.buffer, { limitInputPixels: 40_000_000, failOn: 'error' }) // blocks "pixel bombs"
        .rotate()                                           // apply EXIF orientation first …
        .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82 })                              // … then write WITHOUT metadata
        .toBuffer();
    } catch {
      throw new HttpError(400, 'The image could not be processed', { image: 'The image file is damaged or not supported' });
    }
    const name = `${crypto.randomUUID()}.webp`;
    await fs.promises.writeFile(path.join(storageDir, name), clean, { flag: 'wx' }); // never overwrite
    return name;
  }

  async function remove(name) {
    if (!name || !NAME_RE.test(name)) return;
    await fs.promises.rm(path.join(storageDir, name), { force: true });
  }

  /** Absolute path for a stored image, or null when the name is not one we generated. */
  function pathFor(name) {
    return NAME_RE.test(name) ? path.join(storageDir, name) : null;
  }

  return { save, remove, pathFor, NAME_RE, storageDir };
}

module.exports = { createImageService };
