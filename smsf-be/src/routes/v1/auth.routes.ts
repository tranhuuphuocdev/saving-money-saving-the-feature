import express from "express";
import {
	getProfile,
	login,
	logout,
	refreshToken,
} from "../../controllers/auth.controller";
import { authMiddleware } from "../../middlewares";

const router = express.Router();

// Public routes
router.post("/login", login);
router.post("/refresh", refreshToken);

// Protected routes
router.get("/profile", authMiddleware, getProfile);
router.post("/logout", authMiddleware, logout);

export default router;
