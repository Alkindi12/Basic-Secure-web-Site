'use strict';
/**
 * Detects the REAL type of an uploaded file from its first bytes ("magic bytes"),
 * written from scratch (finding S-03). The file name and the MIME type sent by the
 * browser are chosen by the client, so they are never trusted.
 */
const PNG = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

function detectImageType(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return null;
  if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return 'jpeg';
  if (buf.subarray(0, 8).equals(PNG)) return 'png';
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return null; // everything else (SVG, HTML, GIF, scripts, …) is rejected
}

module.exports = { detectImageType };
