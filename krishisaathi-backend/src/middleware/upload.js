const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const ApiError = require('../utils/ApiError');

const upload_root = path.join(__dirname, '..', '..', 'uploads', 'disease');

fs.mkdirSync(upload_root, { recursive: true });

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    cb(null, upload_root);
  },
  filename(_req, file, cb) {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg';
    cb(null, `${uuidv4()}${ext}`);
  },
});

function fileFilter(_req, file, cb) {
  const allowed = ['image/jpeg', 'image/png', 'image/webp'];

  if (!allowed.includes(file.mimetype)) {
    cb(ApiError.badRequest('Only JPEG, PNG, or WebP images are allowed'));
    return;
  }

  cb(null, true);
}

const diseaseUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

module.exports = {
  diseaseUpload,
  upload_root,
};
