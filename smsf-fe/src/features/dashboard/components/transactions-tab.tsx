'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { AppCard } from '@/components/common/app-card';
import { CustomDatePicker } from '@/components/common/custom-date-picker';
import { CustomSelect } from '@/components/common/custom-select';
import { getCategoriesRequest, queryTransactionsRequest } from '@/lib/calendar/api';
import { formatCurrencyVND, formatTimeLabel, formatTransactionTypeLabel } from '@/lib/formatters';
import { ICalendarTransaction, ICategoryItem, ITransactionQueryParams } from '@/types/calendar';

const PAGE_SIZE = 15;

const toStartOfDayTimestamp = (dateValue: string): number | undefined => {
    if (!dateValue) {
        return undefined;
    }

    const date = new Date(`${dateValue}T00:00:00`);
    const timestamp = date.getTime();
    return Number.isFinite(timestamp) ? timestamp : undefined;
};

const toEndOfDayTimestamp = (dateValue: string): number | undefined => {
    if (!dateValue) {
        return undefined;
    }

    const date = new Date(`${dateValue}T23:59:59`);
    const timestamp = date.getTime();
    return Number.isFinite(timestamp) ? timestamp : undefined;
};

export function TransactionsTab() {
    const [transactions, setTransactions] = useState<ICalendarTransaction[]>([]);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [hasMore, setHasMore] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [categories, setCategories] = useState<ICategoryItem[]>([]);
    const [listAnimationKey, setListAnimationKey] = useState(0);

    const [categoryInput, setCategoryInput] = useState('');
    const [descriptionInput, setDescriptionInput] = useState('');
    const [startDateInput, setStartDateInput] = useState('');
    const [endDateInput, setEndDateInput] = useState('');

    const [filters, setFilters] = useState<Omit<ITransactionQueryParams, 'page' | 'limit'>>({});

    const categoryNameMap = useMemo(() => {
        return categories.reduce<Record<string, string>>((acc, item) => {
            acc[item.id] = item.name;
            return acc;
        }, {});
    }, [categories]);

    const fetchTransactions = useCallback(
        async (targetPage: number, append: boolean) => {
            setErrorMessage('');

            if (append) {
                setIsLoadingMore(true);
            } else {
                setIsLoading(true);
            }

            try {
                const result = await queryTransactionsRequest({
                    ...filters,
                    page: targetPage,
                    limit: PAGE_SIZE,
                });

                setTransactions((prev) =>
                    append ? [...prev, ...result.items] : result.items,
                );

                if (!append) {
                    setListAnimationKey((prev) => prev + 1);
                }

                setPage(result.page);
                setTotal(result.total);
                setHasMore(result.hasMore);
            } catch (error) {
                setErrorMessage(
                    (error as { response?: { data?: { message?: string } } })?.response?.data
                        ?.message || 'Không tải được danh sách giao dịch.',
                );
            } finally {
                setIsLoading(false);
                setIsLoadingMore(false);
            }
        },
        [filters],
    );

    useEffect(() => {
        void fetchTransactions(1, false);
    }, [fetchTransactions]);

    useEffect(() => {
        async function fetchCategories() {
            try {
                const items = await getCategoriesRequest();
                setCategories(items);
            } catch {
                setCategories([]);
            }
        }

        void fetchCategories();
    }, []);

    const handleApplyFilters = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        setFilters({
            categoryId: categoryInput || undefined,
            description: descriptionInput.trim() || undefined,
            startTime: toStartOfDayTimestamp(startDateInput),
            endTime: toEndOfDayTimestamp(endDateInput),
        });
    };

    const handleResetFilters = () => {
        setCategoryInput('');
        setDescriptionInput('');
        setStartDateInput('');
        setEndDateInput('');
        setFilters({});
    };

    const emptyState = useMemo(
        () => !isLoading && transactions.length === 0,
        [isLoading, transactions.length],
    );

    return (
        <div style={{ display: 'grid', gap: 12 }}>
            <AppCard strong style={{ padding: 14 }}>
                <form onSubmit={handleApplyFilters} style={{ display: 'grid', gap: 10 }}>
                    <div style={{ fontSize: 14, fontWeight: 800 }}>Bộ lọc giao dịch</div>

                    <CustomSelect
                        value={categoryInput}
                        onChange={setCategoryInput}
                        placeholder="Tất cả danh mục"
                        options={[
                            { value: '', label: 'Tất cả danh mục' },
                            ...categories.map((category) => ({
                                value: category.id,
                                label: category.name,
                            })),
                        ]}
                    />

                    <input
                        type="text"
                        value={descriptionInput}
                        onChange={(event) => setDescriptionInput(event.target.value)}
                        placeholder="Lọc theo mô tả"
                        style={{
                            padding: '10px 12px',
                            borderRadius: 10,
                            border: '1px solid var(--surface-border)',
                            background: 'var(--surface-soft)',
                            color: 'var(--foreground)',
                            fontSize: 13,
                        }}
                    />

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <CustomDatePicker
                            value={startDateInput}
                            onChange={setStartDateInput}
                            placeholder="Từ ngày"
                        />
                        <CustomDatePicker
                            value={endDateInput}
                            onChange={setEndDateInput}
                            placeholder="Đến ngày"
                        />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <button
                            type="button"
                            onClick={handleResetFilters}
                            style={{
                                border: '1px solid var(--surface-border)',
                                borderRadius: 10,
                                background: 'transparent',
                                color: 'var(--foreground)',
                                fontSize: 12,
                                fontWeight: 700,
                                padding: '10px 12px',
                            }}
                        >
                            Xóa lọc
                        </button>
                        <button
                            type="submit"
                            style={{
                                border: '1px solid var(--theme-gradient-start)',
                                borderRadius: 10,
                                background: 'var(--chip-bg)',
                                color: 'var(--foreground)',
                                fontSize: 12,
                                fontWeight: 700,
                                padding: '10px 12px',
                            }}
                        >
                            Áp dụng lọc
                        </button>
                    </div>
                </form>
            </AppCard>

            <AppCard strong style={{ padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <div style={{ fontSize: 15, fontWeight: 800 }}>Danh sách giao dịch</div>
                    <div style={{ color: 'var(--muted)', fontSize: 11.5 }}>{total} giao dịch</div>
                </div>

                {errorMessage ? (
                    <div
                        style={{
                            fontSize: 12,
                            color: '#ef4444',
                            background: 'rgba(239,68,68,0.08)',
                            border: '1px solid rgba(239,68,68,0.18)',
                            borderRadius: 8,
                            padding: '8px 10px',
                            marginBottom: 8,
                        }}
                    >
                        {errorMessage}
                    </div>
                ) : null}

                {isLoading ? (
                    <div style={{ display: 'grid', gap: 8, marginBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--muted)', fontSize: 13 }}>
                            <span
                                style={{
                                    width: 12,
                                    height: 12,
                                    borderRadius: 999,
                                    border: '2px solid var(--surface-border)',
                                    borderTopColor: 'var(--accent)',
                                }}
                                className="spin"
                            />
                            Đang tải giao dịch...
                        </div>

                        {Array.from({ length: 3 }).map((_, index) => (
                            <div
                                key={`txn-loading-${index}`}
                                style={{
                                    height: 60,
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

                <div style={{ display: 'grid', gap: 8 }}>
                    {transactions.map((transaction, index) => {
                        const isExpense = transaction.type === 'expense';
                        const typeLabel = formatTransactionTypeLabel(transaction.type);

                        return (
                            <div
                                key={`${transaction.id}-${listAnimationKey}`}
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: '1fr auto',
                                    gap: 10,
                                    padding: '11px 12px',
                                    borderRadius: 14,
                                    background: 'var(--surface-soft)',
                                    border: '1px solid var(--surface-border)',
                                    alignItems: 'center',
                                    opacity: 0,
                                    transform: 'translateY(6px)',
                                    animation: 'transaction-item-reveal 240ms ease forwards',
                                    animationDelay: `${Math.min(index * 38, 280)}ms`,
                                }}
                            >
                                <div style={{ minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                        <span style={{ fontWeight: 800, fontSize: 12.5 }}>
                                            {categoryNameMap[transaction.category] || transaction.category}
                                        </span>
                                        <span
                                            style={{
                                                padding: '3px 7px',
                                                borderRadius: 999,
                                                fontSize: 10,
                                                fontWeight: 800,
                                                color: isExpense ? '#b91c1c' : '#166534',
                                                background: isExpense ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.12)',
                                            }}
                                        >
                                            {typeLabel}
                                        </span>
                                    </div>
                                    <div style={{ marginTop: 4, color: 'var(--muted)', fontSize: 11.5 }}>
                                        {transaction.description || 'Không có mô tả'}
                                    </div>
                                    <div style={{ marginTop: 4, color: 'var(--muted)', fontSize: 11 }}>
                                        {formatTimeLabel(transaction.timestamp)}
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontWeight: 900, color: isExpense ? '#dc2626' : '#15803d', fontSize: 12.5 }}>
                                        {isExpense ? '- ' : '+ '}
                                        {formatCurrencyVND(transaction.amount)}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {emptyState ? (
                    <div style={{ color: 'var(--muted)', fontSize: 13 }}>Không có giao dịch phù hợp.</div>
                ) : null}

                {hasMore ? (
                    <button
                        onClick={() => void fetchTransactions(page + 1, true)}
                        disabled={isLoadingMore}
                        style={{
                            marginTop: 10,
                            width: '100%',
                            border: '1px solid var(--surface-border)',
                            borderRadius: 10,
                            background: 'transparent',
                            color: 'var(--foreground)',
                            fontSize: 12,
                            fontWeight: 700,
                            padding: '10px 12px',
                            opacity: isLoadingMore ? 0.7 : 1,
                        }}
                    >
                        {isLoadingMore ? 'Đang tải thêm...' : 'Tải thêm'}
                    </button>
                ) : null}
            </AppCard>
        </div>
    );
}
