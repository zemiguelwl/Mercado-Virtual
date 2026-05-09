const multer = require("multer");
const path = require("path");

function createStorage(folder) {
  return multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, path.join("public", "uploads", folder)),
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, "_")}`)
  });
}

const imageFilter = (_req, file, cb) => {
  const allowedMimeTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
  if (allowedMimeTypes.includes(file.mimetype)) return cb(null, true);
  return cb(new Error("Formato inválido. Apenas jpg, jpeg, png e webp são permitidos."));
};

const baseConfig = {
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: imageFilter
};

const uploadProduct = multer({ storage: createStorage("products"), ...baseConfig });
const uploadSupermarket = multer({ storage: createStorage("supermarkets"), ...baseConfig });

module.exports = { uploadProduct, uploadSupermarket };
