import authMiddleware from "./auth.middleware";
import { avatarUpload } from "./avatar-upload.middleware";
import errorHandler from "./error.middleware";
import { versionGuard, defaultVersionRedirect } from "./version.middleware";

export { authMiddleware, avatarUpload, errorHandler, versionGuard, defaultVersionRedirect };
