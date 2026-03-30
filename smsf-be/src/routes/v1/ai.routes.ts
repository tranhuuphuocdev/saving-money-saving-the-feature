import express from "express";
import {
    analyzeReceiptImage,
    analyzeMonthlySpendingInsights,
    analyzeTransactionText,
    analyzeTransactionTextMulti,
} from "../../controllers/ai.controller";

const router = express.Router();

router.post("/parse-text", analyzeTransactionText);
router.post("/parse-text-multi", analyzeTransactionTextMulti);
router.post("/analyze-receipt", analyzeReceiptImage);
router.post("/monthly-insights", analyzeMonthlySpendingInsights);

export default router;
