import express from "express";
import rateLimit from "express-rate-limit";
import {
	getProfile,
	login,
	loginWithGoogle,
	logout,
	register,
	refreshToken,
	updateProfile,
} from "../../controllers/auth.controller";
import { authMiddleware } from "../../middlewares";

const router = express.Router();

const authLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: 60,
	standardHeaders: true,
	legacyHeaders: false,
	message: {
		success: false,
		message: "Too many authentication requests. Please try again later.",
	},
});

// Public routes
router.post("/login", authLimiter, login);
router.post("/google", authLimiter, loginWithGoogle);
router.post("/register", authLimiter, register);
router.post("/refresh", authLimiter, refreshToken);

// Protected routes
router.get("/profile", authMiddleware, getProfile);
router.patch("/profile", authMiddleware, updateProfile);
router.post("/logout", authLimiter, authMiddleware, logout);

export default router;
