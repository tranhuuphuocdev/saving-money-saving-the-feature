import { Request, Response } from "express";
import {
    analyzeFromReceiptImage,
    analyzeFromText,
    analyzeFromTextMulti,
    analyzeMonthlyInsights,
} from "../services/ai-transaction.service";

const analyzeTransactionText = async (
    req: Request,
    res: Response,
): Promise<Response> => {
    const userId = String(req.user?.id || "").trim();

    if (!userId) {
        return res.status(401).json({
            success: false,
            message: "Unauthorized.",
        });
    }

    try {
        const suggestion = await analyzeFromText(userId, {
            text: req.body?.text,
            walletId: req.body?.walletId,
            fallbackTimestamp: req.body?.fallbackTimestamp,
        });

        return res.json({
            success: true,
            data: {
                suggestion,
            },
        });
    } catch (error) {
        const statusCode = (error as Error & { statusCode?: number }).statusCode || 500;
        return res.status(statusCode).json({
            success: false,
            message: (error as Error).message,
        });
    }
};

const analyzeTransactionTextMulti = async (
    req: Request,
    res: Response,
): Promise<Response> => {
    const userId = String(req.user?.id || "").trim();

    if (!userId) {
        return res.status(401).json({
            success: false,
            message: "Unauthorized.",
        });
    }

    try {
        const suggestions = await analyzeFromTextMulti(userId, {
            text: req.body?.text,
            walletId: req.body?.walletId,
            fallbackTimestamp: req.body?.fallbackTimestamp,
        });

        return res.json({
            success: true,
            data: { suggestions },
        });
    } catch (error) {
        const statusCode = (error as Error & { statusCode?: number }).statusCode || 500;
        return res.status(statusCode).json({
            success: false,
            message: (error as Error).message,
        });
    }
};

const analyzeReceiptImage = async (
    req: Request,
    res: Response,
): Promise<Response> => {
    const userId = String(req.user?.id || "").trim();

    if (!userId) {
        return res.status(401).json({
            success: false,
            message: "Unauthorized.",
        });
    }

    try {
        const suggestion = await analyzeFromReceiptImage(userId, {
            imageBase64: req.body?.imageBase64,
            mimeType: req.body?.mimeType,
            walletId: req.body?.walletId,
            fallbackTimestamp: req.body?.fallbackTimestamp,
        });

        return res.json({
            success: true,
            data: {
                suggestion,
            },
        });
    } catch (error) {
        const statusCode = (error as Error & { statusCode?: number }).statusCode || 500;
        return res.status(statusCode).json({
            success: false,
            message: (error as Error).message,
        });
    }
};

const analyzeMonthlySpendingInsights = async (
    req: Request,
    res: Response,
): Promise<Response> => {
    const userId = String(req.user?.id || "").trim();

    if (!userId) {
        return res.status(401).json({
            success: false,
            message: "Unauthorized.",
        });
    }

    try {
        const insight = await analyzeMonthlyInsights(userId, {
            month: req.body?.month,
            year: req.body?.year,
            analysisType: req.body?.analysisType,
            periodType: req.body?.periodType,
            referenceTimestamp: req.body?.referenceTimestamp,
            userQuery: req.body?.userQuery,
        });

        return res.json({
            success: true,
            data: {
                insight,
            },
        });
    } catch (error) {
        const statusCode = (error as Error & { statusCode?: number }).statusCode || 500;
        return res.status(statusCode).json({
            success: false,
            message: (error as Error).message,
        });
    }
};

export { analyzeReceiptImage, analyzeTransactionText, analyzeTransactionTextMulti, analyzeMonthlySpendingInsights };
