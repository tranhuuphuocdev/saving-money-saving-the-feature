import { Request, Response } from "express";
import { createWalletForUser, getWalletSummary } from "../services/wallet.service";

const getWallets = async (req: Request, res: Response): Promise<Response> => {
    const userId = String(req.user?.id || "").trim();

    if (!userId) {
        return res.status(401).json({
            success: false,
            message: "Unauthorized.",
        });
    }

    const walletSummary = await getWalletSummary(userId);

    return res.json({
        success: true,
        data: walletSummary,
    });
};

const createWallet = async (req: Request, res: Response): Promise<Response> => {
    const userId = String(req.user?.id || "").trim();

    if (!userId) {
        return res.status(401).json({
            success: false,
            message: "Unauthorized.",
        });
    }

    try {
        const wallet = await createWalletForUser(userId, {
            name: req.body?.name,
            type: req.body?.type,
            balance: req.body?.balance,
        });

        return res.status(201).json({
            success: true,
            message: "Wallet created successfully.",
            data: wallet,
        });
    } catch (error) {
        const statusCode =
            (error as Error & { statusCode?: number }).statusCode || 500;

        if (statusCode >= 400 && statusCode < 500) {
            return res.status(statusCode).json({
                success: false,
                message: (error as Error).message,
            });
        }

        return res.status(500).json({
            success: false,
            message: "Failed to create wallet.",
        });
    }
};

export { getWallets, createWallet };
