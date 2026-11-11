const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { env } = require('../config/env');
const { ApiError } = require('../utils/http');

const dir = path.resolve(__dirname, '../../', env.upload.dir);
fs.mkdirSync(dir, { recursive: true });

const MIME = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' };

const storage = multer.diskStorage({
  destination: dir,
  // nom aléatoire + extension imposée par le type MIME (jamais celle du client)
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${MIME[file.mimetype]}`),
});

const imageUpload = multer({
  storage,
  limits: { fileSize: env.upload.maxMb * 1024 * 1024, files: 8 },
  fileFilter: (_req, file, cb) => (MIME[file.mimetype] ? cb(null, true) : cb(new ApiError(415, 'Format non supporté (JPG, PNG, WEBP, GIF uniquement)'))),
});

module.exports = { imageUpload, uploadDir: dir };
