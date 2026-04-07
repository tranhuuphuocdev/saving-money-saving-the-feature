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

export interface INotificationPaymentResponse extends IWalletSummary {
    notification: INotificationItem;
    transactionId?: string;
}

export interface IMessageNotificationItem {
    id: string;
    senderId: string;
    senderName: string;
    senderUsername: string;
    senderAvatarUrl: string | null;
    content: string;
    createdAt: number;
    unreadCount: number;
}

export interface ISharedFundActivityNotificationItem {
    id: string;
    walletId: string;
    walletName: string;
    actorId: string;
    actorName: string;
    action: 'create' | 'update' | 'delete' | 'withdraw';
    amount?: number;
    type?: 'income' | 'expense';
    description?: string;
    message: string;
    createdAt: number;
}
