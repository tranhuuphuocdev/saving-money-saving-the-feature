import { IWalletSummary } from '@/types/calendar';

export type TypeNotificationPaymentStatus = 'unpaid' | 'paid';

export interface INotificationItem {
    id: string;
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
}

export interface ICreateNotificationPayload {
    categoryId: string;
    amount: number;
    dueDay: number;
    activeMonths?: number;
    description?: string;
    telegramChatId?: string;
}

export interface IPayNotificationPayload {
    walletId: string;
}

export interface INotificationPaymentResponse extends IWalletSummary {
    notification: INotificationItem;
    transactionId: string;
}
