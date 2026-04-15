import { Request, Response } from "express";
import {
    createWalletForUser,
    getWalletLogsForUser,
    getWalletSummary,
    initializeWalletBalancesForUser,
    reorderWalletForUser,
    setWalletActiveForUser,
    transferWalletBalanceForUser,
    updateWalletBalanceForUser,
    updateWalletNameForUser,
} from "../services/wallet.service";
import { logApiError, logApiDebug, logApiWarn } from "../util/api-logger";

const getWallets = async (req: Request, res: Response): Promise<Response> => {
    const userId = String(req.user?.id || "").trim();

    if (!userId) {
        logApiWarn(req, "Wallet summary request rejected: missing user");
        return res.status(401).json({
            success: false,
            message: "Unauthorized.",
        });
    }

    const walletSummary = await getWalletSummary(userId);

    logApiDebug(req, "Wallet summary loaded", {
        walletCount: walletSummary.wallets.length,
        totalAmount: walletSummary.totalAmount,
        requiresInitialSetup: walletSummary.requiresInitialSetup,
    });

    return res.json({
        success: true,
        data: walletSummary,
    });
};

const createWallet = async (req: Request, res: Response): Promise<Response> => {
    const userId = String(req.user?.id || "").trim();

    if (!userId) {
        logApiWarn(req, "Create wallet request rejected: missing user");
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

        logApiDebug(req, "Wallet created", {
            walletId: wallet.id,
            walletType: wallet.type,
            balance: wallet.balance,
        });

        return res.status(201).json({
            success: true,
            message: "Wallet created successfully.",
            data: wallet,
        });
    } catch (error) {
        const statusCode =
            (error as Error & { statusCode?: number }).statusCode || 500;

        logApiError(req, "Create wallet failed", error, {
            statusCode,
            walletName: String(req.body?.name || "").trim() || undefined,
            walletType: String(req.body?.type || "").trim() || undefined,
        });

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
        logApiWarn(req, "Initialize wallets request rejected: missing user");
        return res.status(401).json({
            success: false,
            message: "Unauthorized.",
        });
    }

    try {
        const summary = await initializeWalletBalancesForUser(userId, {
            wallets: req.body?.wallets,
        });

        logApiDebug(req, "Initial wallet setup completed", {
            walletCount: summary.wallets.length,
            totalAmount: summary.totalAmount,
        });

        return res.json({
            success: true,
            message: "Initial wallet setup completed successfully.",
            data: summary,
        });
    } catch (error) {
        const statusCode =
            (error as Error & { statusCode?: number }).statusCode || 500;

        logApiError(req, "Initial wallet setup failed", error, {
            statusCode,
            submittedWalletCount: Array.isArray(req.body?.wallets) ? req.body.wallets.length : 0,
        });

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
        logApiWarn(req, "Patch wallet request rejected: missing user");
        return res.status(401).json({ success: false, message: "Unauthorized." });
    }

    const walletId = String(req.params?.id || "").trim();
    if (!walletId) {
        logApiWarn(req, "Patch wallet request rejected: missing walletId");
        return res.status(400).json({ success: false, message: "Wallet id is required." });
    }

    const hasName = Object.prototype.hasOwnProperty.call(req.body || {}, "name");
    const hasIsActive = Object.prototype.hasOwnProperty.call(req.body || {}, "isActive");

    if (!hasName && !hasIsActive) {
        logApiWarn(req, "Patch wallet request rejected: no supported fields", {
            hasName,
            hasIsActive,
        });
        return res.status(400).json({ success: false, message: "Provide name and/or isActive to update wallet." });
    }

    if (hasIsActive && typeof req.body?.isActive !== "boolean") {
        logApiWarn(req, "Patch wallet request rejected: invalid isActive", {
            providedType: typeof req.body?.isActive,
        });
        return res.status(400).json({ success: false, message: "isActive must be a boolean." });
    }

    if (hasName && typeof req.body?.name !== "string") {
        logApiWarn(req, "Patch wallet request rejected: invalid name", {
            providedType: typeof req.body?.name,
        });
        return res.status(400).json({ success: false, message: "name must be a string." });
    }

    try {
        let wallet;

        if (hasName) {
            wallet = await updateWalletNameForUser(userId, walletId, req.body.name);
        }

        if (hasIsActive) {
            wallet = await setWalletActiveForUser(userId, walletId, req.body.isActive);
        }

        logApiDebug(req, "Wallet updated", {
            walletId,
            isActive: hasIsActive ? req.body.isActive : undefined,
            walletName: hasName ? String(req.body.name || "").trim() || undefined : undefined,
        });

        return res.json({ success: true, data: wallet });
    } catch (error) {
        const statusCode = (error as Error & { statusCode?: number }).statusCode || 500;
        logApiError(req, "Patch wallet failed", error, {
            statusCode,
            walletId,
            isActive: hasIsActive ? req.body.isActive : undefined,
            walletName: hasName ? String(req.body.name || "").trim() || undefined : undefined,
        });
        if (statusCode >= 400 && statusCode < 500) {
            return res.status(statusCode).json({ success: false, message: (error as Error).message });
        }
        return res.status(500).json({ success: false, message: "Failed to update wallet." });
    }
};

const getWalletLogs = async (req: Request, res: Response): Promise<Response> => {
    const userId = String(req.user?.id || "").trim();
    if (!userId) {
        logApiWarn(req, "Get wallet logs request rejected: missing user");
        return res.status(401).json({ success: false, message: "Unauthorized." });
    }

    const walletId = String(req.params?.id || "").trim();
    if (!walletId) {
        logApiWarn(req, "Get wallet logs request rejected: missing walletId");
        return res.status(400).json({ success: false, message: "Wallet id is required." });
    }

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const startTime = req.query.startTime ? Number(req.query.startTime) : undefined;
    const endTime = req.query.endTime ? Number(req.query.endTime) : undefined;

    try {
        const result = await getWalletLogsForUser(userId, walletId, page, limit, startTime, endTime);
        logApiDebug(req, "Wallet logs loaded", {
            walletId,
            page,
            limit,
            total: result.total,
            itemCount: result.items.length,
        });
        return res.json({ success: true, data: result });
    } catch (error) {
        const statusCode = (error as Error & { statusCode?: number }).statusCode || 500;
        logApiError(req, "Get wallet logs failed", error, {
            statusCode,
            walletId,
            page,
            limit,
            startTime,
            endTime,
        });
        if (statusCode >= 400 && statusCode < 500) {
            return res.status(statusCode).json({ success: false, message: (error as Error).message });
        }
        return res.status(500).json({ success: false, message: "Failed to get wallet logs." });
    }
};

const reorderWallet = async (req: Request, res: Response): Promise<Response> => {
    const userId = String(req.user?.id || "").trim();

    if (!userId) {
        logApiWarn(req, "Reorder wallet request rejected: missing user");
        return res.status(401).json({ success: false, message: "Unauthorized." });
    }

    const walletId = String(req.params?.id || "").trim();
    if (!walletId) {
        logApiWarn(req, "Reorder wallet request rejected: missing walletId");
        return res.status(400).json({ success: false, message: "Wallet id is required." });
    }

    const orderIndex = req.body?.orderIndex;
    if (typeof orderIndex !== "number" || orderIndex < 0) {
        logApiWarn(req, "Reorder wallet request rejected: invalid orderIndex", {
            orderIndex,
        });
        return res.status(400).json({ success: false, message: "orderIndex must be a non-negative number." });
    }

    try {
        await reorderWalletForUser(userId, walletId, orderIndex);
        logApiDebug(req, "Wallet reordered", {
            walletId,
            orderIndex,
        });
        return res.json({ success: true, message: "Wallet reordered successfully." });
    } catch (error) {
        const statusCode = (error as Error & { statusCode?: number }).statusCode || 500;
        logApiError(req, "Reorder wallet failed", error, {
            statusCode,
            walletId,
            orderIndex,
        });
        if (statusCode >= 400 && statusCode < 500) {
            return res.status(statusCode).json({ success: false, message: (error as Error).message });
        }
        return res.status(500).json({ success: false, message: "Failed to reorder wallet." });
    }
};

const transferWalletBalance = async (req: Request, res: Response): Promise<Response> => {
    const userId = String(req.user?.id || "").trim();

    if (!userId) {
        logApiWarn(req, "Transfer wallet balance request rejected: missing user");
        return res.status(401).json({ success: false, message: "Unauthorized." });
    }

    const fromWalletId = String(req.body?.fromWalletId || "").trim();
    const toWalletId = String(req.body?.toWalletId || "").trim();
    const amount = Number(req.body?.amount);
    const description = String(req.body?.description || "").trim() || undefined;

    if (!fromWalletId || !toWalletId) {
        logApiWarn(req, "Transfer wallet balance request rejected: missing wallet ids");
        return res.status(400).json({
            success: false,
            message: "fromWalletId and toWalletId are required.",
        });
    }

    if (!Number.isFinite(amount) || amount <= 0) {
        logApiWarn(req, "Transfer wallet balance request rejected: invalid amount", {
            amount: req.body?.amount,
        });
        return res.status(400).json({
            success: false,
            message: "amount must be a positive number.",
        });
    }

    try {
        const result = await transferWalletBalanceForUser(userId, {
            fromWalletId,
            toWalletId,
            amount,
            description,
        });
        const summary = await getWalletSummary(userId);

        logApiDebug(req, "Wallet balance transferred", {
            fromWalletId,
            toWalletId,
            amount,
        });

        return res.json({
            success: true,
            message: "Wallet transfer completed successfully.",
            data: {
                transfer: result,
                ...summary,
            },
        });
    } catch (error) {
        const statusCode = (error as Error & { statusCode?: number }).statusCode || 500;
        logApiError(req, "Transfer wallet balance failed", error, {
            statusCode,
            fromWalletId,
            toWalletId,
            amount,
        });
        return res.status(statusCode).json({
            success: false,
            message: (error as Error).message,
        });
    }
};

const updateWalletBalance = async (req: Request, res: Response): Promise<Response> => {
    const userId = String(req.user?.id || "").trim();

    if (!userId) {
        logApiWarn(req, "Update wallet balance request rejected: missing user");
        return res.status(401).json({ success: false, message: "Unauthorized." });
    }

    const walletId = String(req.params?.id || "").trim();
    if (!walletId) {
        logApiWarn(req, "Update wallet balance request rejected: missing walletId");
        return res.status(400).json({ success: false, message: "Wallet id is required." });
    }

    const balance = Number(req.body?.balance);
    if (!Number.isFinite(balance) || balance < 0) {
        logApiWarn(req, "Update wallet balance request rejected: invalid balance", {
            balance: req.body?.balance,
        });
        return res.status(400).json({
            success: false,
            message: "balance must be a non-negative number.",
        });
    }

    const description = String(req.body?.description || "").trim() || undefined;

    try {
        const wallet = await updateWalletBalanceForUser(userId, walletId, balance, description);
        const summary = await getWalletSummary(userId);

        logApiDebug(req, "Wallet balance updated", {
            walletId,
            balance,
        });

        return res.json({
            success: true,
            message: "Wallet balance updated successfully.",
            data: {
                wallet,
                ...summary,
            },
        });
    } catch (error) {
        const statusCode = (error as Error & { statusCode?: number }).statusCode || 500;
        logApiError(req, "Update wallet balance failed", error, {
            statusCode,
            walletId,
            balance,
        });
        return res.status(statusCode).json({
            success: false,
            message: (error as Error).message,
        });
    }
};

export {
    getWallets,
    createWallet,
    initializeWallets,
    patchWallet,
    getWalletLogs,
    reorderWallet,
    transferWalletBalance,
    updateWalletBalance,
};
