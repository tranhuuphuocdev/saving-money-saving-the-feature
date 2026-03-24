import { Request, Response } from "express";
import { getWalletSummary } from "../services/wallet.service";
import {
    createNotificationForUser,
    deleteNotificationForUser,
    listCurrentNotificationsByUser,
    payNotificationForUser,
} from "../services/notification.service";
import {
    validateCreateNotificationPayload,
    validatePayNotificationPayload,
} from "../validators/notification.validator";
import { invalidateSavingsCacheByUser } from "../lib/savings-cache";

const listNotifications = async (req: Request, res: Response): Promise<Response> => {
    const userId = String(req.user?.id || "").trim();

    if (!userId) {
        return res.status(401).json({ success: false, message: "Unauthorized." });
    }

    try {
        const notifications = await listCurrentNotificationsByUser(userId);
        return res.json({ success: true, data: notifications });
    } catch (error) {
        const statusCode = (error as Error & { statusCode?: number }).statusCode || 500;
        return res.status(statusCode).json({
            success: false,
            message: (error as Error).message,
        });
    }
};

const createNotification = async (req: Request, res: Response): Promise<Response> => {
    const userId = String(req.user?.id || "").trim();

    if (!userId) {
        return res.status(401).json({ success: false, message: "Unauthorized." });
    }

    const validation = validateCreateNotificationPayload(req.body);
    if (!validation.isValid || !validation.payload) {
        return res.status(400).json({
            success: false,
            message: "Validation failed.",
            errors: validation.errors,
        });
    }

    try {
        const notification = await createNotificationForUser(userId, validation.payload);
        return res.status(201).json({
            success: true,
            message: "Notification created successfully.",
            data: notification,
        });
    } catch (error) {
        const statusCode = (error as Error & { statusCode?: number }).statusCode || 500;
        return res.status(statusCode).json({
            success: false,
            message: (error as Error).message,
        });
    }
};

const payNotification = async (req: Request, res: Response): Promise<Response> => {
    const userId = String(req.user?.id || "").trim();
    const notificationId = String(req.params.notificationId || "").trim();

    if (!userId) {
        return res.status(401).json({ success: false, message: "Unauthorized." });
    }

    if (!notificationId) {
        return res.status(400).json({ success: false, message: "notificationId is required." });
    }

    const validation = validatePayNotificationPayload(req.body);
    if (!validation.isValid || !validation.payload) {
        return res.status(400).json({
            success: false,
            message: "Validation failed.",
            errors: validation.errors,
        });
    }

    try {
        const result = await payNotificationForUser(
            userId,
            notificationId,
            validation.payload.walletId,
            String(req.user?.username || "").trim() || undefined,
        );
        const walletSummary = await getWalletSummary(userId);
        invalidateSavingsCacheByUser(userId);

        return res.json({
            success: true,
            message: "Notification paid successfully.",
            data: {
                notification: result.notification,
                transactionId: result.transactionId,
                ...walletSummary,
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

const deleteNotification = async (req: Request, res: Response): Promise<Response> => {
    const userId = String(req.user?.id || "").trim();
    const notificationId = String(req.params.notificationId || "").trim();

    if (!userId) {
        return res.status(401).json({ success: false, message: "Unauthorized." });
    }

    if (!notificationId) {
        return res.status(400).json({ success: false, message: "notificationId is required." });
    }

    try {
        const notification = await deleteNotificationForUser(userId, notificationId);
        return res.json({
            success: true,
            message: "Notification deleted successfully.",
            data: notification,
        });
    } catch (error) {
        const statusCode = (error as Error & { statusCode?: number }).statusCode || 500;
        return res.status(statusCode).json({
            success: false,
            message: (error as Error).message,
        });
    }
};

export { listNotifications, createNotification, payNotification, deleteNotification };
