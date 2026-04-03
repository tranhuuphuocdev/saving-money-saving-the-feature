'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Bell, CircleDollarSign, Eye, EyeOff, LoaderCircle, MoonStar, Sparkles, SunMedium, TriangleAlert } from 'lucide-react';
import { AppCard } from '@/components/common/app-card';
import { IconButton } from '@/components/common/icon-button';
import { BottomNav } from '@/components/navigation/bottom-nav';
import { NotificationDrawer } from '@/components/navigation/notification-drawer';
import { SideDrawer } from '@/components/navigation/side-drawer';
import { ExpenseDonutCard } from '@/features/dashboard/components/charts/expense-donut-card';
import { FriendsTab } from '@/features/dashboard/components/friends-tab';
import { InitialWalletSetupModal } from '@/features/dashboard/components/initial-wallet-setup-modal';
import { SavingsRingCard } from '@/features/dashboard/components/charts/savings-ring-card';
import { SpendingTrendCard } from '@/features/dashboard/components/charts/spending-trend-card';
import { RecentTransactionsCard } from '@/features/dashboard/components/recent-transactions-card';
import { WalletHistoryTab } from '@/features/dashboard/components/wallet-history-tab';
import { CalendarShell } from '@/features/calendar/components/calendar-shell';
import { TransactionsTab } from '@/features/dashboard/components/transactions-tab';
import { ChatTab } from '@/features/dashboard/components/journal-tab';
import { FloatingTransactionBubble } from '@/components/common/floating-transaction-bubble';
import { getCategoriesRequest, queryTransactionsRequest, getSavingsRateRequest, getSpendingTrendRequest } from '@/lib/calendar/api';
import { formatCurrencyVND } from '@/lib/formatters';
import {
    acceptFriendRequestRequest,
    getConversationsRequest,
    getPendingFriendRequestsRequest,
    rejectFriendRequestRequest,
} from '@/lib/messages/api';
import { createNotificationRequest, deleteNotificationRequest, getNotificationsRequest, payNotificationRequest } from '@/lib/notifications/api';
import { getIncomingSharedFundInvitesRequest, acceptSharedFundInviteRequest, rejectSharedFundInviteRequest } from '@/lib/shared-fund/api';
import {
    offFriendRequestReceived,
    offFriendRequestResolved,
    offMessageReceived,
    offSharedFundActivity,
    offSharedFundInviteReceived,
    offSharedFundInviteResolved,
    onFriendRequestReceived,
    onFriendRequestResolved,
    onMessageReceived,
    onSharedFundActivity,
    onSharedFundInviteReceived,
    onSharedFundInviteResolved,
} from '@/lib/socket-io';
import { useBalanceVisible } from '@/lib/ui/use-balance-visible';
import { useAuth } from '@/providers/auth-provider';
import { useTheme } from '@/providers/theme-provider';
import { ICategoryItem } from '@/types/calendar';
import { IExpenseCategoryItem, IRecentTransaction, ISavingsRateData, ISpendingTrendData, TypeDashboardTab } from '@/types/dashboard';
import { IConversation, IDirectMessage, IFriendRequest } from '@/types/messages';
import { ICreateNotificationPayload, IMessageNotificationItem, INotificationItem, IPayNotificationPayload, ISharedFundActivityNotificationItem } from '@/types/notification';
import { ISharedFundInviteItem } from '@/types/shared-fund';

function PlaceholderPanel({ title, description }: { title: string; description: string }) {
    return (
        <AppCard strong style={{ padding: 16 }}>
            <div style={{ fontSize: 16, fontWeight: 800 }}>{title}</div>
            <div style={{ marginTop: 8, color: 'var(--muted)', lineHeight: 1.65, fontSize: 13 }}>{description}</div>
        </AppCard>
    );
}

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

function getDashboardTabFromSearch(tab: string | null): TypeDashboardTab {
    if (tab === 'transactions' || tab === 'calendar' || tab === 'wallets' || tab === 'chat' || tab === 'friends') {
        return tab;
    }

    return 'dashboard';
}

function buildMessageNotificationFromConversation(conversation: IConversation): IMessageNotificationItem {
    return {
        id: `inbox-${conversation.friendId}`,
        senderId: conversation.friendId,
        senderName: conversation.friendName,
        senderUsername: conversation.friendUsername,
        senderAvatarUrl: conversation.friendAvatarUrl,
        content: conversation.lastMessage,
        createdAt: conversation.lastMessageTime,
        unreadCount: conversation.unreadCount,
    };
}

export function DashboardShell() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const initialActiveTab = getDashboardTabFromSearch(searchParams.get('tab'));
    const { isAuthenticated, isLoading, logout, refreshWallets, user, totalWalletBalance, wallets, requiresInitialWalletSetup, initializeWalletSetup } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const { isVisible: isBalanceVisible, toggle: toggleBalance } = useBalanceVisible();
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<TypeDashboardTab>(initialActiveTab);
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
    const [isNotificationOpen, setIsNotificationOpen] = useState(false);
    const [isRecurringLoading, setIsRecurringLoading] = useState(false);
    const [paymentNotifications, setPaymentNotifications] = useState<INotificationItem[]>([]);
    const [pendingFriendRequests, setPendingFriendRequests] = useState<IFriendRequest[]>([]);
    const [sharedFundInvites, setSharedFundInvites] = useState<ISharedFundInviteItem[]>([]);
    const [sharedFundActivities, setSharedFundActivities] = useState<ISharedFundActivityNotificationItem[]>([]);
    const [messageNotifications, setMessageNotifications] = useState<IMessageNotificationItem[]>([]);
    const [expenseNotificationCategories, setExpenseNotificationCategories] = useState<ICategoryItem[]>([]);
    const [isPaymentNotificationsLoading, setIsPaymentNotificationsLoading] = useState(false);
    const [isFirstCalendarLoading, setIsFirstCalendarLoading] = useState(false);
    const [isCalendarVisible, setIsCalendarVisible] = useState(true);
    const [recentTransactions, setRecentTransactions] = useState<IRecentTransaction[]>([]);
    const [expenseCategories, setExpenseCategories] = useState<IExpenseCategoryItem[]>([]);
    const [monthLabel, setMonthLabel] = useState('');
    const [savingsMetrics, setSavingsMetrics] = useState<ISavingsRateData | null>(null);
    const [spendingTrendData, setSpendingTrendData] = useState<ISpendingTrendData | null>(null);
    const [initialSetupError, setInitialSetupError] = useState('');
    const [isInitialSetupSubmitting, setIsInitialSetupSubmitting] = useState(false);
    const firstCalendarDelayTimerRef = useRef<number | null>(null);
    const calendarRevealTimerRef = useRef<number | null>(null);

    const QUERY_LIMIT = 100;
    const requestedTab = searchParams.get('tab');
    const requestedPanel = searchParams.get('panel');
    const requestedFriendId = searchParams.get('friendId') || '';
    const requestedWalletId = searchParams.get('walletId') || undefined;
    const isDrawerView = searchParams.get('view') === 'drawer';

    const chartPalette = [
        '#f59e0b',
        '#10b981',
        '#f43f5e',
        '#8b5cf6',
        '#06b6d4',
        '#eab308',
        '#22c55e',
        '#ef4444',
        '#6366f1',
    ];

    const fetchPaymentNotifications = useCallback(async () => {
        setIsPaymentNotificationsLoading(true);

        try {
            const [categoryItems, notificationItems] = await Promise.all([
                getCategoriesRequest('expense'),
                getNotificationsRequest(),
            ]);

            setExpenseNotificationCategories(categoryItems.filter((item) => item.type === 'expense'));
            setPaymentNotifications(notificationItems);
        } catch {
            setExpenseNotificationCategories([]);
            setPaymentNotifications([]);
        } finally {
            setIsPaymentNotificationsLoading(false);
        }
    }, []);

    const fetchPendingFriendRequests = useCallback(async () => {
        try {
            const requestItems = await getPendingFriendRequestsRequest();
            setPendingFriendRequests(requestItems);
        } catch {
            setPendingFriendRequests([]);
        }
    }, []);

    const fetchSharedFundInvites = useCallback(async () => {
        try {
            const inviteItems = await getIncomingSharedFundInvitesRequest();
            setSharedFundInvites(inviteItems.filter((item) => item.status === 'pending'));
        } catch {
            setSharedFundInvites([]);
        }
    }, []);

    const fetchUnreadMessageNotifications = useCallback(async () => {
        try {
            const conversationItems = await getConversationsRequest();
            const unreadItems = conversationItems
                .filter((item) => item.unreadCount > 0)
                .filter((item) => !(activeTab === 'friends' && requestedFriendId === item.friendId))
                .map(buildMessageNotificationFromConversation)
                .sort((left, right) => right.createdAt - left.createdAt)
                .slice(0, 30);

            setMessageNotifications(unreadItems);
        } catch {
            setMessageNotifications([]);
        }
    }, [activeTab, requestedFriendId]);

    const fetchRecentTransactions = useCallback(async () => {
        try {
            const now = new Date();
            const from = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
            const to = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime() - 1;
            setIsRecurringLoading(true);

            const fetchMonthTransactions = async () => {
                let page = 1;
                let hasMore = true;
                const allItems: Awaited<ReturnType<typeof queryTransactionsRequest>>['items'] = [];

                while (hasMore) {
                    const pageResult = await queryTransactionsRequest({
                        page,
                        limit: QUERY_LIMIT,
                        startTime: from,
                        endTime: to,
                    });

                    allItems.push(...pageResult.items);
                    hasMore = pageResult.hasMore;
                    page += 1;
                }

                return allItems;
            };

            const [categoryItems, recentResult, monthItems, historyResult, savingsData, trendData] = await Promise.all([
                getCategoriesRequest(),
                queryTransactionsRequest({ page: 1, limit: 5 }),
                fetchMonthTransactions(),
                queryTransactionsRequest({ page: 1, limit: 80 }),
                getSavingsRateRequest({ month: now.getMonth() + 1, year: now.getFullYear() }),
                getSpendingTrendRequest({ month: now.getMonth() + 1, year: now.getFullYear() }),
            ]);

            const categoryNameMap = categoryItems.reduce<Record<string, string>>((acc, item) => {
                acc[item.id] = item.name;
                return acc;
            }, {});

            setRecentTransactions(
                recentResult.items.map((transaction) => ({
                    id: transaction.id,
                    amount: transaction.amount,
                    category: categoryNameMap[transaction.category] || transaction.category,
                    description: transaction.description,
                    transactionType: transaction.type,
                    timestamp: transaction.timestamp,
                })),
            );

            const recurringGroupMap = historyResult.items
                .filter((item) => item.type === 'expense')
                .reduce<
                    Record<
                        string,
                        {
                            categoryId: string;
                            description: string;
                            timestamps: number[];
                            totalAmount: number;
                            count: number;
                        }
                    >
                >((acc, item) => {
                    const normalizedDescription = (item.description || 'Chi tiêu định kỳ').trim() || 'Chi tiêu định kỳ';
                    const groupKey = `${item.category}::${normalizedDescription.toLowerCase()}`;

                    if (!acc[groupKey]) {
                        acc[groupKey] = {
                            categoryId: item.category,
                            description: normalizedDescription,
                            timestamps: [],
                            totalAmount: 0,
                            count: 0,
                        };
                    }

                    acc[groupKey].timestamps.push(item.timestamp);
                    acc[groupKey].totalAmount += item.amount;
                    acc[groupKey].count += 1;

                    return acc;
                }, {});

            const recurringItems = Object.entries(recurringGroupMap)
                .map(([groupKey, groupValue]) => {
                    const sortedTimestamps = [...groupValue.timestamps].sort((left, right) => left - right);
                    const latestTimestamp = sortedTimestamps[sortedTimestamps.length - 1];

                    const intervalDays =
                        sortedTimestamps.length >= 2
                            ? Math.max(
                                  7,
                                  Math.min(
                                      45,
                                      Math.round(
                                          sortedTimestamps
                                              .slice(1)
                                              .reduce((sum, timestamp, index) => {
                                                  return sum + (timestamp - sortedTimestamps[index]) / DAY_IN_MILLISECONDS;
                                              }, 0) /
                                              (sortedTimestamps.length - 1),
                                      ),
                                  ),
                              )
                            : 30;

                    const nextDueAt = latestTimestamp + intervalDays * DAY_IN_MILLISECONDS;
                    const remainingDays = Math.ceil((nextDueAt - Date.now()) / DAY_IN_MILLISECONDS);
                    const frequencyLabel = intervalDays <= 10 ? 'Chu kỳ tuần' : intervalDays <= 20 ? 'Nửa tháng' : 'Chu kỳ tháng';

                    return {
                        id: groupKey,
                        category: categoryNameMap[groupValue.categoryId] || groupValue.categoryId,
                        description: groupValue.description,
                        estimatedAmount: Math.round(groupValue.totalAmount / groupValue.count),
                        nextDueAt,
                        remainingDays,
                        frequencyLabel,
                        transactionCount: groupValue.count,
                    };
                })
                .filter((item) => item.transactionCount >= 2)
                .filter((item) => item.remainingDays <= 21 && item.remainingDays >= -14)
                .sort((left, right) => left.remainingDays - right.remainingDays)
                .slice(0, 8)
                .map(({ transactionCount: _, ...item }) => item);

            const expenseTransactions = monthItems.filter((item) => item.type === 'expense');
            const totalExpense = expenseTransactions.reduce((sum, item) => sum + item.amount, 0);
            const expenseByCategory = expenseTransactions.reduce<Record<string, number>>((acc, item) => {
                acc[item.category] = (acc[item.category] || 0) + item.amount;
                return acc;
            }, {});

            const computedCategories = Object.entries(expenseByCategory)
                .sort((a, b) => b[1] - a[1])
                .map(([categoryId, amount], index) => ({
                    id: categoryId,
                    label: categoryNameMap[categoryId] || categoryId,
                    amount,
                    percentage: totalExpense > 0 ? (amount / totalExpense) * 100 : 0,
                    color: chartPalette[index % chartPalette.length],
                }));

            setExpenseCategories(computedCategories);

            setSavingsMetrics(savingsData);
            setSpendingTrendData(trendData);
            setMonthLabel(
                `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`,
            );
        } catch {
            setRecentTransactions([]);
            setExpenseCategories([]);
            setSavingsMetrics(null);
            setSpendingTrendData(null);
        } finally {
            setIsRecurringLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            router.replace('/login');
        }
    }, [isAuthenticated, isLoading, router]);

    useEffect(() => {
        if (!requestedTab) {
            return;
        }

        setActiveTab(getDashboardTabFromSearch(requestedTab));
    }, [requestedTab]);

    useEffect(() => {
        if (requestedPanel !== 'menu') {
            return;
        }

        setActiveTab('dashboard');
        setIsDrawerOpen(true);
        router.replace('/dashboard');
    }, [requestedPanel, router]);

    useEffect(() => {
        if (!isAuthenticated) {
            setMessageNotifications([]);
            return;
        }

        void fetchRecentTransactions();
        void fetchPaymentNotifications();
        void fetchPendingFriendRequests();
        void fetchSharedFundInvites();
        void fetchUnreadMessageNotifications();
    }, [fetchPaymentNotifications, fetchPendingFriendRequests, fetchRecentTransactions, fetchSharedFundInvites, fetchUnreadMessageNotifications, isAuthenticated]);

    useEffect(() => {
        const handler = () => void fetchRecentTransactions();
        const notificationHandler = () => void fetchPaymentNotifications();
        window.addEventListener('transaction:changed', handler);
        window.addEventListener('savings-goal:changed', handler);
        window.addEventListener('notification:changed', notificationHandler);
        return () => {
            window.removeEventListener('transaction:changed', handler);
            window.removeEventListener('savings-goal:changed', handler);
            window.removeEventListener('notification:changed', notificationHandler);
        };
    }, [fetchPaymentNotifications, fetchRecentTransactions]);

    useEffect(() => {
        if (!isAuthenticated) {
            return;
        }

        const friendRequestHandler = () => void fetchPendingFriendRequests();
        const sharedFundHandler = () => void fetchSharedFundInvites();
        const sharedFundActivityHandler = (item: ISharedFundActivityNotificationItem) => {
            setSharedFundActivities((previous) => [item, ...previous.filter((current) => current.id !== item.id)].slice(0, 30));
        };
        onFriendRequestReceived(friendRequestHandler);
        onFriendRequestResolved(friendRequestHandler);
        onSharedFundInviteReceived(sharedFundHandler);
        onSharedFundInviteResolved(sharedFundHandler);
        onSharedFundActivity(sharedFundActivityHandler);

        const intervalId = window.setInterval(() => {
            void fetchPendingFriendRequests();
            void fetchSharedFundInvites();
        }, 10000);

        return () => {
            offFriendRequestReceived(friendRequestHandler);
            offFriendRequestResolved(friendRequestHandler);
            offSharedFundInviteReceived(sharedFundHandler);
            offSharedFundInviteResolved(sharedFundHandler);
            offSharedFundActivity(sharedFundActivityHandler);
            window.clearInterval(intervalId);
        };
    }, [fetchPendingFriendRequests, fetchSharedFundInvites, isAuthenticated]);

    useEffect(() => {
        const handleMessageNotification = async (message: IDirectMessage) => {
            if (!user?.id || message.senderId === user.id) {
                return;
            }

            if (activeTab === 'friends' && requestedFriendId === message.senderId) {
                return;
            }

            let senderName = 'Bạn bè';
            let senderUsername = '';
            let senderAvatarUrl: string | null = null;

            try {
                const conversationItems = await getConversationsRequest();
                const senderConversation = conversationItems.find((item) => item.friendId === message.senderId);
                if (senderConversation) {
                    senderName = senderConversation.friendName;
                    senderUsername = senderConversation.friendUsername;
                    senderAvatarUrl = senderConversation.friendAvatarUrl;
                }
            } catch {
                // Keep fallback sender info when conversation metadata cannot be loaded.
            }

            setMessageNotifications((previous) => {
                const existingItem = previous.find((item) => item.senderId === message.senderId);
                const nextItem: IMessageNotificationItem = {
                    id: existingItem?.id || `inbox-${message.senderId}`,
                    senderId: message.senderId,
                    senderName,
                    senderUsername,
                    senderAvatarUrl,
                    content: message.content,
                    createdAt: message.createdAt,
                    unreadCount: Math.max((existingItem?.unreadCount || 0) + 1, 1),
                };

                return [nextItem, ...previous.filter((item) => item.senderId !== message.senderId)]
                    .sort((left, right) => right.createdAt - left.createdAt)
                    .slice(0, 30);
            });
        };

        onMessageReceived(handleMessageNotification);
        return () => {
            offMessageReceived(handleMessageNotification);
        };
    }, [activeTab, requestedFriendId, user?.id]);

    useEffect(() => {
        if (activeTab !== 'friends' || !requestedFriendId) {
            return;
        }

        setMessageNotifications((previous) => previous.filter((item) => item.senderId !== requestedFriendId));
    }, [activeTab, requestedFriendId]);

    const handleCreatePaymentNotification = useCallback(
        async (payload: ICreateNotificationPayload) => {
            await createNotificationRequest(payload);
            window.dispatchEvent(new CustomEvent('notification:changed'));
        },
        [],
    );

    const handlePayPaymentNotification = useCallback(
        async (notificationId: string, payload: IPayNotificationPayload) => {
            await payNotificationRequest(notificationId, payload);
            await refreshWallets();
            window.dispatchEvent(new CustomEvent('notification:changed'));
            window.dispatchEvent(new CustomEvent('transaction:changed'));
        },
        [refreshWallets],
    );

    const handleDeletePaymentNotification = useCallback(
        async (notificationId: string) => {
            await deleteNotificationRequest(notificationId);
            window.dispatchEvent(new CustomEvent('notification:changed'));
        },
        [],
    );

    const handleAcceptFriendRequest = useCallback(async (requestId: string) => {
        await acceptFriendRequestRequest(requestId);
        await fetchPendingFriendRequests();
    }, [fetchPendingFriendRequests]);

    const handleRejectFriendRequest = useCallback(async (requestId: string) => {
        await rejectFriendRequestRequest(requestId);
        await fetchPendingFriendRequests();
    }, [fetchPendingFriendRequests]);

    const handleAcceptSharedFundInvite = useCallback(async (inviteId: string) => {
        await acceptSharedFundInviteRequest(inviteId);
        await Promise.all([fetchSharedFundInvites(), refreshWallets()]);
    }, [fetchSharedFundInvites, refreshWallets]);

    const handleRejectSharedFundInvite = useCallback(async (inviteId: string) => {
        await rejectSharedFundInviteRequest(inviteId);
        await fetchSharedFundInvites();
    }, [fetchSharedFundInvites]);

    const handleReplyMessageNotification = useCallback((notificationId: string, senderId: string) => {
        setMessageNotifications((previous) => previous.filter((item) => item.id !== notificationId));

        const nextSearchParams = new URLSearchParams();
        nextSearchParams.set('tab', 'friends');
        nextSearchParams.set('friendId', senderId);
        router.replace(`/dashboard?${nextSearchParams.toString()}`);
        setActiveTab('friends');
        setIsNotificationOpen(false);
    }, [router]);

    const handleHideMessageNotification = useCallback((notificationId: string) => {
        setMessageNotifications((previous) => previous.filter((item) => item.id !== notificationId));
    }, []);

    useEffect(() => {
        return () => {
            if (firstCalendarDelayTimerRef.current) {
                window.clearTimeout(firstCalendarDelayTimerRef.current);
            }
            if (calendarRevealTimerRef.current) {
                window.clearTimeout(calendarRevealTimerRef.current);
            }
        };
    }, []);

    const dashboardContent = (
        <div style={{ display: 'grid', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
                <ExpenseDonutCard monthLabel={monthLabel} categories={expenseCategories} />
                <SavingsRingCard
                    savingRate={savingsMetrics?.savingsRate ?? 0}
                    projectedSaving={savingsMetrics?.projectedSaving ?? 0}
                    avgDailyAllowance={savingsMetrics?.avgDailyAllowance ?? 0}
                    avgDailyExpense={savingsMetrics?.avgDailyExpense ?? 0}
                />
            </div>
            <SpendingTrendCard data={spendingTrendData} isLoading={isRecurringLoading} />
            <RecentTransactionsCard transactions={recentTransactions} />
        </div>
    );

    let content = dashboardContent;

    if (activeTab === 'transactions') {
        content = <TransactionsTab />;
    } else if (activeTab === 'chat') {
        content = <ChatTab />;
    } else if (activeTab === 'friends') {
        content = <FriendsTab />;
    } else if (activeTab === 'calendar') {
        content = (
            <div style={{ position: 'relative' }}>
                {isFirstCalendarLoading ? (
                    <AppCard
                        strong
                        style={{
                            padding: 16,
                            marginBottom: 12,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            color: 'var(--foreground)',
                            fontSize: 13,
                        }}
                    >
                        <LoaderCircle size={18} className="spin" /> Đang tải lịch giao dịch...
                    </AppCard>
                ) : null}

                <div
                    style={{
                        opacity: isCalendarVisible ? 1 : 0,
                        transform: isCalendarVisible ? 'translateY(0)' : 'translateY(4px)',
                        transition: 'opacity 220ms ease, transform 220ms ease',
                        pointerEvents: isFirstCalendarLoading ? 'none' : 'auto',
                    }}
                >
                    <CalendarShell />
                </div>
            </div>
        );
    } else if (activeTab === 'wallets') {
        content = <WalletHistoryTab wallets={wallets} preferredWalletId={requestedWalletId} />;
    }

    const handleOpenWalletHistory = useCallback((walletId?: string) => {
        const nextSearchParams = new URLSearchParams();
        nextSearchParams.set('tab', 'wallets');
        nextSearchParams.set('view', 'drawer');

        if (walletId) {
            nextSearchParams.set('walletId', walletId);
        }

        router.replace(`/dashboard?${nextSearchParams.toString()}`);
        setActiveTab('wallets');
    }, [router]);

    const handleOpenFriendsTab = useCallback(() => {
        const nextSearchParams = new URLSearchParams();
        nextSearchParams.set('tab', 'friends');
        router.replace(`/dashboard?${nextSearchParams.toString()}`);
        setActiveTab('friends');
    }, [router]);

    const handleOpenSharedFunds = useCallback(() => {
        router.push('/profile?tab=funds');
    }, [router]);

    async function handleConfirmLogout() {
        setIsLogoutConfirmOpen(false);
        setIsLoggingOut(true);

        try {
            await logout();
            router.replace('/login');
        } finally {
            setIsLoggingOut(false);
        }
    }

    async function handleInitialWalletSetup(payload: { wallets: Array<{ walletId: string; balance: number }> }) {
        setInitialSetupError('');
        setIsInitialSetupSubmitting(true);

        try {
            await initializeWalletSetup(payload);
            await refreshWallets();
        } catch (error) {
            const responseMessage =
                (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
                'Thiết lập số dư khởi tạo thất bại.';
            setInitialSetupError(responseMessage);
        } finally {
            setIsInitialSetupSubmitting(false);
        }
    }

    async function handleNavSelect(tab: TypeDashboardTab) {
        if (tab === 'menu') {
            setIsDrawerOpen(true);
            return;
        }

        if (tab !== 'calendar') {
            if (firstCalendarDelayTimerRef.current) {
                window.clearTimeout(firstCalendarDelayTimerRef.current);
            }
            if (calendarRevealTimerRef.current) {
                window.clearTimeout(calendarRevealTimerRef.current);
            }
        }

        if (tab === 'calendar' && activeTab !== 'calendar') {
            setIsFirstCalendarLoading(true);
            setIsCalendarVisible(false);

            if (firstCalendarDelayTimerRef.current) {
                window.clearTimeout(firstCalendarDelayTimerRef.current);
            }
            if (calendarRevealTimerRef.current) {
                window.clearTimeout(calendarRevealTimerRef.current);
            }

            firstCalendarDelayTimerRef.current = window.setTimeout(() => {
                setIsFirstCalendarLoading(false);
                calendarRevealTimerRef.current = window.setTimeout(() => {
                    setIsCalendarVisible(true);
                }, 24);
            }, 360);
        } else if (tab === 'calendar') {
            setIsCalendarVisible(true);
        }

        setActiveTab(tab);
    }

    if (isLoading) {
        return (
            <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#dbeafe', fontSize: 14 }}>
                    <LoaderCircle size={20} className="spin" /> Đang đồng bộ phiên đăng nhập...
                </div>
            </div>
        );
    }

    return (
        <>
            {!isDrawerView && !isNotificationOpen ? <FloatingTransactionBubble /> : null}
            <InitialWalletSetupModal
                isOpen={requiresInitialWalletSetup && wallets.length > 0}
                wallets={wallets}
                isSubmitting={isInitialSetupSubmitting}
                errorMessage={initialSetupError}
                onSubmit={handleInitialWalletSetup}
            />
            <SideDrawer
                isOpen={isDrawerOpen}
                onClose={() => setIsDrawerOpen(false)}
                onLogout={() => setIsLogoutConfirmOpen(true)}
                onOpenWalletHistory={handleOpenWalletHistory}
                onOpenFriends={handleOpenFriendsTab}
                onOpenSharedFunds={handleOpenSharedFunds}
                user={user}
                totalWalletBalance={totalWalletBalance}
                wallets={wallets}
            />
            <NotificationDrawer
                isOpen={isNotificationOpen}
                isLoading={isPaymentNotificationsLoading}
                notifications={paymentNotifications}
                wallets={wallets}
                expenseCategories={expenseNotificationCategories}
                friendRequests={pendingFriendRequests}
                sharedFundInvites={sharedFundInvites}
                sharedFundActivities={sharedFundActivities}
                messageNotifications={messageNotifications}
                userTelegramChatId={user?.telegramChatId}
                onClose={() => setIsNotificationOpen(false)}
                onCreateNotification={handleCreatePaymentNotification}
                onPayNotification={handlePayPaymentNotification}
                onDeleteNotification={handleDeletePaymentNotification}
                onAcceptFriendRequest={handleAcceptFriendRequest}
                onRejectFriendRequest={handleRejectFriendRequest}
                onAcceptSharedFundInvite={handleAcceptSharedFundInvite}
                onRejectSharedFundInvite={handleRejectSharedFundInvite}
                onReplyMessageNotification={handleReplyMessageNotification}
                onHideMessageNotification={handleHideMessageNotification}
            />
            <main className="app-shell">
                <div className="page-container">
                    <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 18 }}>
                        <div>
                            <div style={{ color: 'var(--muted)', fontSize: 11.5 }}>Xin chào trở lại</div>
                            <div style={{ fontSize: 21, fontWeight: 900, marginTop: 5 }}>{user?.displayName || user?.username || 'User'}</div>
                            <div style={{ color: 'var(--accent-text)', marginTop: 5, fontWeight: 700, fontSize: 12.5 }}>Trung tâm quản lý tài chính</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <IconButton onClick={toggleTheme}>
                                {theme === 'dark' ? <SunMedium size={18} /> : <MoonStar size={18} />}
                            </IconButton>
                            <IconButton onClick={() => setIsNotificationOpen(true)}>
                                <span style={{ position: 'relative', display: 'inline-flex' }}>
                                    <Bell size={18} />
                                    {pendingFriendRequests.length > 0 || sharedFundInvites.length > 0 || sharedFundActivities.length > 0 || messageNotifications.length > 0 ? (
                                        <span
                                            style={{
                                                position: 'absolute',
                                                right: -2,
                                                top: -2,
                                                width: 8,
                                                height: 8,
                                                borderRadius: '50%',
                                                background: '#ef4444',
                                                boxShadow: '0 0 0 2px var(--theme-icon-surface)',
                                            }}
                                        />
                                    ) : null}
                                </span>
                            </IconButton>
                        </div>
                    </header>

                    <AppCard
                        style={{
                            padding: 16,
                            marginBottom: 16,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 10,
                        }}
                        strong
                    >
                        <div>
                            <div style={{ color: 'var(--muted)', fontSize: 12 }}>Tổng ví hiện tại</div>
                            <div style={{ fontSize: 22, fontWeight: 900, marginTop: 5, letterSpacing: isBalanceVisible ? undefined : 2 }}>
                                {isBalanceVisible ? formatCurrencyVND(totalWalletBalance) : '••••••••••••'}
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <button
                                type="button"
                                onClick={toggleBalance}
                                style={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: 12,
                                    border: '1px solid var(--surface-border)',
                                    background: 'transparent',
                                    color: 'var(--muted)',
                                    display: 'grid',
                                    placeItems: 'center',
                                    cursor: 'pointer',
                                }}
                                title={isBalanceVisible ? 'Ẩn số dư' : 'Hiện số dư'}
                            >
                                {isBalanceVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                            <div style={{ width: 54, height: 54, borderRadius: 18, display: 'grid', placeItems: 'center', background: 'linear-gradient(135deg, var(--theme-panel-gradient-start), var(--theme-panel-gradient-end))' }}>
                                <CircleDollarSign size={22} color="var(--theme-nav-active)" />
                            </div>
                        </div>
                    </AppCard>

                    {activeTab !== 'calendar' && activeTab !== 'wallets' && activeTab !== 'friends' ? (
                        <AppCard style={{ padding: 16, marginBottom: 16, display: 'grid', gap: 12 }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                                <div>
                                    <div style={{ fontSize: 14.5, fontWeight: 800 }}>Tổng quan tháng {monthLabel}</div>
                                    <div style={{ marginTop: 6, color: 'var(--muted)', fontSize: 12.5, lineHeight: 1.6 }}>
                                        {savingsMetrics?.savingsGoal
                                            ? 'Mục tiêu đã có rồi, hãy tiêu khéo và để tiền làm phần việc còn lại'
                                            : 'Đặt mục tiêu để tui nhắc khéo bạn chi tiêu hàng ngày nè'}
                                    </div>
                                </div>
                                <div style={{ width: 46, height: 46, borderRadius: 16, display: 'grid', placeItems: 'center', background: 'var(--theme-icon-surface)', border: '1px solid var(--theme-icon-border)' }}>
                                    <Sparkles size={18} color="var(--accent)" />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
                                <div style={{ borderRadius: 12, background: 'var(--surface-soft)', border: '1px solid var(--surface-border)', padding: '10px 12px' }}>
                                    <div style={{ fontSize: 10.5, color: 'var(--muted)' }}>Mục tiêu</div>
                                    <div style={{ fontSize: 'clamp(11px, 2.8vw, 14px)', fontWeight: 900, marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{formatCurrencyVND(savingsMetrics?.savingsGoal ?? 0)}</div>
                                </div>
                                <div style={{ borderRadius: 12, background: 'var(--surface-soft)', border: '1px solid var(--surface-border)', padding: '10px 12px' }}>
                                    <div style={{ fontSize: 10.5, color: 'var(--muted)' }}>Tiền đi học hôm nay</div>
                                    <div style={{ fontSize: 'clamp(11px, 2.8vw, 14px)', fontWeight: 900, marginTop: 4, color: (savingsMetrics?.avgDailyAllowance ?? 0) >= 0 ? '#15803d' : '#dc2626', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {formatCurrencyVND(savingsMetrics?.avgDailyAllowance ?? 0)}
                                    </div>
                                </div>
                                <div style={{ borderRadius: 12, background: 'var(--surface-soft)', border: '1px solid var(--surface-border)', padding: '10px 12px' }}>
                                    <div style={{ fontSize: 10.5, color: 'var(--muted)' }}>Đang chi/ngày</div>
                                    <div
                                        style={{
                                            fontSize: 'clamp(11px, 2.8vw, 14px)',
                                            fontWeight: 900,
                                            marginTop: 4,
                                            color:
                                                (savingsMetrics?.avgDailyExpense ?? 0) <= (savingsMetrics?.avgDailyAllowance ?? 0) ||
                                                (savingsMetrics?.savingsGoal ?? 0) <= 0
                                                    ? '#15803d'
                                                    : '#dc2626',
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                        }}
                                    >
                                        {formatCurrencyVND(savingsMetrics?.avgDailyExpense ?? 0)}
                                    </div>
                                </div>
                            </div>
                        </AppCard>
                    ): null}

                    {isLoggingOut ? (
                        <AppCard style={{ padding: 14, marginBottom: 16, color: '#dbeafe', fontSize: 13.5 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <LoaderCircle size={16} className="spin" /> Đang đăng xuất...
                            </div>
                        </AppCard>
                    ) : null}

                    {content}
                </div>
            </main>
            <BottomNav activeTab={activeTab} onSelect={handleNavSelect} />

            {isLogoutConfirmOpen ? (
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
                    <AppCard strong style={{ width: 'min(100%, 360px)', padding: 16, borderRadius: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div
                                style={{
                                    width: 34,
                                    height: 34,
                                    borderRadius: 10,
                                    display: 'grid',
                                    placeItems: 'center',
                                    background: 'var(--chip-bg)',
                                    border: '1px solid var(--chip-border)',
                                }}
                            >
                                <TriangleAlert size={18} color="var(--accent)" />
                            </div>
                            <div>
                                <div style={{ fontSize: 15, fontWeight: 900 }}>Xác nhận đăng xuất</div>
                                <div style={{ marginTop: 3, color: 'var(--muted)', fontSize: 12.5 }}>
                                    Bạn có chắc chắn muốn thoát tài khoản?
                                </div>
                            </div>
                        </div>

                        <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                            <button
                                type="button"
                                onClick={() => setIsLogoutConfirmOpen(false)}
                                disabled={isLoggingOut}
                                style={{
                                    minHeight: 40,
                                    borderRadius: 12,
                                    border: '1px solid var(--border)',
                                    background: 'transparent',
                                    color: 'var(--foreground)',
                                    fontWeight: 700,
                                }}
                            >
                                Hủy
                            </button>
                            <button
                                type="button"
                                onClick={() => void handleConfirmLogout()}
                                disabled={isLoggingOut}
                                style={{
                                    minHeight: 40,
                                    borderRadius: 12,
                                    border: '1px solid color-mix(in srgb, var(--danger) 45%, var(--border))',
                                    background: 'color-mix(in srgb, var(--danger) 16%, transparent)',
                                    color: 'var(--danger)',
                                    fontWeight: 800,
                                }}
                            >
                                {isLoggingOut ? 'Đang thoát...' : 'Đồng ý'}
                            </button>
                        </div>
                    </AppCard>
                </div>
            ) : null}
        </>
    );
}
