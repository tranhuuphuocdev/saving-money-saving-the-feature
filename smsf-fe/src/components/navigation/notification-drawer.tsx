'use client';

import { BellRing, CalendarClock, CheckCircle2, Clock3, MessageCircle, Plus, Trash2, UserPlus, Users2, X } from 'lucide-react';
import { PointerEvent, useEffect, useMemo, useRef, useState } from 'react';
import { AppCard } from '@/components/common/app-card';
import { CustomSelect } from '@/components/common/custom-select';
import { PrimaryButton } from '@/components/common/primary-button';
import { UserAvatar } from '@/components/common/user-avatar';
import { formatCurrencyVND } from '@/lib/formatters';
import { getActiveSortedWallets } from '@/lib/wallet-selection';
import { useLockBodyScroll } from '@/lib/ui/use-lock-body-scroll';
import { ICategoryItem, IWalletItem } from '@/types/calendar';
import { IFriendRequest } from '@/types/messages';
import { ICreateNotificationPayload, IMessageNotificationItem, INotificationItem, IPayNotificationPayload, ISharedFundActivityNotificationItem, IUpdateNotificationPayload } from '@/types/notification';
import { ISharedFundInviteItem } from '@/types/shared-fund';

interface INotificationDrawerProps {
    isOpen: boolean;
    isLoading: boolean;
    notifications: INotificationItem[];
    wallets: IWalletItem[];
    expenseCategories: ICategoryItem[];
    friendRequests: IFriendRequest[];
    sharedFundInvites: ISharedFundInviteItem[];
    sharedFundActivities: ISharedFundActivityNotificationItem[];
    messageNotifications: IMessageNotificationItem[];
    userTelegramChatId?: string;
    onClose: () => void;
    onCreateNotification: (payload: ICreateNotificationPayload) => Promise<void>;
    onPayNotification: (notificationId: string, payload: IPayNotificationPayload) => Promise<void>;
    onDeleteNotification: (notificationId: string) => Promise<void>;
    onUpdateNotification: (notificationId: string, payload: IUpdateNotificationPayload) => Promise<void>;
    onAcceptFriendRequest: (requestId: string) => Promise<void>;
    onRejectFriendRequest: (requestId: string) => Promise<void>;
    onAcceptSharedFundInvite: (inviteId: string) => Promise<void>;
    onRejectSharedFundInvite: (inviteId: string) => Promise<void>;
    onReplyMessageNotification: (notificationId: string, senderId: string) => void;
    onHideMessageNotification: (notificationId: string) => void;
}

const NOTI_ACTION_SIDE_PADDING = 6;
const NOTI_ACTION_BUTTON_WIDTH = 58;
const NOTI_ACTION_GAP = 4;
const NOTI_ACTION_TRAILING_PADDING = 6;
const NOTI_SWIPE_SNAP =
    NOTI_ACTION_SIDE_PADDING
    + NOTI_ACTION_BUTTON_WIDTH
    + NOTI_ACTION_GAP
    + NOTI_ACTION_BUTTON_WIDTH
    + NOTI_ACTION_TRAILING_PADDING;

function formatNotificationTime(timestamp: number): string {
    return new Intl.DateTimeFormat('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
    }).format(new Date(timestamp));
}

interface INotificationVisualStyle {
    rowBackground: string;
    rowBorder: string;
    badgeBackground: string;
    badgeColor: string;
    amountColor: string;
    titleColor: string;
    iconColor: string;
}

function formatDueDate(timestamp: number): string {
    const date = new Date(timestamp);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}

function formatMonthYear(month: number, year: number): string {
    return `${String(month).padStart(2, '0')}/${year}`;
}

function getStartOfMonthTimestamp(timestamp: number): number {
    const date = new Date(timestamp);
    return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0).getTime();
}

function getDueBadgeLabel(remainingDays: number): string {
    if (remainingDays < 0) {
        return `Quá hạn ${Math.abs(remainingDays)} ngày`;
    }

    if (remainingDays === 0) {
        return 'Đến hạn hôm nay';
    }

    return `Còn ${remainingDays} ngày`;
}

function getRemainingDays(timestamp: number): number {
    const today = new Date();
    const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const target = new Date(timestamp);
    const startTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
    return Math.ceil((startTarget - startToday) / (24 * 60 * 60 * 1000));
}

function isNotificationStarted(notification: INotificationItem): boolean {
    return notification.createdAt <= Date.now();
}

function getStatusLabel(notification: INotificationItem): string {
    if (!isNotificationStarted(notification)) {
        const startDate = new Date(notification.createdAt);
        return `Bắt đầu từ ${formatMonthYear(startDate.getMonth() + 1, startDate.getFullYear())}`;
    }

    if (
        notification.paymentStatus === 'paid' &&
        notification.paidMonth === notification.currentMonth &&
        notification.paidYear === notification.currentYear
    ) {
        return `${formatMonthYear(notification.currentMonth, notification.currentYear)} đã thanh toán`;
    }

    return getDueBadgeLabel(getRemainingDays(notification.nextDueAt));
}

function getNotificationVisualStyle(notification: INotificationItem, remainingDays: number): INotificationVisualStyle {
    if (!isNotificationStarted(notification)) {
        return {
            rowBackground: 'color-mix(in srgb, #3b82f6 10%, var(--surface-soft))',
            rowBorder: 'color-mix(in srgb, #2563eb 28%, var(--surface-border))',
            badgeBackground: 'color-mix(in srgb, #2563eb 18%, transparent)',
            badgeColor: 'var(--bage-color)',
            amountColor: '#1d4ed8',
            titleColor: 'color-mix(in srgb, var(--foreground) 90%, #1e3a8a)',
            iconColor: '#2563eb',
        };
    }

    if (notification.paymentStatus === 'paid') {
        return {
            rowBackground: 'color-mix(in srgb, #22c55e 14%, var(--surface-soft))',
            rowBorder: 'color-mix(in srgb, #16a34a 40%, var(--surface-border))',
            badgeBackground: 'color-mix(in srgb, #16a34a 22%, transparent)',
            badgeColor: 'var(--bage-color)',
            amountColor: '#166534',
            titleColor: 'color-mix(in srgb, var(--foreground) 88%, #14532d)',
            iconColor: '#16a34a',
        };
    }

    if (remainingDays < 0) {
        return {
            rowBackground: 'color-mix(in srgb, #ef4444 10%, var(--surface-soft))',
            rowBorder: 'color-mix(in srgb, #dc2626 46%, var(--surface-border))',
            badgeBackground: 'color-mix(in srgb, #dc2626 16%, transparent)',
            badgeColor: 'var(--bage-color)',
            amountColor: '#dc2626',
            titleColor: 'color-mix(in srgb, var(--foreground) 90%, #991b1b)',
            iconColor: '#ef4444',
        };
    }

    if (remainingDays <= 2) {
        return {
            rowBackground: 'color-mix(in srgb, #f94f16 16%, var(--surface-soft))',
            rowBorder: 'color-mix(in srgb, #ea580c 48%, var(--surface-border))',
            badgeBackground: 'color-mix(in srgb, #fb923c 22%, transparent)',
            badgeColor: 'var(--bage-color)',
            amountColor: '#c2410c',
            titleColor: 'color-mix(in srgb, var(--foreground) 90%, #9a3412)',
            iconColor: '#ea580c',
        };
    }

    if (remainingDays <= 6) {
        return {
            rowBackground: 'color-mix(in srgb, #f58c0b 14%, var(--surface-soft))',
            rowBorder: 'color-mix(in srgb, #d97706 40%, var(--surface-border))',
            badgeBackground: 'color-mix(in srgb, #f59e0b 18%, transparent)',
            badgeColor: 'var(--bage-color)',
            amountColor: '#b45309',
            titleColor: 'color-mix(in srgb, var(--foreground) 90%, #92400e)',
            iconColor: '#d97706',
        };
    }

    if (remainingDays <= 10) {
        return {
            rowBackground: 'color-mix(in srgb, #c0f903 10%, var(--surface-soft))',
            rowBorder: 'color-mix(in srgb, #ca8a04 34%, var(--surface-border))',
            badgeBackground: 'color-mix(in srgb, #eab308 16%, transparent)',
            badgeColor: 'var(--bage-color)',
            amountColor: '#a16207',
            titleColor: 'color-mix(in srgb, var(--foreground) 90%, #854d0e)',
            iconColor: '#ca8a04',
        };
    }

    return {
        rowBackground: 'var(--surface-soft)',
        rowBorder: 'var(--surface-border)',
        badgeBackground: 'var(--chip-bg)',
        badgeColor: 'var(--bage-color)',
        amountColor: 'var(--accent-text)',
        titleColor: 'var(--foreground)',
        iconColor: 'var(--accent)',
    };
}

export function NotificationDrawer({
    isOpen,
    isLoading,
    notifications,
    wallets,
    expenseCategories,
    friendRequests,
    sharedFundInvites,
    sharedFundActivities,
    messageNotifications,
    userTelegramChatId,
    onClose,
    onCreateNotification,
    onPayNotification,
    onDeleteNotification,
    onUpdateNotification,
    onAcceptFriendRequest,
    onRejectFriendRequest,
    onAcceptSharedFundInvite,
    onRejectSharedFundInvite,
    onReplyMessageNotification,
    onHideMessageNotification,
}: INotificationDrawerProps) {
    useLockBodyScroll(isOpen);

    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [createCategoryId, setCreateCategoryId] = useState('');
    const [createAmount, setCreateAmount] = useState('');
    const [createDueDay, setCreateDueDay] = useState('1');
    const [createStartAt, setCreateStartAt] = useState(String(getStartOfMonthTimestamp(Date.now())));
    const [createActiveMonths, setCreateActiveMonths] = useState('12');
    const [createDescription, setCreateDescription] = useState('');
    const [createTelegramChatId, setCreateTelegramChatId] = useState('');
    const [createError, setCreateError] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    const [selectedNotification, setSelectedNotification] = useState<INotificationItem | null>(null);
    const [payWalletId, setPayWalletId] = useState('');
    const [payDefaultAmount, setPayDefaultAmount] = useState('');
    const [payAmount, setPayAmount] = useState('');
    const [payError, setPayError] = useState('');
    const [isPaying, setIsPaying] = useState(false);
    const [isSkipping, setIsSkipping] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [deletingNotificationId, setDeletingNotificationId] = useState<string | null>(null);
    const [friendActionLoadingMap, setFriendActionLoadingMap] = useState<Record<string, boolean>>({});

    const [activeSection, setActiveSection] = useState<'reminder' | 'notification'>('reminder');
    const [dismissedNotificationIds, setDismissedNotificationIds] = useState<Record<string, boolean>>({});
    const [dismissingTimelineMap, setDismissingTimelineMap] = useState<Record<string, boolean>>({});
    const [acceptSuccessMap, setAcceptSuccessMap] = useState<Record<string, boolean>>({});
    const [swipedNotificationId, setSwipedNotificationId] = useState<string | null>(null);
    const [dragOffsetX, setDragOffsetX] = useState(0);
    const listRef = useRef<HTMLDivElement | null>(null);
    const dragRef = useRef<{
        id: string;
        startX: number;
        startOffset: number;
        maxLeft: number;
        hasMoved: boolean;
    } | null>(null);

    const markDismissedWithAnimation = (timelineId: string) => {
        setDismissingTimelineMap((previous) => ({ ...previous, [timelineId]: true }));

        window.setTimeout(() => {
            setDismissedNotificationIds((previous) => ({ ...previous, [timelineId]: true }));
            setDismissingTimelineMap((previous) => {
                const next = { ...previous };
                delete next[timelineId];
                return next;
            });
            setAcceptSuccessMap((previous) => {
                const next = { ...previous };
                delete next[timelineId];
                return next;
            });
        }, 260);
    };

    const handleResolveFriendRequest = async (timelineId: string, requestId: string, action: 'accept' | 'reject') => {
        if (friendActionLoadingMap[requestId]) {
            return;
        }

        setFriendActionLoadingMap((previous) => ({ ...previous, [requestId]: true }));
        try {
            if (action === 'accept') {
                await onAcceptFriendRequest(requestId);
                setAcceptSuccessMap((previous) => ({ ...previous, [timelineId]: true }));
                window.setTimeout(() => markDismissedWithAnimation(timelineId), 280);
            } else {
                await onRejectFriendRequest(requestId);
                markDismissedWithAnimation(timelineId);
            }
        } finally {
            setFriendActionLoadingMap((previous) => ({ ...previous, [requestId]: false }));
        }
    };

    const handleResolveSharedFundInvite = async (timelineId: string, inviteId: string, action: 'accept' | 'reject') => {
        if (friendActionLoadingMap[inviteId]) {
            return;
        }

        setFriendActionLoadingMap((previous) => ({ ...previous, [inviteId]: true }));
        try {
            if (action === 'accept') {
                await onAcceptSharedFundInvite(inviteId);
                setAcceptSuccessMap((previous) => ({ ...previous, [timelineId]: true }));
                window.setTimeout(() => markDismissedWithAnimation(timelineId), 280);
            } else {
                await onRejectSharedFundInvite(inviteId);
                markDismissedWithAnimation(timelineId);
            }
        } finally {
            setFriendActionLoadingMap((previous) => ({ ...previous, [inviteId]: false }));
        }
    };

    const richestWalletId = useMemo(() => {
        const activeWallets = getActiveSortedWallets(wallets);
        if (activeWallets.length === 0) {
            return '';
        }

        return activeWallets.reduce((bestWallet, wallet) => {
            if (!bestWallet || wallet.balance > bestWallet.balance) {
                return wallet;
            }

            return bestWallet;
        }, activeWallets[0]).id;
    }, [wallets]);

    const sortedNotifications = useMemo(() => {
        return [...notifications].sort((left, right) => {
            const leftPaid = left.paymentStatus === 'paid' ? 0 : 1;
            const rightPaid = right.paymentStatus === 'paid' ? 0 : 1;

            if (leftPaid !== rightPaid) {
                return leftPaid - rightPaid;
            }

            if (left.nextDueAt !== right.nextDueAt) {
                return right.nextDueAt - left.nextDueAt;
            }

            return right.updatedAt - left.updatedAt;
        });
    }, [notifications]);

    const createStartMonthOptions = useMemo(() => {
        const options: Array<{ value: string; label: string }> = [];
        const now = new Date();

        for (let index = 0; index < 24; index += 1) {
            const current = new Date(now.getFullYear(), now.getMonth() + index, 1);
            options.push({
                value: String(current.getTime()),
                label: formatMonthYear(current.getMonth() + 1, current.getFullYear()),
            });
        }

        return options;
    }, []);

    const notificationTimeline = useMemo(() => {
        const messageItems = messageNotifications.map((item) => ({
            id: `msg-${item.id}`,
            type: 'message' as const,
            createdAt: item.createdAt,
            item,
        }));

        const friendItems = friendRequests.map((item) => ({
            id: `fr-${item.requestId}`,
            type: 'friend-request' as const,
            createdAt: item.createdAt,
            item,
        }));

        const sharedFundItems = sharedFundInvites.map((item) => ({
            id: `sf-${item.inviteId}`,
            type: 'shared-fund' as const,
            createdAt: item.createdAt,
            item,
        }));

        const sharedFundActivityItems = sharedFundActivities.map((item) => ({
            id: `sfa-${item.id}`,
            type: 'shared-fund-activity' as const,
            createdAt: item.createdAt,
            item,
        }));

        return [...messageItems, ...friendItems, ...sharedFundItems, ...sharedFundActivityItems]
            .filter((item) => !dismissedNotificationIds[item.id])
            .sort((left, right) => right.createdAt - left.createdAt);
    }, [dismissedNotificationIds, friendRequests, messageNotifications, sharedFundActivities, sharedFundInvites]);

    useEffect(() => {
        if (!createCategoryId) {
            setCreateCategoryId(expenseCategories[0]?.id || '');
        }
    }, [createCategoryId, expenseCategories]);

    useEffect(() => {
        if (!payWalletId) {
            setPayWalletId(richestWalletId);
        }
    }, [payWalletId, richestWalletId]);

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        if (listRef.current) {
            listRef.current.scrollTop = 0;
        }

        setSwipedNotificationId(null);
        setDragOffsetX(0);
    }, [activeSection, isOpen]);

    const handleNotificationPointerDown = (id: string, event: PointerEvent<HTMLDivElement>) => {
        const target = event.target as HTMLElement | null;
        if (target?.closest('button')) {
            return;
        }

        if (event.pointerType === 'mouse' && event.button !== 0) {
            return;
        }

        event.currentTarget.setPointerCapture(event.pointerId);
        const rowWidth = event.currentTarget.getBoundingClientRect().width;
        const maxLeft = Math.min(rowWidth / 2, rowWidth - 24);

        dragRef.current = {
            id,
            startX: event.clientX,
            startOffset: swipedNotificationId === id ? -NOTI_SWIPE_SNAP : 0,
            maxLeft,
            hasMoved: false,
        };

        if (swipedNotificationId !== id) {
            setSwipedNotificationId(null);
        }
    };

    const handleNotificationPointerMove = (id: string, event: PointerEvent<HTMLDivElement>) => {
        if (!dragRef.current || dragRef.current.id !== id) {
            return;
        }

        const delta = event.clientX - dragRef.current.startX;
        if (Math.abs(delta) > 8) {
            dragRef.current.hasMoved = true;
        }

        const next = Math.min(0, Math.max(-dragRef.current.maxLeft, dragRef.current.startOffset + delta));
        setDragOffsetX(next);
    };

    const handleNotificationPointerEnd = (id: string) => {
        if (!dragRef.current || dragRef.current.id !== id) {
            return;
        }

        if (Math.abs(dragOffsetX) > 12) {
            setSwipedNotificationId(id);
        } else {
            setSwipedNotificationId(null);
        }

        setDragOffsetX(0);
        dragRef.current = null;
    };

    const resetCreateModal = () => {
        setCreateCategoryId(expenseCategories[0]?.id || '');
        setCreateAmount('');
        setCreateDueDay('1');
        setCreateStartAt(String(getStartOfMonthTimestamp(Date.now())));
        setCreateActiveMonths('12');
        setCreateDescription('');
        setCreateTelegramChatId('');
        setCreateError('');
        setIsCreateModalOpen(false);
    };

    const closePayModal = () => {
        setSelectedNotification(null);
        setPayWalletId(richestWalletId);
        setPayDefaultAmount('');
        setPayAmount('');
        setPayError('');
        setIsSkipping(false);
        setIsUpdating(false);
    };

    const submitCreateNotification = async () => {
        const amountValue = parseInt(createAmount.replace(/\D/g, ''), 10) || 0;
        const dueDayValue = parseInt(createDueDay, 10);
        const startAtValue = parseInt(createStartAt, 10);
        const activeMonthsValue = parseInt(createActiveMonths, 10);

        if (!createCategoryId) {
            setCreateError('Vui lòng chọn danh mục chi tiêu.');
            return;
        }

        if (!Number.isFinite(amountValue) || amountValue <= 0) {
            setCreateError('Số tiền phải lớn hơn 0.');
            return;
        }

        if (!Number.isInteger(dueDayValue) || dueDayValue < 1 || dueDayValue > 31) {
            setCreateError('Ngày định kỳ phải từ 1 đến 31.');
            return;
        }

        if (!Number.isInteger(activeMonthsValue) || activeMonthsValue < 1 || activeMonthsValue > 240) {
            setCreateError('Số tháng nhắc phải từ 1 đến 240.');
            return;
        }

        if (!Number.isFinite(startAtValue) || startAtValue <= 0) {
            setCreateError('Tháng bắt đầu nhắc lịch không hợp lệ.');
            return;
        }

        setCreateError('');
        setIsCreating(true);

        try {
            await onCreateNotification({
                categoryId: createCategoryId,
                amount: amountValue,
                dueDay: dueDayValue,
                startAt: startAtValue,
                activeMonths: activeMonthsValue,
                description: createDescription.trim() || undefined,
                telegramChatId: userTelegramChatId?.trim() || createTelegramChatId.trim() || undefined,
            });
            resetCreateModal();
        } catch (error) {
            const responseData = (error as { response?: { data?: { message?: string; errors?: string[] } } })?.response?.data;
            setCreateError(
                responseData?.errors?.join(' ') || responseData?.message || 'Tạo nhắc lịch thanh toán thất bại.',
            );
        } finally {
            setIsCreating(false);
        }
    };

    const submitDeleteNotification = async (notificationId: string) => {
        if (deletingNotificationId || isDeleting) {
            return;
        }

        setDeletingNotificationId(notificationId);
        setIsDeleting(true);
        try {
            await onDeleteNotification(notificationId);
            if (selectedNotification?.id === notificationId) {
                closePayModal();
            }
        } catch (error) {
            setPayError(
                (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
                    'Xoá nhắc lịch thất bại.',
            );
        } finally {
            setDeletingNotificationId(null);
            setIsDeleting(false);
        }
    };

    const submitUpdateNotification = async () => {
        if (!selectedNotification) {
            return;
        }

        const nextAmount = payDefaultAmount
            ? parseInt(payDefaultAmount.replace(/\D/g, ''), 10) || 0
            : selectedNotification.amount;

        if (!Number.isFinite(nextAmount) || nextAmount <= 0) {
            setPayError('Số tiền mặc định phải lớn hơn 0.');
            return;
        }

        setPayError('');
        setIsUpdating(true);

        try {
            await onUpdateNotification(selectedNotification.id, { amount: nextAmount });
            closePayModal();
        } catch (error) {
            setPayError(
                (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
                    'Cập nhật nhắc lịch thất bại.',
            );
        } finally {
            setIsUpdating(false);
        }
    };

    const submitPayNotification = async () => {
        if (!selectedNotification) {
            return;
        }

        if (!payWalletId) {
            setPayError('Vui lòng chọn ví thanh toán.');
            return;
        }

        const amountValue = payAmount
            ? parseInt(payAmount.replace(/\D/g, ''), 10) || 0
            : selectedNotification.amount;
        const defaultAmountValue = payDefaultAmount
            ? parseInt(payDefaultAmount.replace(/\D/g, ''), 10) || 0
            : selectedNotification.amount;

        if (!Number.isFinite(amountValue) || amountValue <= 0) {
            setPayError('Số tiền phải lớn hơn 0.');
            return;
        }

        if (!Number.isFinite(defaultAmountValue) || defaultAmountValue <= 0) {
            setPayError('Số tiền mặc định phải lớn hơn 0.');
            return;
        }

        setPayError('');
        setIsPaying(true);

        try {
            await onPayNotification(selectedNotification.id, {
                walletId: payWalletId,
                amount: amountValue,
                defaultAmount: defaultAmountValue,
            });
            closePayModal();
        } catch (error) {
            setPayError(
                (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
                    'Thanh toán nhắc lịch thất bại.',
            );
        } finally {
            setIsPaying(false);
        }
    };

    const submitSkipNotification = async () => {
        if (!selectedNotification) {
            return;
        }

        setPayError('');
        setIsSkipping(true);

        const defaultAmountValue = payDefaultAmount
            ? parseInt(payDefaultAmount.replace(/\D/g, ''), 10) || 0
            : selectedNotification.amount;

        if (!Number.isFinite(defaultAmountValue) || defaultAmountValue <= 0) {
            setPayError('Số tiền mặc định phải lớn hơn 0.');
            setIsSkipping(false);
            return;
        }

        try {
            await onPayNotification(selectedNotification.id, {
                walletId: payWalletId || undefined,
                defaultAmount: defaultAmountValue,
                skipTransaction: true,
            });
            closePayModal();
        } catch (error) {
            setPayError(
                (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
                    'Bỏ qua tháng này thất bại.',
            );
        } finally {
            setIsSkipping(false);
        }
    };

    const isSelectedNotificationStarted = selectedNotification
        ? isNotificationStarted(selectedNotification)
        : true;
    const isSelectedNotificationPaid = selectedNotification?.paymentStatus === 'paid';
    const isPaymentActionDisabled = !isSelectedNotificationStarted || isSelectedNotificationPaid;

    return (
        <>
            <div
                onClick={onClose}
                style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(2, 8, 23, 0.5)',
                    backdropFilter: 'blur(4px)',
                    opacity: isOpen ? 1 : 0,
                    pointerEvents: isOpen ? 'auto' : 'none',
                    transition: 'opacity 0.22s ease',
                    zIndex: 44,
                }}
            />

            <aside
                style={{
                    position: 'fixed',
                    right: 0,
                    top: 0,
                    bottom: 0,
                    height: '100dvh',
                    width: 'min(90vw, 400px)',
                    padding: 16,
                    background: 'var(--surface-strong)',
                    borderLeft: '1px solid var(--border)',
                    transform: isOpen ? 'translateX(0)' : 'translateX(104%)',
                    transition: 'transform 0.26s ease',
                    zIndex: 45,
                    boxShadow: '0 24px 80px rgba(0,0,0,0.35)',
                    display: 'grid',
                    gridTemplateRows: 'auto 1fr auto',
                    gap: 12,
                    overflow: 'hidden',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <div style={{ color: 'var(--muted)', fontSize: 12 }}>Thông báo</div>
                        <div style={{ marginTop: 3, fontSize: 18, fontWeight: 900 }}>
                            {activeSection === 'reminder' ? 'Nhắc lịch thanh toán' : 'Thông báo'}
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            width: 38,
                            height: 38,
                            borderRadius: 12,
                            border: '1px solid var(--border)',
                            background: 'var(--surface-soft)',
                            color: 'var(--foreground)',
                        }}
                    >
                        <X size={18} />
                    </button>
                </div>

                <div style={{ display: 'flex', gap: 6, borderRadius: 10, background: 'var(--surface-soft)', padding: 4, alignSelf: 'start' }}>
                    <button
                        onClick={() => setActiveSection('reminder')}
                        type="button"
                        style={{
                            flex: 1,
                            minHeight: 32,
                            padding: '0 10px',
                            borderRadius: 8,
                            border: 'none',
                            background: activeSection === 'reminder' ? 'var(--chip-bg)' : 'transparent',
                            color: 'var(--foreground)',
                            fontWeight: 700,
                            fontSize: 11.5,
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                        }}
                    >
                        <CalendarClock size={12.5} /> Nhắc lịch
                    </button>
                    <button
                        onClick={() => setActiveSection('notification')}
                        type="button"
                        style={{
                            flex: 1,
                            minHeight: 32,
                            padding: '0 10px',
                            borderRadius: 8,
                            border: 'none',
                            background: activeSection === 'notification' ? 'var(--chip-bg)' : 'transparent',
                            color: 'var(--foreground)',
                            fontWeight: 700,
                            fontSize: 11.5,
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                        }}
                    >
                        <BellRing size={12.5} /> Thông báo
                    </button>
                </div>

                <AppCard
                    strong
                    style={{
                        padding: 12,
                        display: 'flex',
                        flexDirection: 'column',
                        minHeight: 0,
                        overflow: 'hidden',
                        height: '100%',
                    }}
                >
                    <div
                        ref={listRef}
                        style={{
                            display: 'grid',
                            gap: 10,
                            minHeight: 0,
                            flex: 1,
                            overflowY: 'auto',
                            alignContent: 'start',
                            gridAutoRows: 'max-content',
                            paddingRight: 2,
                            overflowAnchor: 'none',
                        }}
                    >
                        {activeSection === 'reminder' && isLoading ? (
                            <div style={{ display: 'grid', gap: 8 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--muted)', fontSize: 13 }}>
                                    <Clock3 size={14} /> Đang tải danh sách nhắc hạn...
                                </div>
                                {Array.from({ length: 3 }).map((_, index) => (
                                    <div
                                        key={`noti-skeleton-${index}`}
                                        style={{
                                            height: 68,
                                            borderRadius: 12,
                                            border: '1px solid var(--surface-border)',
                                            background: 'linear-gradient(90deg, color-mix(in srgb, var(--surface-soft) 84%, transparent) 0%, color-mix(in srgb, var(--surface-soft) 56%, var(--foreground)) 50%, color-mix(in srgb, var(--surface-soft) 84%, transparent) 100%)',
                                            backgroundSize: '220% 100%',
                                            animation: 'list-shimmer 0.95s ease infinite',
                                        }}
                                    />
                                ))}
                            </div>
                        ) : null}

                        {activeSection === 'reminder' && !isLoading && sortedNotifications.length === 0 ? (
                            <div
                                style={{
                                    borderRadius: 12,
                                    border: '1px dashed var(--surface-border)',
                                    padding: '16px 12px',
                                    color: 'var(--muted)',
                                    fontSize: 12.5,
                                    textAlign: 'center',
                                }}
                            >
                                Chưa có nhắc lịch thanh toán trong tháng.
                            </div>
                        ) : null}

                        {activeSection === 'notification' && notificationTimeline.length === 0 ? (
                            <div
                                style={{
                                    borderRadius: 12,
                                    border: '1px dashed var(--surface-border)',
                                    padding: '16px 12px',
                                    color: 'var(--muted)',
                                    fontSize: 12.5,
                                    textAlign: 'center',
                                }}
                            >
                                Không có thông báo nào.
                            </div>
                        ) : null}

                        {activeSection === 'notification' && notificationTimeline.map((timelineItem) => {
                            const isDraggingThis = dragRef.current?.id === timelineItem.id;
                            const isDismissing = Boolean(dismissingTimelineMap[timelineItem.id]);
                            const translateX = isDraggingThis
                                ? dragOffsetX
                                : swipedNotificationId === timelineItem.id
                                    ? -NOTI_SWIPE_SNAP
                                    : 0;
                            const showActions = isDraggingThis || swipedNotificationId === timelineItem.id || translateX < -1;

                            const senderId = timelineItem.type === 'message'
                                ? timelineItem.item.senderId
                                : timelineItem.type === 'friend-request'
                                    ? timelineItem.item.senderId
                                    : timelineItem.type === 'shared-fund'
                                        ? timelineItem.item.senderId
                                        : timelineItem.item.actorId;
                            const senderName = timelineItem.type === 'message'
                                ? timelineItem.item.senderName
                                : timelineItem.type === 'friend-request'
                                    ? timelineItem.item.senderName
                                    : timelineItem.type === 'shared-fund'
                                        ? timelineItem.item.senderName
                                        : timelineItem.item.actorName;
                            const senderUsername = timelineItem.type === 'message'
                                ? timelineItem.item.senderUsername
                                : timelineItem.type === 'friend-request'
                                    ? timelineItem.item.senderUsername
                                    : timelineItem.type === 'shared-fund'
                                        ? timelineItem.item.senderUsername
                                        : timelineItem.item.walletName;
                            const senderAvatar = timelineItem.type === 'message'
                                ? timelineItem.item.senderAvatarUrl
                                : timelineItem.type === 'friend-request'
                                    ? timelineItem.item.senderAvatarUrl
                                    : timelineItem.type === 'shared-fund'
                                        ? timelineItem.item.senderAvatarUrl
                                        : null;

                            const content = timelineItem.type === 'message'
                                ? timelineItem.item.content
                                : timelineItem.type === 'friend-request'
                                    ? 'đã gửi lời mời kết bạn cho bạn.'
                                    : timelineItem.type === 'shared-fund'
                                        ? `đã mời bạn tham gia quỹ ${timelineItem.item.walletName}.`
                                        : timelineItem.item.message;

                            const title = timelineItem.type === 'message'
                                ? 'tin nhắn mới'
                                : timelineItem.type === 'friend-request'
                                    ? 'lời mời kết bạn'
                                    : timelineItem.type === 'shared-fund'
                                        ? 'mời vào quỹ chung'
                                        : 'hoạt động quỹ';
                            const unreadCount = timelineItem.type === 'message'
                                ? timelineItem.item.unreadCount
                                : 0;

                            return (
                                <div
                                    key={timelineItem.id}
                                    style={{
                                        position: 'relative',
                                        borderRadius: 12,
                                        overflow: 'hidden',
                                        transition: 'opacity 220ms ease, transform 220ms ease, max-height 220ms ease, margin 220ms ease',
                                        opacity: isDismissing ? 0 : 1,
                                        transform: isDismissing ? 'translateX(26px)' : 'translateX(0)',
                                        maxHeight: isDismissing ? 0 : 280,
                                        margin: isDismissing ? 0 : undefined,
                                    }}
                                >
                                    <div
                                        style={{
                                            position: 'absolute',
                                            inset: 0,
                                            display: 'flex',
                                            justifyContent: 'flex-end',
                                            alignItems: 'center',
                                            gap: 6,
                                            padding: 6,
                                            background: 'var(--surface-soft)',
                                            border: '1px solid var(--surface-border)',
                                            opacity: showActions ? 1 : 0,
                                            pointerEvents: showActions ? 'auto' : 'none',
                                            transition: 'opacity 140ms ease',
                                        }}
                                    >
                                        {timelineItem.type === 'message' ? (
                                            <button
                                                type='button'
                                                onPointerDown={(event) => event.stopPropagation()}
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    onReplyMessageNotification(timelineItem.item.id, senderId);
                                                }}
                                                style={{
                                                    width: 58,
                                                    height: 34,
                                                    border: '1px solid rgba(59,130,246,0.35)',
                                                    borderRadius: 999,
                                                    background: 'rgba(59,130,246,0.14)',
                                                    color: '#2563eb',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontSize: 10.5,
                                                    fontWeight: 800,
                                                }}
                                                title='Trả lời'
                                            >
                                                TL
                                            </button>
                                            ) : null}
                                        <button
                                            type='button'
                                            onPointerDown={(event) => event.stopPropagation()}
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                if (timelineItem.type === 'message') {
                                                    markDismissedWithAnimation(timelineItem.id);
                                                    window.setTimeout(() => onHideMessageNotification(timelineItem.item.id), 260);
                                                    return;
                                                }

                                                markDismissedWithAnimation(timelineItem.id);
                                            }}
                                            style={{
                                                width: 58,
                                                height: 34,
                                                border: '1px solid rgba(239,68,68,0.35)',
                                                borderRadius: 999,
                                                background: 'rgba(239,68,68,0.14)',
                                                color: '#dc2626',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: 10.5,
                                                fontWeight: 800,
                                            }}
                                            title='Ẩn'
                                        >
                                            Ẩn
                                        </button>
                                    </div>

                                    <div
                                        onPointerDown={(event) => handleNotificationPointerDown(timelineItem.id, event)}
                                        onPointerMove={(event) => handleNotificationPointerMove(timelineItem.id, event)}
                                        onPointerUp={() => handleNotificationPointerEnd(timelineItem.id)}
                                        onPointerCancel={() => handleNotificationPointerEnd(timelineItem.id)}
                                        style={{
                                            position: 'relative',
                                            zIndex: 1,
                                            borderRadius: 12,
                                            border: '1px solid var(--surface-border)',
                                            background: 'var(--surface-soft)',
                                            padding: '10px 11px',
                                            display: 'grid',
                                            gap: 7,
                                            transform: `translateX(${translateX}px)`,
                                            transition: isDraggingThis ? 'none' : 'transform 180ms ease',
                                            touchAction: 'pan-y',
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                                            <UserAvatar src={senderAvatar || undefined} alt={senderName} size={30} />
                                            <div style={{ minWidth: 0, flex: 1 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <span style={{ fontWeight: 800, fontSize: 13.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{senderName}</span>
                                                    {unreadCount > 0 ? (
                                                        <span
                                                            style={{
                                                                minWidth: 20,
                                                                height: 20,
                                                                padding: '0 6px',
                                                                borderRadius: 999,
                                                                background: 'var(--accent)',
                                                                color: '#041018',
                                                                fontSize: 10.5,
                                                                fontWeight: 900,
                                                                display: 'grid',
                                                                placeItems: 'center',
                                                            }}
                                                        >
                                                            {unreadCount}
                                                        </span>
                                                    ) : null}
                                                    <span style={{ marginLeft: 'auto', color: 'var(--muted)', fontSize: 10.5 }}>{title}</span>
                                                </div>
                                                <div style={{ color: 'var(--muted)', fontSize: 11.5 }}>@{senderUsername || 'user'}</div>
                                            </div>
                                        </div>

                                        <div style={{ fontSize: 12.5, color: 'var(--foreground)' }}>{content}</div>

                                        {timelineItem.type === 'friend-request' ? (
                                            <div style={{ display: 'flex', gap: 8 }}>
                                                <button
                                                    type='button'
                                                    disabled={Boolean(friendActionLoadingMap[timelineItem.item.requestId])}
                                                    onPointerDown={(event) => event.stopPropagation()}
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        void handleResolveFriendRequest(timelineItem.id, timelineItem.item.requestId, 'accept');
                                                    }}
                                                    style={{
                                                        flex: 1,
                                                        borderRadius: 8,
                                                        border: '1px solid color-mix(in srgb, #22c55e 44%, var(--surface-border))',
                                                        background: acceptSuccessMap[timelineItem.id]
                                                            ? 'color-mix(in srgb, #22c55e 26%, var(--surface-soft))'
                                                            : 'transparent',
                                                        color: '#16a34a',
                                                        minHeight: 30,
                                                        fontWeight: 800,
                                                        fontSize: 11.5,
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        gap: 6,
                                                        transition: 'all 220ms ease',
                                                    }}
                                                >
                                                    {acceptSuccessMap[timelineItem.id] ? (
                                                        <>
                                                            <CheckCircle2 size={14} /> Đã kết bạn
                                                        </>
                                                    ) : (
                                                        'Chấp nhận'
                                                    )}
                                                </button>
                                                <button
                                                    type='button'
                                                    disabled={Boolean(friendActionLoadingMap[timelineItem.item.requestId])}
                                                    onPointerDown={(event) => event.stopPropagation()}
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        void handleResolveFriendRequest(timelineItem.id, timelineItem.item.requestId, 'reject');
                                                    }}
                                                    style={{
                                                        flex: 1,
                                                        borderRadius: 8,
                                                        border: '1px solid color-mix(in srgb, #ef4444 40%, var(--surface-border))',
                                                        background: 'transparent',
                                                        color: '#ef4444',
                                                        minHeight: 30,
                                                        fontWeight: 700,
                                                        fontSize: 11.5,
                                                    }}
                                                >
                                                    Từ chối
                                                </button>
                                            </div>
                                        ) : null}

                                        {timelineItem.type === 'shared-fund' ? (
                                            <div style={{ display: 'flex', gap: 8 }}>
                                                <button
                                                    type='button'
                                                    disabled={Boolean(friendActionLoadingMap[timelineItem.item.inviteId])}
                                                    onPointerDown={(event) => event.stopPropagation()}
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        void handleResolveSharedFundInvite(timelineItem.id, timelineItem.item.inviteId, 'accept');
                                                    }}
                                                    style={{
                                                        flex: 1,
                                                        borderRadius: 8,
                                                        border: '1px solid color-mix(in srgb, #22c55e 40%, var(--surface-border))',
                                                        background: acceptSuccessMap[timelineItem.id]
                                                            ? 'color-mix(in srgb, #22c55e 26%, var(--surface-soft))'
                                                            : 'transparent',
                                                        color: '#16a34a',
                                                        minHeight: 30,
                                                        fontWeight: 800,
                                                        fontSize: 11.5,
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        gap: 6,
                                                        transition: 'all 220ms ease',
                                                    }}
                                                >
                                                    {acceptSuccessMap[timelineItem.id] ? (
                                                        <>
                                                            <CheckCircle2 size={14} /> Đã chấp nhận
                                                        </>
                                                    ) : (
                                                        'Chấp nhận'
                                                    )}
                                                </button>
                                                <button
                                                    type='button'
                                                    disabled={Boolean(friendActionLoadingMap[timelineItem.item.inviteId])}
                                                    onPointerDown={(event) => event.stopPropagation()}
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        void handleResolveSharedFundInvite(timelineItem.id, timelineItem.item.inviteId, 'reject');
                                                    }}
                                                    style={{
                                                        flex: 1,
                                                        borderRadius: 8,
                                                        border: '1px solid color-mix(in srgb, #ef4444 40%, var(--surface-border))',
                                                        background: 'transparent',
                                                        color: '#ef4444',
                                                        minHeight: 30,
                                                        fontWeight: 700,
                                                        fontSize: 11.5,
                                                    }}
                                                >
                                                    Không chấp nhận
                                                </button>
                                            </div>
                                        ) : null}

                                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, color: 'var(--muted)', fontSize: 10.8 }}>
                                            <span>{formatNotificationTime(timelineItem.createdAt)}</span>
                                            <span>
                                                {timelineItem.type === 'message' && unreadCount > 1
                                                    ? `${unreadCount} tin chưa đọc`
                                                    : timelineItem.type === 'shared-fund'
                                                        ? 'Chọn chấp nhận hoặc không chấp nhận'
                                                        : timelineItem.type === 'shared-fund-activity'
                                                            ? 'Trượt trái để ẩn'
                                                        : 'Trượt trái để trả lời/ẩn'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}

                        {!isLoading && activeSection === 'reminder'
                            ? sortedNotifications.map((item) => {
                              const remainingDays = getRemainingDays(item.nextDueAt);
                                                            const visualStyle = getNotificationVisualStyle(item, remainingDays);

                              return (
                                  <div
                                      key={item.id}
                                                                            role='button'
                                                                            tabIndex={0}
                                      onClick={() => {
                                          setSelectedNotification(item);
                                          setPayWalletId(richestWalletId);
                                          setPayDefaultAmount(String(item.amount));
                                          setPayAmount(String(item.amount));
                                          setPayError('');
                                      }}
                                      onKeyDown={(event) => {
                                          if (event.key === 'Enter' || event.key === ' ') {
                                              event.preventDefault();
                                              setSelectedNotification(item);
                                              setPayWalletId(richestWalletId);
                                              setPayDefaultAmount(String(item.amount));
                                              setPayAmount(String(item.amount));
                                              setPayError('');
                                          }
                                      }}
                                      style={{
                                          display: 'grid',
                                          gridTemplateColumns: '1fr auto',
                                          gap: 10,
                                          padding: '11px 12px',
                                          borderRadius: 14,
                                          border: `1px solid ${visualStyle.rowBorder}`,
                                          background: visualStyle.rowBackground,
                                          alignItems: 'center',
                                          color: visualStyle.titleColor,
                                          textAlign: 'left',
                                          cursor: 'pointer',
                                      }}
                                  >
                                      <div style={{ minWidth: 0 }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 800, fontSize: 12.5, color: visualStyle.titleColor }}>
                                                  <BellRing size={12} color={visualStyle.iconColor} />
                                                  {item.categoryName}
                                              </span>
                                              <span
                                                  style={{
                                                      borderRadius: 999,
                                                      padding: '3px 7px',
                                                      fontSize: 10,
                                                      fontWeight: 800,
                                                      color: visualStyle.badgeColor,
                                                      background: visualStyle.badgeBackground,
                                                  }}
                                              >
                                                  {getStatusLabel(item)}
                                              </span>
                                          </div>

                                          <div
                                              style={{
                                                  marginTop: 4,
                                                  color: 'color-mix(in srgb, var(--muted) 88%, var(--foreground))',
                                                  fontSize: 11.5,
                                                  whiteSpace: 'nowrap',
                                                  overflow: 'hidden',
                                                  textOverflow: 'ellipsis',
                                              }}
                                          >
                                              {item.description || item.categoryName}
                                          </div>

                                          <div
                                              style={{
                                                  marginTop: 4,
                                                  display: 'flex',
                                                  alignItems: 'center',
                                                  gap: 6,
                                                  color: 'color-mix(in srgb, var(--muted) 86%, var(--foreground))',
                                                  fontSize: 11,
                                              }}
                                          >
                                              <CalendarClock size={12.5} />
                                              {formatDueDate(item.nextDueAt)} · ngày định kỳ {String(item.dueDay).padStart(2, '0')}
                                          </div>
                                      </div>

                                      <div style={{ textAlign: 'right' }}>
                                          <div
                                              style={{
                                                  fontWeight: 900,
                                                  fontSize: 'clamp(10.5px, 2.6vw, 12.5px)',
                                                  color: visualStyle.amountColor,
                                                  whiteSpace: 'nowrap',
                                                  maxWidth: 120,
                                                  overflow: 'hidden',
                                                  textOverflow: 'ellipsis',
                                              }}
                                          >
                                              {formatCurrencyVND(item.amount)}
                                          </div>
                                      </div>
                                  </div>
                              );
                          })
                            : null}
                        </div>
                </AppCard>

                <PrimaryButton
                    onClick={() => {
                        if (activeSection === 'reminder') {
                            setCreateCategoryId(expenseCategories[0]?.id || '');
                            setCreateDueDay('1');
                            setCreateStartAt(String(getStartOfMonthTimestamp(Date.now())));
                            setCreateActiveMonths('12');
                            setCreateAmount('');
                            setCreateDescription('');
                            setCreateTelegramChatId('');
                            setCreateError('');
                            setIsCreateModalOpen(true);
                        }
                    }}
                    disabled={activeSection === 'notification'}
                    style={{ justifyContent: 'center', minHeight: 44, opacity: activeSection === 'notification' ? 0.5 : 1 }}
                >
                    {activeSection === 'reminder' ? (
                        <>
                            <Plus size={16} /> Tạo nhắc lịch
                        </>
                    ) : (
                        'Không có tác vụ'
                    )}
                </PrimaryButton>
            </aside>

            {isCreateModalOpen ? (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 70,
                        background: 'rgba(2, 6, 23, 0.56)',
                        backdropFilter: 'blur(2px)',
                        display: 'grid',
                        placeItems: 'center',
                        padding: 16,
                    }}
                >
                    <AppCard strong style={{ width: 'min(100%, 380px)', padding: 16, borderRadius: 16, display: 'grid', gap: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                            <div>
                                <div style={{ fontSize: 15, fontWeight: 900 }}>Tạo nhắc lịch thanh toán</div>
                                <div style={{ marginTop: 3, color: 'var(--muted)', fontSize: 12.5 }}>Thiết lập khoản chi cố định theo tháng.</div>
                            </div>
                            <button
                                type="button"
                                onClick={resetCreateModal}
                                style={{
                                    width: 34,
                                    height: 34,
                                    borderRadius: 10,
                                    border: '1px solid var(--border)',
                                    background: 'var(--surface-soft)',
                                    color: 'var(--foreground)',
                                }}
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {createError ? (
                            <div style={{ color: '#ef4444', fontSize: 12, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)', borderRadius: 10, padding: '8px 10px' }}>
                                {createError}
                            </div>
                        ) : null}

                        <div style={{ display: 'grid', gap: 8 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>Danh mục chi tiêu</div>
                            <CustomSelect
                                value={createCategoryId}
                                onChange={setCreateCategoryId}
                                options={expenseCategories.map((category) => ({ value: category.id, label: category.name }))}
                                placeholder="Chọn danh mục"
                            />
                        </div>

                        <div style={{ display: 'grid', gap: 8 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>Số tiền</div>
                            <input
                                type="text"
                                inputMode="numeric"
                                value={
                                    createAmount
                                        ? new Intl.NumberFormat('vi-VN').format(parseInt(createAmount.replace(/\D/g, ''), 10) || 0)
                                        : ''
                                }
                                onChange={(event) => setCreateAmount(event.target.value.replace(/\D/g, ''))}
                                placeholder="0"
                                style={{
                                    padding: '10px 12px',
                                    borderRadius: 10,
                                    border: '1px solid var(--surface-border)',
                                    background: 'var(--surface-soft)',
                                    color: 'var(--foreground)',
                                    fontSize: 14,
                                }}
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                            <div style={{ display: 'grid', gap: 8 }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>Ngày định kỳ mỗi tháng</div>
                                <CustomSelect
                                    value={createDueDay}
                                    onChange={setCreateDueDay}
                                    options={Array.from({ length: 31 }).map((_, index) => ({
                                        value: String(index + 1),
                                        label: `Ngày ${String(index + 1).padStart(2, '0')}`,
                                    }))}
                                />
                            </div>
                            <div style={{ display: 'grid', gap: 8 }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>Bắt đầu nhắc từ tháng</div>
                                <CustomSelect
                                    value={createStartAt}
                                    onChange={setCreateStartAt}
                                    options={createStartMonthOptions}
                                />
                            </div>
                        </div>

                        <div style={{ display: 'grid', gap: 8 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>Nhắc trong bao nhiêu tháng</div>
                            <CustomSelect
                                value={createActiveMonths}
                                onChange={setCreateActiveMonths}
                                options={[1, 3, 6, 12, 24, 36, 60].map((month) => ({
                                    value: String(month),
                                    label: `${month} tháng`,
                                }))}
                            />
                        </div>

                        <div style={{ display: 'grid', gap: 8 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>Mô tả (tuỳ chọn)</div>
                            <input
                                type="text"
                                value={createDescription}
                                onChange={(event) => setCreateDescription(event.target.value)}
                                placeholder="Ví dụ: Thanh toán internet tháng"
                                style={{
                                    padding: '10px 12px',
                                    borderRadius: 10,
                                    border: '1px solid var(--surface-border)',
                                    background: 'var(--surface-soft)',
                                    color: 'var(--foreground)',
                                    fontSize: 14,
                                }}
                            />
                        </div>

                        {userTelegramChatId?.trim() ? (
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    borderRadius: 10,
                                    padding: '10px 12px',
                                    border: '1px solid color-mix(in srgb, #16a34a 48%, var(--surface-border))',
                                    background: 'color-mix(in srgb, #22c55e 10%, var(--surface-soft))',
                                    color: 'var(--foreground)',
                                    fontSize: 12.5,
                                    fontWeight: 700,
                                }}
                            >
                                <CheckCircle2 size={15} color="#16a34a" />
                                Telegram ID đã lưu trong hồ sơ người dùng.
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gap: 8 }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>Thêm Telegram ID để nhận thông báo </div>
                                <input
                                    type="text"
                                    value={createTelegramChatId}
                                    onChange={(event) => setCreateTelegramChatId(event.target.value)}
                                    placeholder="Ví dụ: 123456789 hoặc -1001234567890"
                                    style={{
                                        padding: '10px 12px',
                                        borderRadius: 10,
                                        border: '1px solid var(--surface-border)',
                                        background: 'var(--surface-soft)',
                                        color: 'var(--foreground)',
                                        fontSize: 14,
                                    }}
                                />
                            </div>
                        )}

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                            <button
                                type="button"
                                onClick={resetCreateModal}
                                disabled={isCreating}
                                style={{
                                    minHeight: 42,
                                    borderRadius: 12,
                                    border: '1px solid var(--border)',
                                    background: 'transparent',
                                    color: 'var(--foreground)',
                                    fontWeight: 700,
                                }}
                            >
                                Hủy
                            </button>
                            <PrimaryButton onClick={submitCreateNotification} disabled={isCreating} style={{ justifyContent: 'center', minHeight: 42 }}>
                                {isCreating ? 'Đang tạo...' : 'Tạo nhắc lịch'}
                            </PrimaryButton>
                        </div>
                    </AppCard>
                </div>
            ) : null}

            {selectedNotification ? (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 71,
                        background: 'rgba(2, 6, 23, 0.56)',
                        backdropFilter: 'blur(2px)',
                        display: 'grid',
                        placeItems: 'center',
                        padding: 16,
                    }}
                >
                    <AppCard strong style={{ width: 'min(100%, 380px)', padding: 16, borderRadius: 16, display: 'grid', gap: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                            <div>
                                <div style={{ fontSize: 15, fontWeight: 900 }}>Chi tiết nhắc lịch</div>
                                <div style={{ marginTop: 3, color: 'var(--muted)', fontSize: 12.5 }}>
                                    {isPaymentActionDisabled
                                        ? 'Khoản này chỉ hỗ trợ xoá ở trạng thái hiện tại.'
                                        : 'Chọn ví và điều chỉnh số tiền nếu cần.'}
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={closePayModal}
                                style={{
                                    width: 34,
                                    height: 34,
                                    borderRadius: 10,
                                    border: '1px solid var(--border)',
                                    background: 'var(--surface-soft)',
                                    color: 'var(--foreground)',
                                }}
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <div style={{ borderRadius: 12, border: '1px solid var(--surface-border)', background: 'var(--surface-soft)', padding: '12px 14px', display: 'grid', gap: 8 }}>
                            <div style={{ fontWeight: 800, fontSize: 14 }}>{selectedNotification.categoryName}</div>
                            <div style={{ color: 'var(--muted)', fontSize: 12 }}>{selectedNotification.description || selectedNotification.categoryName}</div>
                            <div style={{ color: 'var(--muted)', fontSize: 11.5 }}>Hạn tháng này: ngày {String(selectedNotification.dueDay).padStart(2, '0')}</div>
                            <div style={{ display: 'grid', gap: 6 }}>
                                <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--muted)' }}>Số tiền mặc định của nhắc lịch</div>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    value={
                                        payDefaultAmount
                                            ? new Intl.NumberFormat('vi-VN').format(parseInt(payDefaultAmount.replace(/\D/g, ''), 10) || 0)
                                            : ''
                                    }
                                    onChange={(event) => setPayDefaultAmount(event.target.value.replace(/\D/g, ''))}
                                    placeholder={new Intl.NumberFormat('vi-VN').format(selectedNotification.amount)}
                                    style={{
                                        padding: '8px 10px',
                                        borderRadius: 9,
                                        border: '1px solid var(--surface-border)',
                                        background: 'var(--surface-strong)',
                                        color: 'var(--foreground)',
                                        fontSize: 13,
                                        fontWeight: 700,
                                    }}
                                />
                            </div>
                        </div>

                        {payError ? (
                            <div style={{ color: '#ef4444', fontSize: 12, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)', borderRadius: 10, padding: '8px 10px' }}>
                                {payError}
                            </div>
                        ) : null}

                        {isPaymentActionDisabled ? (
                            <div style={{ color: 'var(--muted)', fontSize: 12, background: 'var(--surface-soft)', border: '1px solid var(--surface-border)', borderRadius: 10, padding: '8px 10px' }}>
                                {!isSelectedNotificationStarted
                                    ? 'Nhắc lịch này chưa tới tháng bắt đầu, bạn vẫn có thể xoá.'
                                    : 'Nhắc lịch tháng hiện tại đã thanh toán, bạn vẫn có thể xoá.'}
                            </div>
                        ) : null}

                        <div style={{ display: 'grid', gap: 8 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>Chọn ví thanh toán</div>
                            <CustomSelect
                                value={payWalletId}
                                onChange={setPayWalletId}
                                options={getActiveSortedWallets(wallets).map((wallet) => ({
                                    value: wallet.id,
                                    label: `${wallet.name} • ${formatCurrencyVND(wallet.balance)}`,
                                }))}
                                placeholder="Chọn ví"
                            />
                        </div>

                        <div style={{ display: 'grid', gap: 8 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>Số tiền thanh toán (tạo giao dịch)</div>
                            <input
                                type="text"
                                inputMode="numeric"
                                value={
                                    payAmount
                                        ? new Intl.NumberFormat('vi-VN').format(parseInt(payAmount.replace(/\D/g, ''), 10) || 0)
                                        : ''
                                }
                                onChange={(event) => setPayAmount(event.target.value.replace(/\D/g, ''))}
                                placeholder={new Intl.NumberFormat('vi-VN').format(selectedNotification.amount)}
                                style={{
                                    padding: '10px 12px',
                                    borderRadius: 10,
                                    border: '1px solid var(--surface-border)',
                                    background: 'var(--surface-soft)',
                                    color: 'var(--foreground)',
                                    fontSize: 14,
                                    fontWeight: 700,
                                }}
                            />
                            {payAmount && parseInt(payAmount.replace(/\D/g, ''), 10) !== selectedNotification.amount ? (
                                <div style={{ fontSize: 11, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                    Mặc định: {new Intl.NumberFormat('vi-VN').format(selectedNotification.amount)}₫
                                    <button
                                        type="button"
                                        onClick={() => setPayAmount(String(selectedNotification.amount))}
                                        style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 11, fontWeight: 700, cursor: 'pointer', padding: 0 }}
                                    >
                                        Khôi phục
                                    </button>
                                </div>
                            ) : null}
                        </div>

                        <div style={{ display: 'grid', gap: 6, marginTop: 2 }}>
                            <button
                                type="button"
                                onClick={() => { void submitDeleteNotification(selectedNotification.id); }}
                                disabled={isPaying || isSkipping || isDeleting || isUpdating}
                                style={{
                                    minHeight: 32,
                                    padding: '0 10px',
                                    borderRadius: 9,
                                    border: '1px solid color-mix(in srgb, #ef4444 44%, var(--surface-border))',
                                    background: 'color-mix(in srgb, #ef4444 8%, var(--surface-soft))',
                                    color: '#ef4444',
                                    fontWeight: 700,
                                    fontSize: 11,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 5,
                                    cursor: isDeleting || isPaying || isSkipping || isUpdating ? 'not-allowed' : 'pointer',
                                    opacity: isDeleting || isPaying || isSkipping || isUpdating ? 0.65 : 1,
                                    transition: 'opacity 150ms ease',
                                }}
                            >
                                <Trash2 size={13} />
                                {isDeleting ? 'Đang xoá...' : 'Xoá'}
                            </button>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                                <button
                                    type="button"
                                    onClick={() => { void submitUpdateNotification(); }}
                                    disabled={isPaying || isSkipping || isDeleting || isUpdating}
                                    style={{
                                        minHeight: 32,
                                        padding: '0 10px',
                                        borderRadius: 9,
                                        border: '1px solid color-mix(in srgb, #3b82f6 44%, var(--surface-border))',
                                        background: 'color-mix(in srgb, #3b82f6 9%, var(--surface-soft))',
                                        color: '#1d4ed8',
                                        fontWeight: 700,
                                        fontSize: 11,
                                        cursor: isPaying || isSkipping || isDeleting || isUpdating ? 'not-allowed' : 'pointer',
                                        opacity: isPaying || isSkipping || isDeleting || isUpdating ? 0.65 : 1,
                                        transition: 'opacity 150ms ease',
                                    }}
                                >
                                    {isUpdating ? 'Đang lưu...' : 'Lưu sửa'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { void submitSkipNotification(); }}
                                    disabled={isPaymentActionDisabled || isPaying || isSkipping || isDeleting || isUpdating}
                                    style={{
                                        minHeight: 32,
                                        padding: '0 10px',
                                        borderRadius: 9,
                                        border: '1px solid color-mix(in srgb, #f59e0b 44%, var(--surface-border))',
                                        background: 'color-mix(in srgb, #f59e0b 9%, var(--surface-soft))',
                                        color: '#b45309',
                                        fontWeight: 700,
                                        fontSize: 11,
                                        cursor: isPaymentActionDisabled || isPaying || isSkipping || isDeleting || isUpdating ? 'not-allowed' : 'pointer',
                                        opacity: isPaymentActionDisabled || isPaying || isSkipping || isDeleting || isUpdating ? 0.65 : 1,
                                        transition: 'opacity 150ms ease',
                                    }}
                                >
                                    {isSkipping ? 'Đang bỏ qua...' : 'Bỏ qua'}
                                </button>
                                <PrimaryButton
                                    onClick={submitPayNotification}
                                    disabled={isPaymentActionDisabled || isPaying || isSkipping || isDeleting || isUpdating}
                                    style={{ justifyContent: 'center', minHeight: 32, fontSize: 11.5, gap: 5 }}
                                >
                                    {isPaying ? <span>Đang thanh toán...</span> : <><CheckCircle2 size={13} /> Trả</>}
                                </PrimaryButton>
                            </div>
                        </div>
                    </AppCard>
                </div>
            ) : null}
        </>
    );
}
