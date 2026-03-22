import { api } from '@/lib/auth/api';
import {
    ICreateNotificationPayload,
    INotificationItem,
    INotificationPaymentResponse,
    IPayNotificationPayload,
} from '@/types/notification';

interface IApiResponse<T> {
    success: boolean;
    message?: string;
    data: T;
}

interface INotificationApiItem {
    id: string;
    categoryId: string;
    categoryName: string;
    amount: number;
    description?: string;
    telegramChatId?: string;
    dueDay: number;
    nextDueAt: number;
    paymentStatus: 'unpaid' | 'paid';
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

const toNotificationItem = (item: INotificationApiItem): INotificationItem => ({
    ...item,
});

export async function getNotificationsRequest(): Promise<INotificationItem[]> {
    const response = await api.get<IApiResponse<INotificationApiItem[]>>('/notifications');
    return response.data.data.map(toNotificationItem);
}

export async function createNotificationRequest(
    payload: ICreateNotificationPayload,
): Promise<INotificationItem> {
    const response = await api.post<IApiResponse<INotificationApiItem>>('/notifications', payload);
    return toNotificationItem(response.data.data);
}

export async function payNotificationRequest(
    notificationId: string,
    payload: IPayNotificationPayload,
): Promise<INotificationPaymentResponse> {
    const response = await api.post<IApiResponse<INotificationPaymentResponse>>(
        `/notifications/${notificationId}/pay`,
        payload,
    );

    return {
        ...response.data.data,
        notification: toNotificationItem(response.data.data.notification),
    };
}
