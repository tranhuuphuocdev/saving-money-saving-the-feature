export type TypeNotificationPaymentStatus = "unpaid" | "paid";

export interface INotification {
    id: string;
    userId: string;
    categoryId: string;
    categoryName: string;
    amount: number;
    description?: string;
    telegramChatId?: string;
    dueDay: number;
    activeMonths: number;
    nextDueAt: number;
    paymentStatus: TypeNotificationPaymentStatus;
    paidMonth: number;
    paidYear: number;
    currentMonth: number;
    currentYear: number;
    lastPaymentTxnId?: string;
    lastReminderPeriod?: number;
    lastReminderAt?: number;
    createdAt: number;
    updatedAt: number;
    isDeleted: boolean;
}

export interface ICreateNotificationPayload {
    categoryId: string;
    amount: number;
    dueDay: number;
    activeMonths?: number;
    startAt?: number;
    description?: string;
    telegramChatId?: string;
}

export interface IPayNotificationPayload {
    walletId?: string;
    amount?: number;
    defaultAmount?: number;
    skipTransaction?: boolean;
}
