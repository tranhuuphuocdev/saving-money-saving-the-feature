import { Request, Response } from "express";
import { createWalletForUser, getWalletLogsForUser, getWalletSummary, initializeWalletBalancesForUser, reorderWalletForUser, setWalletActiveForUser } from "../services/wallet.service";

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

const initializeWallets = async (req: Request, res: Response): Promise<Response> => {
    const userId = String(req.user?.id || "").trim();

    if (!userId) {
        return res.status(401).json({
            success: false,
            message: "Unauthorized.",
        });
    }

    try {
        const summary = await initializeWalletBalancesForUser(userId, {
            wallets: req.body?.wallets,
        });

        return res.json({
            success: true,
            message: "Initial wallet setup completed successfully.",
            data: summary,
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
            message: "Failed to complete initial wallet setup.",
        });
    }
};

const patchWallet = async (req: Request, res: Response): Promise<Response> => {
    const userId = String(req.user?.id || "").trim();

    if (!userId) {
        return res.status(401).json({ success: false, message: "Unauthorized." });
    }

    const walletId = String(req.params?.id || "").trim();
    if (!walletId) {
        return res.status(400).json({ success: false, message: "Wallet id is required." });
    }

    const isActive = req.body?.isActive;
    if (typeof isActive !== "boolean") {
        return res.status(400).json({ success: false, message: "isActive must be a boolean." });
    }

    try {
        const wallet = await setWalletActiveForUser(userId, walletId, isActive);
        return res.json({ success: true, data: wallet });
    } catch (error) {
        const statusCode = (error as Error & { statusCode?: number }).statusCode || 500;
        if (statusCode >= 400 && statusCode < 500) {
            return res.status(statusCode).json({ success: false, message: (error as Error).message });
        }
        return res.status(500).json({ success: false, message: "Failed to update wallet." });
    }
};

const getWalletLogs = async (req: Request, res: Response): Promise<Response> => {
    const userId = String(req.user?.id || "").trim();
    if (!userId) {
        return res.status(401).json({ success: false, message: "Unauthorized." });
    }

    const walletId = String(req.params?.id || "").trim();
    if (!walletId) {
        return res.status(400).json({ success: false, message: "Wallet id is required." });
    }

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const startTime = req.query.startTime ? Number(req.query.startTime) : undefined;
    const endTime = req.query.endTime ? Number(req.query.endTime) : undefined;

    try {
        const result = await getWalletLogsForUser(userId, walletId, page, limit, startTime, endTime);
        return res.json({ success: true, data: result });
    } catch (error) {
        const statusCode = (error as Error & { statusCode?: number }).statusCode || 500;
        if (statusCode >= 400 && statusCode < 500) {
            return res.status(statusCode).json({ success: false, message: (error as Error).message });
        }
        return res.status(500).json({ success: false, message: "Failed to get wallet logs." });
    }
};

const reorderWallet = async (req: Request, res: Response): Promise<Response> => {
    const userId = String(req.user?.id || "").trim();

    if (!userId) {
        return res.status(401).json({ success: false, message: "Unauthorized." });
    }

    const walletId = String(req.params?.id || "").trim();
    if (!walletId) {
        return res.status(400).json({ success: false, message: "Wallet id is required." });
    }

    const orderIndex = req.body?.orderIndex;
    if (typeof orderIndex !== "number" || orderIndex < 0) {
        return res.status(400).json({ success: false, message: "orderIndex must be a non-negative number." });
    }

    try {
        await reorderWalletForUser(userId, walletId, orderIndex);
        return res.json({ success: true, message: "Wallet reordered successfully." });
    } catch (error) {
        const statusCode = (error as Error & { statusCode?: number }).statusCode || 500;
        if (statusCode >= 400 && statusCode < 500) {
            return res.status(statusCode).json({ success: false, message: (error as Error).message });
        }
        return res.status(500).json({ success: false, message: "Failed to reorder wallet." });
    }
};

export { getWallets, createWallet, initializeWallets, patchWallet, getWalletLogs, reorderWallet };
