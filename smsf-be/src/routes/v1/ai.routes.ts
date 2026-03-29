import express from "express";
import {
    analyzeReceiptImage,
    analyzeTransactionText,
} from "../../controllers/ai.controller";

const router = express.Router();

router.post("/parse-text", analyzeTransactionText);
router.post("/analyze-receipt", analyzeReceiptImage);

export default router;
