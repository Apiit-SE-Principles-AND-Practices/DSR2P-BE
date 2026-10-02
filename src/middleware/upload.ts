import multer from "multer";

// Memory storage: the buffer goes straight into sharp/S3, nothing touches disk.
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGES_PER_REVIEW = 5;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES },
  fileFilter: (_req, file, cb) => {
    cb(null, file.mimetype.startsWith("image/"));
  },
});

export const uploadImage = upload.single("image");
export const uploadImages = upload.array("images", MAX_IMAGES_PER_REVIEW);
