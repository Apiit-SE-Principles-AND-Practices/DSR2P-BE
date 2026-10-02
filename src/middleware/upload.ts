import multer from "multer";

// Memory storage: the buffer goes straight into sharp/S3, nothing touches disk.
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES },
  fileFilter: (_req, file, cb) => {
    cb(null, file.mimetype.startsWith("image/"));
  },
}).single("image");
