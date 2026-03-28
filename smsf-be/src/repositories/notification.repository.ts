import { INotification } from "../interfaces/notification.interface";
import { DbExecutor, prisma } from "../lib/prisma";

const getExecutor = (executor?: DbExecutor) => executor || prisma;

const mapRow = (row: {
    id: string;
    userId: string;
    categoryId: string;
    categoryName: string | null;
    amount: unknown;
    description: string | null;
    telegramChatId: string | null;
    dueDay: number;
    activeMonths: number;
    nextDueAt: bigint;
    paymentStatus: string;
    paidMonth: number;
    paidYear: number;
    currentMonth: number;
    currentYear: number;
    lastPaymentTxnId: string | null;
    lastReminderPeriod: number | null;
    lastReminderAt: bigint | null;
    createdAt: bigint;
    updatedAt: bigint;
    isDeleted: boolean;
}): INotification => {
    return {
        id: String(row.id),
        userId: String(row.userId),
        categoryId: String(row.categoryId),
        categoryName: String(row.categoryName || row.categoryId || ""),
        amount: Number(row.amount || 0),
        description: row.description ? String(row.description) : undefined,
        telegramChatId: row.telegramChatId ? String(row.telegramChatId) : undefined,
        dueDay: Number(row.dueDay || 1),
        activeMonths: Number(row.activeMonths || 12),
        nextDueAt: Number(row.nextDueAt || 0n),
        paymentStatus: String(row.paymentStatus || "unpaid") as INotification["paymentStatus"],
        paidMonth: Number(row.paidMonth || 0),
        paidYear: Number(row.paidYear || 0),
        currentMonth: Number(row.currentMonth || 0),
        currentYear: Number(row.currentYear || 0),
        lastPaymentTxnId: row.lastPaymentTxnId ? String(row.lastPaymentTxnId) : undefined,
        lastReminderPeriod:
            row.lastReminderPeriod != null ? Number(row.lastReminderPeriod) : undefined,
        lastReminderAt:
            row.lastReminderAt != null ? Number(row.lastReminderAt) : undefined,
        createdAt: Number(row.createdAt || 0n),
        updatedAt: Number(row.updatedAt || 0n),
        isDeleted: Boolean(row.isDeleted),
    };
};

const listNotificationsByUser = async (userId: string): Promise<INotification[]> => {
    const result = await prisma.notification.findMany({
        where: {
            userId,
            isDeleted: false,
        },
        orderBy: [
            { nextDueAt: "asc" },
            { updatedAt: "desc" },
        ],
        take: 500,
    });

    return result.map(mapRow);
};

const listAllNotifications = async (): Promise<INotification[]> => {
    const result = await prisma.notification.findMany({
        where: { isDeleted: false },
        orderBy: { updatedAt: "desc" },
        take: 1000,
    });

    return result.map(mapRow);
};

const getNotificationById = async (
    userId: string,
    notificationId: string,
    executor?: DbExecutor,
): Promise<INotification | undefined> => {
    const db = getExecutor(executor);
    const result = await db.notification.findFirst({
        where: {
            userId,
            id: notificationId,
            isDeleted: false,
        },
        orderBy: { updatedAt: "desc" },
    });

    return result ? mapRow(result) : undefined;
};

const saveNotification = async (
    notification: INotification,
    executor?: DbExecutor,
): Promise<INotification> => {
    const db = getExecutor(executor);

    await db.notification.upsert({
        where: { id: notification.id },
        create: {
            id: notification.id,
            userId: notification.userId,
            categoryId: notification.categoryId,
            categoryName: notification.categoryName,
            amount: notification.amount,
            description: notification.description || "",
            telegramChatId: notification.telegramChatId || "",
            dueDay: notification.dueDay,
            activeMonths: notification.activeMonths,
            nextDueAt: BigInt(notification.nextDueAt),
            paymentStatus: notification.paymentStatus,
            paidMonth: notification.paidMonth,
            paidYear: notification.paidYear,
            currentMonth: notification.currentMonth,
            currentYear: notification.currentYear,
            lastPaymentTxnId: notification.lastPaymentTxnId || "",
            lastReminderPeriod: notification.lastReminderPeriod ?? 0,
            lastReminderAt:
                notification.lastReminderAt != null ? BigInt(notification.lastReminderAt) : 0n,
            createdAt: BigInt(notification.createdAt),
            updatedAt: BigInt(notification.updatedAt),
            isDeleted: notification.isDeleted,
        },
        update: {
            categoryId: notification.categoryId,
            categoryName: notification.categoryName,
            amount: notification.amount,
            description: notification.description || "",
            telegramChatId: notification.telegramChatId || "",
            dueDay: notification.dueDay,
            activeMonths: notification.activeMonths,
            nextDueAt: BigInt(notification.nextDueAt),
            paymentStatus: notification.paymentStatus,
            paidMonth: notification.paidMonth,
            paidYear: notification.paidYear,
            currentMonth: notification.currentMonth,
            currentYear: notification.currentYear,
            lastPaymentTxnId: notification.lastPaymentTxnId || "",
            lastReminderPeriod: notification.lastReminderPeriod ?? 0,
            lastReminderAt:
                notification.lastReminderAt != null ? BigInt(notification.lastReminderAt) : 0n,
            updatedAt: BigInt(notification.updatedAt),
            isDeleted: notification.isDeleted,
        },
    });

    return notification;
};

export {
    listNotificationsByUser,
    listAllNotifications,
    getNotificationById,
    saveNotification,
};
