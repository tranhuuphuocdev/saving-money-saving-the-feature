import multer from "multer";

const avatarUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024,
    },
    fileFilter: (_req, file, callback) => {
        if (!["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) {
            callback(new Error("Only JPG, PNG, or WebP images are supported."));
            return;
        }

        callback(null, true);
    },
});

export { avatarUpload };