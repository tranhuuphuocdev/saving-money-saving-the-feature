'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ICalendarDay,
    ICalendarTransaction,
    ICategoryItem,
    ICreateTransactionPayload,
    IUpdateTransactionPayload,
} from '@/types/calendar';
import { getTransactionsForDate, getMonthDaySummary } from '@/data/calendar';
import {
    createTransactionRequest,
    deleteTransactionRequest,
    getSavingsRateRequest,
    getTransactionsByMonthRequest,
    upsertSavingGoalRequest,
    updateTransactionRequest,
    getCategoriesRequest,
} from '@/lib/calendar/api';
import { CalendarHeader } from './calendar-header';
import { CalendarGrid } from './calendar-grid';
import { CalendarSummary } from './calendar-summary';
import { TransactionModal } from './transaction-modal';
import { useAuth } from '@/providers/auth-provider';
import { ISavingsRateData } from '@/types/dashboard';

interface ICalendarShellProps {
    onInitialLoadComplete?: () => void;
}

export function CalendarShell({ onInitialLoadComplete }: ICalendarShellProps) {
    const {
        refreshWallets,
        wallets: authWallets,
        isAuthenticated,
        isLoading: isAuthLoading,
    } = useAuth();

    const today = new Date();
    const initialMonthRef = useRef({
        month: today.getMonth() + 1,
        year: today.getFullYear(),
    });
    const [currentMonth, setCurrentMonth] = useState(initialMonthRef.current.month);
    const [currentYear, setCurrentYear] = useState(initialMonthRef.current.year);
    const [selectedDay, setSelectedDay] = useState<ICalendarDay | null>(null);
    const [transactions, setTransactions] = useState<ICalendarTransaction[]>([]);
    const [categories, setCategories] = useState<ICategoryItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [savingsMetrics, setSavingsMetrics] = useState<ISavingsRateData | null>(null);
    const [isSavingGoalSubmitting, setIsSavingGoalSubmitting] = useState(false);
    const monthCacheRef = useRef<Record<string, ICalendarTransaction[]>>({});
    const pendingMonthRequestRef = useRef<Record<string, Promise<ICalendarTransaction[]>>>({});
    const hasInitialMonthDataRef = useRef(false);
    const hasNotifiedInitialLoadRef = useRef(false);
    const activeMonthKeyRef = useRef(
        `${initialMonthRef.current.year}-${String(initialMonthRef.current.month).padStart(2, '0')}`,
    );

    const buildMonthKey = useCallback((month: number, year: number) => {
        return `${year}-${String(month).padStart(2, '0')}`;
    }, []);

    const getShiftedMonth = useCallback((month: number, year: number, offset: number) => {
        const shifted = new Date(year, month - 1 + offset, 1);
        return { month: shifted.getMonth() + 1, year: shifted.getFullYear() };
    }, []);

    const getOrFetchMonthTransactions = useCallback(
        async (month: number, year: number) => {
            const key = buildMonthKey(month, year);
            const cached = monthCacheRef.current[key];

            if (cached) {
                return cached;
            }

            const pendingRequest = pendingMonthRequestRef.current[key];
            if (pendingRequest) {
                return pendingRequest;
            }

            const request = getTransactionsByMonthRequest(month, year)
                .then((items) => {
                    monthCacheRef.current[key] = items;
                    return items;
                })
                .finally(() => {
                    delete pendingMonthRequestRef.current[key];
                });

            pendingMonthRequestRef.current[key] = request;
            return request;
        },
        [buildMonthKey],
    );

    const preloadAroundMonth = useCallback(
        async (month: number, year: number) => {
            const previous = getShiftedMonth(month, year, -1);
            const next = getShiftedMonth(month, year, 1);

            await Promise.all([
                getOrFetchMonthTransactions(previous.month, previous.year),
                getOrFetchMonthTransactions(month, year),
                getOrFetchMonthTransactions(next.month, next.year),
            ]);
        },
        [getOrFetchMonthTransactions, getShiftedMonth],
    );

    const fetchSavingsMetrics = useCallback(async (month: number, year: number) => {
        return getSavingsRateRequest({ month, year });
    }, []);

    const refreshCategoriesFromDb = useCallback(async () => {
        const fetchedCategories = await getCategoriesRequest();
        setCategories(fetchedCategories);
        return fetchedCategories;
    }, []);

    const refreshCurrentSavingsMetrics = useCallback(async () => {
        const nextMetrics = await fetchSavingsMetrics(currentMonth, currentYear);
        setSavingsMetrics(nextMetrics);
        return nextMetrics;
    }, [currentMonth, currentYear, fetchSavingsMetrics]);

    useEffect(() => {
        let ignore = false;

        if (isAuthLoading) {
            return;
        }

        if (!isAuthenticated) {
            setTransactions([]);
            setCategories([]);
            setSelectedDay(null);
            setIsLoading(false);
            monthCacheRef.current = {};
            pendingMonthRequestRef.current = {};
            hasInitialMonthDataRef.current = false;
            return;
        }

        async function bootstrapCalendarData() {
            setIsLoading(true);

            try {
                const { month, year } = initialMonthRef.current;

                const [_, currentMonthTransactions, __, fetchedCategories, fetchedSavingsMetrics] = await Promise.all([
                    getOrFetchMonthTransactions(getShiftedMonth(month, year, -1).month, getShiftedMonth(month, year, -1).year),
                    getOrFetchMonthTransactions(month, year),
                    getOrFetchMonthTransactions(getShiftedMonth(month, year, 1).month, getShiftedMonth(month, year, 1).year),
                    refreshCategoriesFromDb(),
                    fetchSavingsMetrics(month, year),
                ]);

                if (!ignore) {
                    setTransactions(currentMonthTransactions);
                    setCategories(fetchedCategories);
                    setSavingsMetrics(fetchedSavingsMetrics);
                    activeMonthKeyRef.current = buildMonthKey(month, year);
                    hasInitialMonthDataRef.current = true;
                    if (!hasNotifiedInitialLoadRef.current) {
                        hasNotifiedInitialLoadRef.current = true;
                        onInitialLoadComplete?.();
                    }
                }
            } catch {
                if (!ignore) {
                    setTransactions([]);
                    setCategories([]);
                    setSavingsMetrics(null);
                    hasInitialMonthDataRef.current = true;
                    if (!hasNotifiedInitialLoadRef.current) {
                        hasNotifiedInitialLoadRef.current = true;
                        onInitialLoadComplete?.();
                    }
                }
            } finally {
                if (!ignore) {
                    setIsLoading(false);
                }
            }
        }

        void bootstrapCalendarData();

        return () => {
            ignore = true;
        };
    }, [
        buildMonthKey,
        fetchSavingsMetrics,
        getOrFetchMonthTransactions,
        getShiftedMonth,
        isAuthLoading,
        isAuthenticated,
        onInitialLoadComplete,
        refreshCategoriesFromDb,
    ]);

    useEffect(() => {
        if (!hasInitialMonthDataRef.current) {
            return;
        }

        monthCacheRef.current[buildMonthKey(currentMonth, currentYear)] = transactions;
    }, [buildMonthKey, currentMonth, currentYear, transactions]);

    const monthDaySummary = useMemo(
        () => getMonthDaySummary(transactions, currentMonth, currentYear),
        [transactions, currentMonth, currentYear],
    );

    const monthTotals = useMemo(() => {
        let totalIncome = 0;
        let totalExpense = 0;

        Object.values(monthDaySummary).forEach((day) => {
            totalIncome += day.income;
            totalExpense += day.expense;
        });

        return { totalIncome, totalExpense };
    }, [monthDaySummary]);

    const calendarDays = useMemo(() => {
        const firstDayOfMonth = new Date(currentYear, currentMonth - 1, 1);
        const lastDayOfMonth = new Date(currentYear, currentMonth, 0);
        const daysInMonth = lastDayOfMonth.getDate();
        const startingDayOfWeek = firstDayOfMonth.getDay() === 0 ? 6 : firstDayOfMonth.getDay() - 1;

        const days: ICalendarDay[] = [];

        const prevMonthLastDay = new Date(currentYear, currentMonth - 1, 0).getDate();
        for (let i = startingDayOfWeek - 1; i >= 0; i--) {
            const date = prevMonthLastDay - i;
            const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
            const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;
            days.push({
                date,
                month: prevMonth,
                year: prevYear,
                isCurrentMonth: false,
                isToday: false,
                totalIncome: 0,
                totalExpense: 0,
            });
        }

        for (let date = 1; date <= daysInMonth; date++) {
            const isToday = today.getDate() === date && today.getMonth() === currentMonth - 1 && today.getFullYear() === currentYear;
            const summary = monthDaySummary[date] || { income: 0, expense: 0 };

            days.push({
                date,
                month: currentMonth,
                year: currentYear,
                isCurrentMonth: true,
                isToday,
                totalIncome: summary.income,
                totalExpense: summary.expense,
            });
        }

        const remainingDays = 42 - days.length;
        for (let date = 1; date <= remainingDays; date++) {
            const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
            const nextYear = currentMonth === 12 ? currentYear + 1 : currentYear;
            days.push({
                date,
                month: nextMonth,
                year: nextYear,
                isCurrentMonth: false,
                isToday: false,
                totalIncome: 0,
                totalExpense: 0,
            });
        }

        return days;
    }, [currentMonth, currentYear, monthDaySummary, today]);

    async function handleMonthChange(month: number, year: number) {
        if (month === currentMonth && year === currentYear) {
            return;
        }

        const previousMonthTime = new Date(currentYear, currentMonth - 1, 1).getTime();
        const targetMonthTime = new Date(year, month - 1, 1).getTime();
        const direction = targetMonthTime >= previousMonthTime ? 1 : -1;
        const targetKey = buildMonthKey(month, year);

        activeMonthKeyRef.current = targetKey;
        setSelectedDay(null);
        setCurrentMonth(month);
        setCurrentYear(year);

        const cached = monthCacheRef.current[targetKey];
        if (cached) {
            setTransactions(cached);
            setIsLoading(false);
        } else {
            setIsLoading(true);
            try {
                const fetchedTransactions = await getOrFetchMonthTransactions(month, year);

                if (activeMonthKeyRef.current === targetKey) {
                    setTransactions(fetchedTransactions);
                }
            } catch {
                if (activeMonthKeyRef.current === targetKey) {
                    setTransactions([]);
                }
            } finally {
                if (activeMonthKeyRef.current === targetKey) {
                    setIsLoading(false);
                }
            }
        }

        try {
            const nextSavingsMetrics = await fetchSavingsMetrics(month, year);
            if (activeMonthKeyRef.current === targetKey) {
                setSavingsMetrics(nextSavingsMetrics);
            }
        } catch {
            if (activeMonthKeyRef.current === targetKey) {
                setSavingsMetrics(null);
            }
        }

        const prefetchTarget = getShiftedMonth(month, year, direction);
        void getOrFetchMonthTransactions(prefetchTarget.month, prefetchTarget.year);
        void preloadAroundMonth(month, year);
    }

    function handleDaySelect(day: ICalendarDay) {
        setSelectedDay(day);
        void refreshCategoriesFromDb();
    }

    function handleCloseModal() {
        setSelectedDay(null);
    }

    async function handleAddTransaction(payload: ICreateTransactionPayload) {
        const result = await createTransactionRequest(payload);

        if (result.transaction) {
            setTransactions((prev) => [result.transaction as ICalendarTransaction, ...prev]);
        }

        await refreshCurrentSavingsMetrics();

        await refreshWallets();
        window.dispatchEvent(new CustomEvent('transaction:changed'));
    }

    async function handleUpdateTransaction(
        transactionId: string,
        payload: IUpdateTransactionPayload,
    ) {
        const result = await updateTransactionRequest(transactionId, payload);

        if (result.transaction) {
            setTransactions((prev) =>
                prev.map((transaction) =>
                    transaction.id === transactionId
                        ? (result.transaction as ICalendarTransaction)
                        : transaction,
                ),
            );
        }

        await refreshCurrentSavingsMetrics();

        await refreshWallets();
        window.dispatchEvent(new CustomEvent('transaction:changed'));
    }

    async function handleDeleteTransaction(transactionId: string) {
        const result = await deleteTransactionRequest(transactionId);

        setTransactions((prev) =>
            prev.filter((transaction) => transaction.id !== transactionId),
        );

        await refreshCurrentSavingsMetrics();

        await refreshWallets();
        window.dispatchEvent(new CustomEvent('transaction:changed'));
    }

    async function handleSaveSavingGoal(amount: number) {
        setIsSavingGoalSubmitting(true);

        try {
            await upsertSavingGoalRequest({ amount, month: currentMonth, year: currentYear });
            const nextSavingsMetrics = await fetchSavingsMetrics(currentMonth, currentYear);
            setSavingsMetrics(nextSavingsMetrics);
            window.dispatchEvent(new CustomEvent('savings-goal:changed'));
        } finally {
            setIsSavingGoalSubmitting(false);
        }
    }

    const selectedTransactions = selectedDay
        ? getTransactionsForDate(
              transactions,
              selectedDay.date,
              selectedDay.month,
              selectedDay.year,
          )
        : [];

    const monthLabel = `${currentMonth.toString().padStart(2, '0')}/${currentYear}`;

    return (
        <div style={{ padding: '10px 14px', paddingBottom: `calc(80px + env(safe-area-inset-bottom, 0px))` }}>

            <CalendarSummary
                monthLabel={monthLabel}
                totalIncome={monthTotals.totalIncome}
                totalExpense={monthTotals.totalExpense}
                savingsGoal={savingsMetrics?.savingsGoal ?? 0}
                avgDailyAllowance={savingsMetrics?.avgDailyAllowance ?? 0}
                avgDailyExpense={savingsMetrics?.avgDailyExpense ?? 0}
                daysRemaining={savingsMetrics?.daysRemaining ?? 0}
                isSavingGoalSubmitting={isSavingGoalSubmitting}
                onSaveSavingGoal={handleSaveSavingGoal}
            />

            <CalendarHeader currentMonth={currentMonth} currentYear={currentYear} onMonthChange={handleMonthChange} />
            
            {isLoading ? (
                <div style={{ padding: '12px 4px', color: 'var(--muted)', fontSize: 13 }}>
                    Đang chuyển tháng...
                </div>
            ) : null}

            <CalendarGrid days={calendarDays} onDaySelect={handleDaySelect} />

            {selectedDay && (
                <TransactionModal
                    isOpen={!!selectedDay}
                    date={selectedDay.date}
                    month={selectedDay.month}
                    year={selectedDay.year}
                    transactions={selectedTransactions}
                    wallets={authWallets}
                    categories={categories}
                    onClose={handleCloseModal}
                    onAddTransaction={handleAddTransaction}
                    onUpdateTransaction={handleUpdateTransaction}
                    onDeleteTransaction={handleDeleteTransaction}
                />
            )}
        </div>
    );
}
