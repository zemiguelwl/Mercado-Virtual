const multer = require("multer");
const path = require("path");

const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

function safeName(originalname) {
  const ext = path.extname(originalname).toLowerCase();
  const base = path.basename(originalname, ext).replace(/[^a-zA-Z0-9_\-]/g, "_").slice(0, 80);
  return `${Date.now()}-${base}${ext}`;
}

function createStorage(folder) {
  return multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, path.join("public", "uploads", folder)),
    filename: (_req, file, cb) => cb(null, safeName(file.originalname))
  });
}

const imageFilter = (_req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_MIME_TYPES.has(file.mimetype) || !ALLOWED_EXTENSIONS.has(ext)) {
    return cb(new Error("Formato inválido. Apenas jpg, jpeg, png e webp são permitidos."));
  }
  return cb(null, true);
};

const baseConfig = {
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: imageFilter
};

const uploadProduct = multer({ storage: createStorage("products"), ...baseConfig });
const uploadSupermarket = multer({ storage: createStorage("supermarkets"), ...baseConfig });

module.exports = { uploadProduct, uploadSupermarket };
