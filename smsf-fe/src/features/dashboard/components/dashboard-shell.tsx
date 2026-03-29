'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BellDot, CircleDollarSign, LoaderCircle, MoonStar, Sparkles, SunMedium, TriangleAlert } from 'lucide-react';
import { AppCard } from '@/components/common/app-card';
import { IconButton } from '@/components/common/icon-button';
import { BottomNav } from '@/components/navigation/bottom-nav';
import { NotificationDrawer } from '@/components/navigation/notification-drawer';
import { SideDrawer } from '@/components/navigation/side-drawer';
import { ExpenseDonutCard } from '@/features/dashboard/components/charts/expense-donut-card';
import { SavingsRingCard } from '@/features/dashboard/components/charts/savings-ring-card';
import { SpendingTrendCard } from '@/features/dashboard/components/charts/spending-trend-card';
import { RecentTransactionsCard } from '@/features/dashboard/components/recent-transactions-card';
import { CalendarShell } from '@/features/calendar/components/calendar-shell';
import { TransactionsTab } from '@/features/dashboard/components/transactions-tab';
import { ChatTab } from '@/features/dashboard/components/journal-tab';
import { FloatingTransactionBubble } from '@/components/common/floating-transaction-bubble';
import { getCategoriesRequest, queryTransactionsRequest, getSavingsRateRequest, getSpendingTrendRequest } from '@/lib/calendar/api';
import { formatCurrencyVND } from '@/lib/formatters';
import { createNotificationRequest, deleteNotificationRequest, getNotificationsRequest, payNotificationRequest } from '@/lib/notifications/api';
import { useAuth } from '@/providers/auth-provider';
import { useTheme } from '@/providers/theme-provider';
import { ICategoryItem } from '@/types/calendar';
import { IExpenseCategoryItem, IRecentTransaction, ISavingsRateData, ISpendingTrendData, TypeDashboardTab } from '@/types/dashboard';
import { ICreateNotificationPayload, INotificationItem, IPayNotificationPayload } from '@/types/notification';

function PlaceholderPanel({ title, description }: { title: string; description: string }) {
    return (
        <AppCard strong style={{ padding: 16 }}>
            <div style={{ fontSize: 16, fontWeight: 800 }}>{title}</div>
            <div style={{ marginTop: 8, color: 'var(--muted)', lineHeight: 1.65, fontSize: 13 }}>{description}</div>
        </AppCard>
    );
}

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

export function DashboardShell() {
    const router = useRouter();
    const { isAuthenticated, isLoading, logout, refreshWallets, user, totalWalletBalance, wallets } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<TypeDashboardTab>('dashboard');
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
    const [isNotificationOpen, setIsNotificationOpen] = useState(false);
    const [isRecurringLoading, setIsRecurringLoading] = useState(false);
    const [paymentNotifications, setPaymentNotifications] = useState<INotificationItem[]>([]);
    const [expenseNotificationCategories, setExpenseNotificationCategories] = useState<ICategoryItem[]>([]);
    const [isPaymentNotificationsLoading, setIsPaymentNotificationsLoading] = useState(false);
    const [isFirstCalendarLoading, setIsFirstCalendarLoading] = useState(false);
    const [isCalendarVisible, setIsCalendarVisible] = useState(true);
    const [recentTransactions, setRecentTransactions] = useState<IRecentTransaction[]>([]);
    const [expenseCategories, setExpenseCategories] = useState<IExpenseCategoryItem[]>([]);
    const [monthLabel, setMonthLabel] = useState('');
    const [savingsMetrics, setSavingsMetrics] = useState<ISavingsRateData | null>(null);
    const [spendingTrendData, setSpendingTrendData] = useState<ISpendingTrendData | null>(null);
    const firstCalendarDelayTimerRef = useRef<number | null>(null);
    const calendarRevealTimerRef = useRef<number | null>(null);

    const QUERY_LIMIT = 100;

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
        if (!isAuthenticated) {
            return;
        }

        void fetchRecentTransactions();
        void fetchPaymentNotifications();
    }, [fetchPaymentNotifications, fetchRecentTransactions, isAuthenticated]);

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

    const walletContent = (
        <AppCard strong style={{ padding: 16, display: 'grid', gap: 12 }}>
            <div>
                <div style={{ fontSize: 16, fontWeight: 800 }}>Ví & số dư hiện tại</div>
                <div style={{ marginTop: 6, color: 'var(--muted)', lineHeight: 1.65, fontSize: 13 }}>
                    Tổng số dư được đồng bộ trực tiếp từ backend và cập nhật ngay sau mỗi giao dịch.
                </div>
            </div>

            <div style={{ display: 'grid', gap: 10 }}>
                {wallets.length === 0 ? (
                    <div style={{ color: 'var(--muted)', fontSize: 13 }}>Chưa có ví nào để hiển thị.</div>
                ) : (
                    wallets.map((wallet) => (
                        <div
                            key={wallet.id}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 12,
                                padding: '12px 14px',
                                borderRadius: 14,
                                background: 'var(--surface-soft)',
                                border: '1px solid var(--border)',
                            }}
                        >
                            <div>
                                <div style={{ fontWeight: 800, fontSize: 13.5 }}>{wallet.name}</div>
                                <div style={{ color: 'var(--muted)', fontSize: 11.5, textTransform: 'uppercase' }}>{wallet.type}</div>
                            </div>
                            <div style={{ fontWeight: 900, fontSize: 'clamp(11px, 2.8vw, 13.5px)', whiteSpace: 'nowrap', maxWidth: '52%', overflow: 'hidden', textOverflow: 'ellipsis' }}>{formatCurrencyVND(wallet.balance)}</div>
                        </div>
                    ))
                )}
            </div>
        </AppCard>
    );

    let content = dashboardContent;

    if (activeTab === 'transactions') {
        content = <TransactionsTab />;
    } else if (activeTab === 'chat') {
        content = <ChatTab />;
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
        content = walletContent;
    }

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
            <FloatingTransactionBubble />
            <SideDrawer
                isOpen={isDrawerOpen}
                onClose={() => setIsDrawerOpen(false)}
                onLogout={() => setIsLogoutConfirmOpen(true)}
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
                userTelegramChatId={user?.telegramChatId}
                onClose={() => setIsNotificationOpen(false)}
                onCreateNotification={handleCreatePaymentNotification}
                onPayNotification={handlePayPaymentNotification}
                onDeleteNotification={handleDeletePaymentNotification}
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
                                <BellDot size={18} />
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
                            <div style={{ fontSize: 22, fontWeight: 900, marginTop: 5 }}>{formatCurrencyVND(totalWalletBalance)}</div>
                        </div>
                        <div style={{ width: 54, height: 54, borderRadius: 18, display: 'grid', placeItems: 'center', background: 'linear-gradient(135deg, var(--theme-panel-gradient-start), var(--theme-panel-gradient-end))' }}>
                            <CircleDollarSign size={22} color="var(--theme-nav-active)" />
                        </div>
                    </AppCard>

                    {activeTab !== 'calendar' ? (
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
                                    <div style={{ fontSize: 10.5, color: 'var(--muted)' }}>Được chi/ngày</div>
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
