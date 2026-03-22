import { randomUUID } from "node:crypto";
import {
    ICreateNotificationPayload,
    INotification,
    TypeNotificationPaymentStatus,
} from "../interfaces/notification.interface";
import {
    getNotificationById,
    listAllNotifications,
    listNotificationsByUser,
    saveNotification,
} from "../repositories/notification.repository";
import { getCategoryById } from "./category.service";
import { createTransactionForUser } from "./transaction.service";
import { getUserProfileById } from "./user.service";
import { sendTelegramMessage } from "../lib/telegram";

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;
const PAYMENT_STATUS: Record<"UNPAID" | "PAID", TypeNotificationPaymentStatus> = {
    UNPAID: "unpaid",
    PAID: "paid",
};

const getPeriodInfo = (timestamp = Date.now()) => {
    const date = new Date(timestamp);
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    return {
        month,
        year,
        period: year * 100 + month,
    };
};

const getClampedDueDay = (year: number, month: number, dueDay: number): number => {
    const lastDay = new Date(year, month, 0).getDate();
    return Math.max(1, Math.min(lastDay, dueDay));
};

const buildDueTimestamp = (year: number, month: number, dueDay: number): number => {
    return new Date(year, month - 1, getClampedDueDay(year, month, dueDay), 9, 0, 0, 0).getTime();
};

const isPaidForPeriod = (notification: INotification, month: number, year: number): boolean => {
    return notification.paidMonth === month && notification.paidYear === year;
};

const normalizeNotificationForCurrentPeriod = (
    notification: INotification,
    referenceTimestamp = Date.now(),
): { notification: INotification; changed: boolean } => {
    const { month, year } = getPeriodInfo(referenceTimestamp);
    const nextDueAt = buildDueTimestamp(year, month, notification.dueDay);
    const paymentStatus = isPaidForPeriod(notification, month, year)
        ? PAYMENT_STATUS.PAID
        : PAYMENT_STATUS.UNPAID;

    const changed =
        notification.currentMonth !== month ||
        notification.currentYear !== year ||
        notification.nextDueAt !== nextDueAt ||
        notification.paymentStatus !== paymentStatus;

    if (!changed) {
        return { notification, changed: false };
    }

    return {
        changed: true,
        notification: {
            ...notification,
            currentMonth: month,
            currentYear: year,
            nextDueAt,
            paymentStatus,
            updatedAt: Date.now(),
        },
    };
};

const sortNotifications = (items: INotification[]): INotification[] => {
    return [...items].sort((left, right) => {
        const leftUnpaid = left.paymentStatus === PAYMENT_STATUS.UNPAID ? 0 : 1;
        const rightUnpaid = right.paymentStatus === PAYMENT_STATUS.UNPAID ? 0 : 1;

        if (leftUnpaid !== rightUnpaid) {
            return leftUnpaid - rightUnpaid;
        }

        if (left.nextDueAt !== right.nextDueAt) {
            return left.nextDueAt - right.nextDueAt;
        }

        return right.updatedAt - left.updatedAt;
    });
};

const formatReminderDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleDateString("vi-VN");
};

const formatCurrency = (amount: number): string => {
    return `${Math.round(amount).toLocaleString("vi-VN")}₫`;
};

const escapeHtml = (value: string): string => {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
};

const getReminderStatusLabel = (remainingDays: number): string => {
    if (remainingDays < 0) {
        return `⛔ Quá hạn ${Math.abs(remainingDays)} ngày`;
    }

    if (remainingDays === 0) {
        return "⚠️ Đến hạn hôm nay";
    }

    return `⏳ Còn ${remainingDays} ngày`;
};

const buildReminderSummaryMessage = (
    displayName: string,
    notifications: Array<INotification & { remainingDays: number }>,
): string => {
    const sortedNotifications = [...notifications].sort(
        (left, right) => left.nextDueAt - right.nextDueAt,
    );
    const totalAmount = sortedNotifications.reduce(
        (sum, notification) => sum + notification.amount,
        0,
    );

    const overdueCount = sortedNotifications.filter(
        (notification) => notification.remainingDays < 0,
    ).length;
    const dueSoonCount = sortedNotifications.length - overdueCount;

    const lines = sortedNotifications.map((notification, index) => {
        const category = escapeHtml(notification.categoryName || "Không rõ danh mục");
        const description = escapeHtml(
            notification.description || notification.categoryName || "Không có mô tả",
        );

        return [
            `${index + 1}. <b>${category}</b> — ${formatCurrency(notification.amount)}`,
            `   • ${getReminderStatusLabel(notification.remainingDays)}`,
            `   • Hạn: ${formatReminderDate(notification.nextDueAt)}`,
            `   • Mô tả: ${description}`,
        ].join("\n");
    });

    return [
        `🔔 <b>NHẮC LỊCH THANH TOÁN</b>`,
        `Xin chào <b>${escapeHtml(displayName)}</b>, bạn có <b>${sortedNotifications.length}</b> khoản chi cần xử lý.`,
        ``,
        `📌 Quá hạn: <b>${overdueCount}</b> | Sắp đến hạn: <b>${dueSoonCount}</b>`,
        `💰 Tổng cần thanh toán: <b>${formatCurrency(totalAmount)}</b>`,
        ``,
        ...lines,
        ``,
        `💡 Vui lòng mở app để xác nhận đã thanh toán các khoản trên.`,
    ].join("\n");
};

const syncAndPersistNotification = async (
    notification: INotification,
    referenceTimestamp = Date.now(),
): Promise<INotification> => {
    const normalized = normalizeNotificationForCurrentPeriod(notification, referenceTimestamp);

    if (!normalized.changed) {
        return notification;
    }

    return saveNotification(normalized.notification);
};

const listCurrentNotificationsByUser = async (
    userId: string,
): Promise<INotification[]> => {
    const notifications = await listNotificationsByUser(userId);
    const synced = await Promise.all(
        notifications.map((notification) => syncAndPersistNotification(notification)),
    );

    return sortNotifications(synced);
};

const createNotificationForUser = async (
    userId: string,
    payload: ICreateNotificationPayload,
): Promise<INotification> => {
    const category = await getCategoryById(userId, payload.categoryId);

    if (!category) {
        const error = new Error("Category not found.");
        (error as Error & { statusCode?: number }).statusCode = 404;
        throw error;
    }

    const now = Date.now();
    const { month, year } = getPeriodInfo(now);
    const notification: INotification = {
        id: randomUUID(),
        userId,
        categoryId: category.id,
        categoryName: category.name,
        amount: payload.amount,
        description: payload.description?.trim() || category.name,
        telegramChatId: payload.telegramChatId?.trim() || undefined,
        dueDay: payload.dueDay,
        nextDueAt: buildDueTimestamp(year, month, payload.dueDay),
        paymentStatus: PAYMENT_STATUS.UNPAID,
        paidMonth: 0,
        paidYear: 0,
        currentMonth: month,
        currentYear: year,
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
    };

    return saveNotification(notification);
};

const payNotificationForUser = async (
    userId: string,
    notificationId: string,
    walletId: string,
    actorUsername?: string,
): Promise<{ notification: INotification; transactionId: string }> => {
    const existing = await getNotificationById(userId, notificationId);

    if (!existing) {
        const error = new Error("Notification not found.");
        (error as Error & { statusCode?: number }).statusCode = 404;
        throw error;
    }

    const currentNotification = await syncAndPersistNotification(existing);

    if (currentNotification.paymentStatus === PAYMENT_STATUS.PAID) {
        const error = new Error("Notification for current month has already been paid.");
        (error as Error & { statusCode?: number }).statusCode = 409;
        throw error;
    }

    const transactionResult = await createTransactionForUser(
        userId,
        {
            walletId,
            amount: currentNotification.amount,
            category: currentNotification.categoryId,
            description: currentNotification.description || currentNotification.categoryName,
            type: "expense",
            timestamp: Date.now(),
        },
        actorUsername,
    );

    const paidNotification: INotification = {
        ...currentNotification,
        paymentStatus: PAYMENT_STATUS.PAID,
        paidMonth: currentNotification.currentMonth,
        paidYear: currentNotification.currentYear,
        lastPaymentTxnId: transactionResult.transaction.id,
        updatedAt: Date.now(),
    };

    return {
        notification: await saveNotification(paidNotification),
        transactionId: transactionResult.transaction.id,
    };
};

const syncNotificationStatusesAndSendReminders = async (): Promise<{
    synced: number;
    reminded: number;
}> => {
    const notifications = await listAllNotifications();
    const now = Date.now();
    const { period } = getPeriodInfo(now);
    let synced = 0;
    let reminded = 0;
    const dueNotificationsByUser = new Map<string, Array<INotification & { remainingDays: number }>>();

    for (const notification of notifications) {
        const syncedNotification = await syncAndPersistNotification(notification, now);
        if (syncedNotification.updatedAt !== notification.updatedAt) {
            synced += 1;
        }

        if (syncedNotification.paymentStatus !== PAYMENT_STATUS.UNPAID) {
            continue;
        }

        const remainingDays = Math.ceil((syncedNotification.nextDueAt - now) / DAY_IN_MILLISECONDS);
        if (remainingDays > 3) {
            continue;
        }

        if (syncedNotification.lastReminderPeriod === period) {
            continue;
        }

        const existingItems = dueNotificationsByUser.get(syncedNotification.userId) || [];
        existingItems.push({ ...syncedNotification, remainingDays });
        dueNotificationsByUser.set(syncedNotification.userId, existingItems);
    }

    for (const [userId, dueItems] of dueNotificationsByUser.entries()) {
        if (dueItems.length === 0) {
            continue;
        }

        const userProfile = await getUserProfileById(userId);
        const targetChatId =
            dueItems.find((notification) => notification.telegramChatId)?.telegramChatId ||
            userProfile?.telegramChatId;
        const displayName = userProfile?.displayName || userProfile?.username || userId;

        const reminderMessage = buildReminderSummaryMessage(displayName, dueItems);
        const sent = await sendTelegramMessage(targetChatId, reminderMessage);

        if (!sent) {
            continue;
        }

        reminded += dueItems.length;

        await Promise.all(
            dueItems.map((notification) =>
                saveNotification({
                    ...notification,
                    lastReminderPeriod: period,
                    lastReminderAt: now,
                    updatedAt: Date.now(),
                }),
            ),
        );
    }

    return { synced, reminded };
};

export {
    PAYMENT_STATUS,
    buildDueTimestamp,
    createNotificationForUser,
    listCurrentNotificationsByUser,
    payNotificationForUser,
    syncNotificationStatusesAndSendReminders,
};
