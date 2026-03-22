import express, { Request, Response } from "express";
import v1Routes from "./v1";

const router = express.Router();

// API Versioning
router.use("/v1", v1Routes);

// Health check (no version)
router.get("/health", (req: Request, res: Response) => {
    res.json({
        success: true,
        message: "Server is running.",
        version: "1.0.0",
    });
});

export default router;
