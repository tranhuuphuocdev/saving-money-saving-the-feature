import { INotification } from "../interfaces/notification.interface";
import { esClient, withPrefix } from "../lib/es-client";

const notificationAlias = withPrefix("notification-alias");
const notificationIndex = withPrefix("notification");

const mapNotificationSource = (source: Record<string, unknown>): INotification => {
    return {
        id: String(source.notiId),
        userId: String(source.uId),
        categoryId: String(source.cateId),
        categoryName: String(source.cateName || source.cateId || ""),
        amount: Number(source.amount || 0),
        description: source.desc ? String(source.desc) : undefined,
        telegramChatId: source.teleChatId ? String(source.teleChatId) : undefined,
        dueDay: Number(source.dueDay || 1),
        activeMonths: Number(source.activeMonths || 12),
        nextDueAt: Number(source.nextDueAt || 0),
        paymentStatus: String(source.paymentStatus || "unpaid") as INotification["paymentStatus"],
        paidMonth: Number(source.paidMonth || 0),
        paidYear: Number(source.paidYear || 0),
        currentMonth: Number(source.currentMonth || 0),
        currentYear: Number(source.currentYear || 0),
        lastPaymentTxnId: source.lastPaymentTxnId ? String(source.lastPaymentTxnId) : undefined,
        lastReminderPeriod:
            source.lastReminderPeriod !== undefined
                ? Number(source.lastReminderPeriod)
                : undefined,
        lastReminderAt:
            source.lastReminderAt !== undefined ? Number(source.lastReminderAt) : undefined,
        createdAt: Number(source.createdAt || 0),
        updatedAt: Number(source.updatedAt || 0),
        isDeleted: Boolean(source.isDeleted),
    };
};

const toNotificationDocument = (notification: INotification) => {
    return {
        notiId: notification.id,
        uId: String(notification.userId),
        cateId: notification.categoryId,
        cateName: notification.categoryName,
        amount: notification.amount,
        desc: notification.description || "",
        teleChatId: notification.telegramChatId || "",
        dueDay: notification.dueDay,
        activeMonths: notification.activeMonths,
        nextDueAt: notification.nextDueAt,
        paymentStatus: notification.paymentStatus,
        paidMonth: notification.paidMonth,
        paidYear: notification.paidYear,
        currentMonth: notification.currentMonth,
        currentYear: notification.currentYear,
        lastPaymentTxnId: notification.lastPaymentTxnId || "",
        lastReminderPeriod: notification.lastReminderPeriod ?? 0,
        lastReminderAt: notification.lastReminderAt ?? 0,
        createdAt: notification.createdAt,
        updatedAt: notification.updatedAt,
        isDeleted: notification.isDeleted,
    };
};

const listNotificationsByUser = async (userId: string): Promise<INotification[]> => {
    try {
        const response = await esClient.post(`/${notificationAlias}/_search`, {
            size: 500,
            query: {
                bool: {
                    filter: [{ term: { uId: String(userId) } }],
                    must_not: [{ term: { isDeleted: true } }],
                },
            },
            sort: [{ nextDueAt: { order: "asc" } }, { updatedAt: { order: "desc" } }],
        });

        const hits =
            (response.data?.hits?.hits as Array<{
                _source: Record<string, unknown>;
            }>) || [];

        return hits.map((hit) => mapNotificationSource(hit._source));
    } catch (error) {
        if ((error as { response?: { status?: number } }).response?.status === 404) {
            return [];
        }

        throw error;
    }
};

const listAllNotifications = async (): Promise<INotification[]> => {
    try {
        const response = await esClient.post(`/${notificationAlias}/_search`, {
            size: 1000,
            query: {
                bool: {
                    must_not: [{ term: { isDeleted: true } }],
                },
            },
            sort: [{ updatedAt: { order: "desc" } }],
        });

        const hits =
            (response.data?.hits?.hits as Array<{
                _source: Record<string, unknown>;
            }>) || [];

        return hits.map((hit) => mapNotificationSource(hit._source));
    } catch (error) {
        if ((error as { response?: { status?: number } }).response?.status === 404) {
            return [];
        }

        throw error;
    }
};

const getNotificationById = async (
    userId: string,
    notificationId: string,
): Promise<INotification | undefined> => {
    try {
        const response = await esClient.post(`/${notificationAlias}/_search`, {
            size: 1,
            query: {
                bool: {
                    filter: [
                        { term: { uId: String(userId) } },
                        { term: { notiId: String(notificationId) } },
                    ],
                    must_not: [{ term: { isDeleted: true } }],
                },
            },
        });

        const hit = response.data?.hits?.hits?.[0] as
            | { _source: Record<string, unknown> }
            | undefined;

        return hit?._source ? mapNotificationSource(hit._source) : undefined;
    } catch (error) {
        if ((error as { response?: { status?: number } }).response?.status === 404) {
            return undefined;
        }

        throw error;
    }
};

const saveNotification = async (notification: INotification): Promise<INotification> => {
    await esClient.put(`/${notificationIndex}/_doc/${notification.id}?refresh=true`, toNotificationDocument(notification));
    return notification;
};

export {
    listNotificationsByUser,
    listAllNotifications,
    getNotificationById,
    saveNotification,
};
