import express from "express";
import {
	getProfile,
	login,
	logout,
	register,
	refreshToken,
	updateProfile,
} from "../../controllers/auth.controller";
import { authMiddleware } from "../../middlewares";

const router = express.Router();

// Public routes
router.post("/login", login);
router.post("/register", register);
router.post("/refresh", refreshToken);

// Protected routes
router.get("/profile", authMiddleware, getProfile);
router.patch("/profile", authMiddleware, updateProfile);
router.post("/logout", authMiddleware, logout);

export default router;
