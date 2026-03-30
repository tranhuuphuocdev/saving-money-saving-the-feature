'use client';

import { FormEvent, PointerEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, LoaderCircle, Pencil, Trash2, TriangleAlert, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { AppCard } from '@/components/common/app-card';
import { CategoryOrderModal } from '@/components/common/category-order-modal';
import { CustomDatePicker } from '@/components/common/custom-date-picker';
import { CustomSelect } from '@/components/common/custom-select';
import { PrimaryButton } from '@/components/common/primary-button';
import {
    deleteTransactionRequest,
    getCategoriesRequest,
    queryTransactionsRequest,
    updateCategoryOrderRequest,
    updateTransactionRequest,
} from '@/lib/calendar/api';
import { formatCurrencyVND } from '@/lib/formatters';
import { useAuth } from '@/providers/auth-provider';
import { ICalendarTransaction, ICategoryItem, ITransactionQueryParams } from '@/types/calendar';

const PAGE_SIZE = 15;
const ACTION_SIDE_PADDING = 6;
const ACTION_BUTTON_WIDTH = 42;
const ACTION_GAP = 6;
const ACTION_TRAILING_PADDING = 6;
const SWIPE_SNAP_TO_EDIT =
    ACTION_SIDE_PADDING
    + ACTION_BUTTON_WIDTH
    + ACTION_GAP
    + ACTION_BUTTON_WIDTH
    + ACTION_TRAILING_PADDING;

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

const parseDateInputToTimestamp = (dateInput: string): number => {
    const parsed = Date.parse(`${dateInput}T12:00:00`);
    if (!Number.isFinite(parsed)) return Date.now();
    return parsed;
};

const formatDateInput = (timestamp: number): string => {
    const date = new Date(timestamp);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

const formatFullDateTime = (value: number | string): string => {
    return new Intl.DateTimeFormat('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(new Date(value));
};

const matchTransactionWithFilters = (
    transaction: ICalendarTransaction,
    filter: Omit<ITransactionQueryParams, 'page' | 'limit'>,
): boolean => {
    if (filter.categoryId && transaction.category !== filter.categoryId) {
        return false;
    }

    if (filter.description) {
        const needle = filter.description.trim().toLowerCase();
        const haystack = String(transaction.description || '').toLowerCase();
        if (!haystack.includes(needle)) {
            return false;
        }
    }

    if (typeof filter.startTime === 'number' && transaction.timestamp < filter.startTime) {
        return false;
    }

    if (typeof filter.endTime === 'number' && transaction.timestamp > filter.endTime) {
        return false;
    }

    return true;
};

export function TransactionsTab() {
    const { wallets, refreshWallets } = useAuth();
    const [transactions, setTransactions] = useState<ICalendarTransaction[]>([]);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [hasMore, setHasMore] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [categories, setCategories] = useState<ICategoryItem[]>([]);
    const [listAnimationKey, setListAnimationKey] = useState(0);
    const [topMessage, setTopMessage] = useState('');
    const [editingTransaction, setEditingTransaction] = useState<ICalendarTransaction | null>(null);
    const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
    const [editError, setEditError] = useState('');
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<ICalendarTransaction | null>(null);
    const [isCategoryOrderOpen, setIsCategoryOrderOpen] = useState(false);
    const [isSavingCategoryOrder, setIsSavingCategoryOrder] = useState(false);

    const [swipedTransactionId, setSwipedTransactionId] = useState<string | null>(null);
    const [dragOffsetX, setDragOffsetX] = useState(0);
    const ignoreNextClickRef = useRef(false);
    const dragRef = useRef<{
        id: string;
        width: number;
        startX: number;
        startOffset: number;
        maxLeft: number;
        isDragging: boolean;
        hasMoved: boolean;
    } | null>(null);

    const [categoryInput, setCategoryInput] = useState('');
    const [descriptionInput, setDescriptionInput] = useState('');
    const [startDateInput, setStartDateInput] = useState('');
    const [endDateInput, setEndDateInput] = useState('');

    const [filters, setFilters] = useState<Omit<ITransactionQueryParams, 'page' | 'limit'>>({});

    const [editType, setEditType] = useState<'income' | 'expense'>('expense');
    const [editAmount, setEditAmount] = useState('');
    const [editWalletId, setEditWalletId] = useState('');
    const [editCategoryId, setEditCategoryId] = useState('');
    const [editDescription, setEditDescription] = useState('');
    const [editDate, setEditDate] = useState('');

    const categoryNameMap = useMemo(() => {
        return categories.reduce<Record<string, string>>((acc, item) => {
            acc[item.id] = item.name;
            return acc;
        }, {});
    }, [categories]);

    const walletOptions = useMemo(
        () =>
            wallets
                .filter((wallet) => wallet.isActive !== false)
                .map((wallet) => ({
                    value: wallet.id,
                    label: `${wallet.name} • ${formatCurrencyVND(wallet.balance)}`,
                })),
        [wallets],
    );

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
                setSwipedTransactionId(null);
                setDragOffsetX(0);
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

    const refreshCategories = useCallback(async () => {
        try {
            const items = await getCategoriesRequest();
            setCategories(items);
        } catch {
            setCategories([]);
        }
    }, []);

    useEffect(() => {
        void refreshCategories();
    }, [refreshCategories]);

    const handleApplyFilters = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setTopMessage('');

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
        setTopMessage('');
    };

    const openEditModal = (transaction: ICalendarTransaction) => {
        setEditingTransaction(transaction);
        setEditType(transaction.type);
        setEditAmount(String(Math.round(transaction.amount)));
        setEditWalletId(transaction.walletId);
        setEditCategoryId(transaction.category);
        setEditDescription(transaction.description || '');
        setEditDate(formatDateInput(transaction.timestamp));
        setEditError('');
        setSwipedTransactionId(null);
    };

    const handleDeleteTransaction = async () => {
        if (!deleteTarget) return;

        setDeletingId(deleteTarget.id);
        setErrorMessage('');
        setTopMessage('');

        try {
            await deleteTransactionRequest(deleteTarget.id);
            setTopMessage('Đã xóa giao dịch thành công.');
            await refreshWallets();
            await fetchTransactions(1, false);
            setDeleteTarget(null);
        } catch (error) {
            setErrorMessage(
                (error as { response?: { data?: { message?: string } } })?.response?.data
                    ?.message || 'Xóa giao dịch thất bại.',
            );
        } finally {
            setDeletingId(null);
        }
    };

    const handleSaveEdit = async () => {
        if (!editingTransaction) return;

        const parsedAmount = Number(editAmount || 0);
        if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
            setEditError('Số tiền không hợp lệ.');
            return;
        }

        if (!editWalletId) {
            setEditError('Vui lòng chọn ví.');
            return;
        }

        if (!editCategoryId) {
            setEditError('Vui lòng chọn danh mục.');
            return;
        }

        setIsSubmittingEdit(true);
        setEditError('');
        setErrorMessage('');
        setTopMessage('');

        const nextTimestamp = parseDateInputToTimestamp(editDate);

        try {
            const result = await updateTransactionRequest(editingTransaction.id, {
                type: editType,
                amount: parsedAmount,
                walletId: editWalletId,
                category: editCategoryId,
                description: editDescription.trim() || undefined,
                timestamp: nextTimestamp,
            });

            const updated = result.transaction;
            if (updated && !matchTransactionWithFilters(updated, filters)) {
                setTopMessage('Giao dịch đã cập nhật nhưng không còn khớp bộ lọc hiện tại.');
            } else {
                setTopMessage('Đã cập nhật giao dịch thành công.');
            }

            await refreshWallets();
            await refreshCategories();
            await fetchTransactions(1, false);
            setEditingTransaction(null);
        } catch (error) {
            setEditError(
                (error as { response?: { data?: { message?: string } } })?.response?.data
                    ?.message || 'Cập nhật giao dịch thất bại.',
            );
        } finally {
            setIsSubmittingEdit(false);
        }
    };

    const handleSaveCategoryOrder = async (categoryIds: string[]) => {
        setIsSavingCategoryOrder(true);
        try {
            await updateCategoryOrderRequest({
                type: editType,
                categoryIds,
            });
            await refreshCategories();
            setIsCategoryOrderOpen(false);
        } finally {
            setIsSavingCategoryOrder(false);
        }
    };

    const handlePointerDown = (id: string, event: PointerEvent<HTMLDivElement>) => {
        if (event.pointerType === 'mouse' && event.button !== 0) {
            return;
        }

        event.currentTarget.setPointerCapture(event.pointerId);
        const rowWidth = event.currentTarget.getBoundingClientRect().width;
        const maxLeft = Math.min(rowWidth / 2, rowWidth - 24);

        dragRef.current = {
            id,
            width: rowWidth,
            startX: event.clientX,
            startOffset: swipedTransactionId === id ? -SWIPE_SNAP_TO_EDIT : 0,
            maxLeft,
            isDragging: false,
            hasMoved: false,
        };

        if (swipedTransactionId !== id) {
            setSwipedTransactionId(null);
        }
    };

    const handlePointerMove = (id: string, event: PointerEvent<HTMLDivElement>) => {
        if (!dragRef.current || dragRef.current.id !== id) return;

        const delta = event.clientX - dragRef.current.startX;
        if (Math.abs(delta) > 8) {
            dragRef.current.isDragging = true;
            dragRef.current.hasMoved = true;
        }

        const next = Math.min(0, Math.max(-dragRef.current.maxLeft, dragRef.current.startOffset + delta));
        setDragOffsetX(next);
    };

    const handlePointerEnd = (id: string) => {
        if (!dragRef.current || dragRef.current.id !== id) return;

        ignoreNextClickRef.current = dragRef.current.hasMoved;
        const reachedDeleteLimit = Math.abs(dragOffsetX) >= dragRef.current.maxLeft - 1;

        if (reachedDeleteLimit) {
            const target = transactions.find((transaction) => transaction.id === id) || null;
            if (target) {
                setDeleteTarget(target);
            }
            setSwipedTransactionId(null);
        } else if (Math.abs(dragOffsetX) > 12) {
            setSwipedTransactionId(id);
        } else {
            setSwipedTransactionId(null);
        }

        setDragOffsetX(0);
        dragRef.current = null;
    };

    const editTypeCategories = useMemo(
        () => categories.filter((item) => item.type === editType),
        [categories, editType],
    );

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
                <div style={{ color: 'var(--muted)', fontSize: 11.5, marginBottom: 8 }}>
                    Trượt sang trái (hoặc kéo chuột sang trái) để hiện Chỉnh sửa và Xóa.
                </div>

                {topMessage ? (
                    <div
                        style={{
                            fontSize: 12,
                            color: '#15803d',
                            background: 'rgba(21,128,61,0.1)',
                            border: '1px solid rgba(21,128,61,0.22)',
                            borderRadius: 8,
                            padding: '8px 10px',
                            marginBottom: 8,
                        }}
                    >
                        {topMessage}
                    </div>
                ) : null}

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
                        const isDraggingThis = dragRef.current?.id === transaction.id;
                        const translateX = isDraggingThis
                            ? dragOffsetX
                            : swipedTransactionId === transaction.id
                                                            ? -SWIPE_SNAP_TO_EDIT
                              : 0;
                        const showActions = isDraggingThis || swipedTransactionId === transaction.id || translateX < -1;
                        const categoryIcon = categories.find((item) => item.id === transaction.category)?.icon || '🧩';

                        return (
                            <div
                                key={`${transaction.id}-${listAnimationKey}`}
                                style={{
                                    position: 'relative',
                                    borderRadius: 14,
                                    overflow: 'hidden',
                                    opacity: 0,
                                    transform: 'translateY(6px)',
                                    animation: 'transaction-item-reveal 240ms ease forwards',
                                    animationDelay: `${Math.min(index * 38, 280)}ms`,
                                }}
                            >
                                <div
                                    style={{
                                        position: 'absolute',
                                        inset: 0,
                                        display: 'flex',
                                        justifyContent: 'flex-end',
                                        alignItems: 'stretch',
                                        gap: 6,
                                        padding: 6,
                                        background: 'var(--surface-soft)',
                                        border: '1px solid var(--surface-border)',
                                        opacity: showActions ? 1 : 0,
                                        pointerEvents: showActions ? 'auto' : 'none',
                                        transition: 'opacity 140ms ease',
                                    }}
                                >
                                    <button
                                        type="button"
                                        onClick={() => openEditModal(transaction)}
                                        style={{
                                            width: 42,
                                            border: '1px solid rgba(59,130,246,0.35)',
                                            borderRadius: 10,
                                            background: 'rgba(59,130,246,0.14)',
                                            color: '#2563eb',
                                            display: 'grid',
                                            placeItems: 'center',
                                        }}
                                        title="Chỉnh sửa"
                                    >
                                        <Pencil size={16} />
                                    </button>
                                    <button
                                        type="button"
                                        disabled={deletingId === transaction.id}
                                        onClick={() => {
                                            setDeleteTarget(transaction);
                                            setSwipedTransactionId(null);
                                        }}
                                        style={{
                                            width: 42,
                                            border: '1px solid rgba(239,68,68,0.35)',
                                            borderRadius: 10,
                                            background: 'rgba(239,68,68,0.14)',
                                            color: '#dc2626',
                                            display: 'grid',
                                            placeItems: 'center',
                                            opacity: deletingId === transaction.id ? 0.7 : 1,
                                        }}
                                        title="Xóa"
                                    >
                                        {deletingId === transaction.id ? <LoaderCircle size={16} className="spin" /> : <Trash2 size={16} />}
                                    </button>
                                </div>

                                <div
                                    onPointerDown={(event) => handlePointerDown(transaction.id, event)}
                                    onPointerMove={(event) => handlePointerMove(transaction.id, event)}
                                    onPointerUp={() => handlePointerEnd(transaction.id)}
                                    onPointerCancel={() => handlePointerEnd(transaction.id)}
                                    onClick={() => {
                                        if (ignoreNextClickRef.current) {
                                            ignoreNextClickRef.current = false;
                                            return;
                                        }
                                        if (swipedTransactionId === transaction.id) {
                                            setSwipedTransactionId(null);
                                        }
                                    }}
                                    style={{
                                        position: 'relative',
                                        zIndex: 1,
                                        borderRadius: 14,
                                        border: '1px solid var(--surface-border)',
                                        background: 'var(--surface-base)',
                                        padding: 9,
                                        display: 'grid',
                                        gap: 8,
                                        transform: `translateX(${translateX}px)`,
                                        transition: isDraggingThis ? 'none' : 'transform 180ms ease',
                                        touchAction: 'pan-y',
                                        cursor: isDraggingThis ? 'grabbing' : 'pointer',
                                    }}
                                >
                                    <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 10, alignItems: 'center' }}>
                                        <div
                                            style={{
                                                width: 42,
                                                height: 42,
                                                borderRadius: 13,
                                                border: '1px solid color-mix(in srgb, var(--surface-border) 70%, transparent)',
                                                background: 'color-mix(in srgb, var(--surface-soft) 85%, var(--surface-base))',
                                                display: 'grid',
                                                placeItems: 'center',
                                                fontSize: 20,
                                                flexShrink: 0,
                                            }}
                                        >
                                            {categoryIcon}
                                        </div>

                                        <div style={{ minWidth: 0 }}>
                                            <div style={{ fontSize: 14, fontWeight: 900, lineHeight: 1.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {transaction.description || (categoryNameMap[transaction.category] || transaction.category)}
                                            </div>
                                            <div style={{ marginTop: 2, color: 'var(--muted)', fontSize: 11.7, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {(categoryNameMap[transaction.category] || transaction.category)} • thêm lúc {formatFullDateTime(transaction.timestamp)}
                                            </div>
                                        </div>

                                        <div style={{ fontSize: 14.2, fontWeight: 900, color: isExpense ? '#f97316' : '#16a34a', whiteSpace: 'nowrap', paddingLeft: 6 }}>
                                            {isExpense ? '- ' : '+ '}
                                            {formatCurrencyVND(transaction.amount)}
                                        </div>
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

            {editingTransaction
                ? createPortal(
                      <div
                          onClick={(event) => {
                              if (event.target === event.currentTarget && !isSubmittingEdit) setEditingTransaction(null);
                          }}
                          style={{
                              position: 'fixed',
                              inset: 0,
                              zIndex: 1300,
                              background: 'rgba(2, 8, 23, 0.45)',
                              backdropFilter: 'blur(2px)',
                              display: 'grid',
                              alignItems: 'end',
                          }}
                      >
                          <div
                              style={{
                                  width: 'min(100%, 620px)',
                                  maxHeight: '82dvh',
                                  margin: '0 auto',
                                  borderRadius: '16px 16px 0 0',
                                  border: '1px solid var(--surface-border)',
                                  borderBottom: 'none',
                                  background: 'var(--surface-base)',
                                  overflow: 'auto',
                                  padding: 12,
                                  display: 'grid',
                                  gap: 9,
                              }}
                          >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <div style={{ fontWeight: 900, fontSize: 13.5 }}>Chỉnh sửa giao dịch</div>
                                  <button
                                      type="button"
                                      onClick={() => setEditingTransaction(null)}
                                      disabled={isSubmittingEdit}
                                      style={{
                                          width: 30,
                                          height: 30,
                                          borderRadius: 8,
                                          border: '1px solid var(--surface-border)',
                                          background: 'transparent',
                                          color: 'var(--muted)',
                                          display: 'grid',
                                          placeItems: 'center',
                                      }}
                                  >
                                      <X size={14} />
                                  </button>
                              </div>

                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                  {(['expense', 'income'] as const).map((type) => (
                                      <button
                                          key={type}
                                          type="button"
                                          onClick={() => {
                                              setEditType(type);
                                              const firstCategory = categories.find((item) => item.type === type)?.id || '';
                                              setEditCategoryId(firstCategory);
                                          }}
                                          style={{
                                              borderRadius: 9,
                                              border: editType === type ? '1.5px solid var(--chip-border)' : '1px solid var(--surface-border)',
                                              background: editType === type ? 'var(--chip-bg)' : 'transparent',
                                              color: 'var(--foreground)',
                                              fontSize: 11.5,
                                              padding: '8px 6px',
                                          }}
                                      >
                                          {type === 'expense' ? '💸 Chi tiêu' : '💰 Thu nhập'}
                                      </button>
                                  ))}
                              </div>

                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                  <div>
                                      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 5 }}>Số tiền</div>
                                      <input
                                          value={editAmount ? new Intl.NumberFormat('vi-VN').format(Number(editAmount) || 0) : ''}
                                          onChange={(event) => setEditAmount(event.target.value.replace(/\D/g, ''))}
                                          style={{
                                              width: '100%',
                                              borderRadius: 10,
                                              border: '1px solid var(--surface-border)',
                                              background: 'var(--surface-soft)',
                                              color: 'var(--foreground)',
                                              padding: '9px 10px',
                                              fontSize: 12.5,
                                              boxSizing: 'border-box',
                                          }}
                                      />
                                  </div>
                                  <div>
                                      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 5 }}>Ngày</div>
                                      <CustomDatePicker
                                          value={editDate}
                                          onChange={(val) => {
                                              if (val) setEditDate(val);
                                          }}
                                          zIndex={1400}
                                      />
                                  </div>
                              </div>

                              <div>
                                  <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 5 }}>Ví</div>
                                  <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                                      {wallets
                                          .filter((wallet) => wallet.isActive !== false)
                                          .map((wallet) => {
                                              const selected = editWalletId === wallet.id;
                                              return (
                                                  <button
                                                      key={wallet.id}
                                                      type="button"
                                                      onClick={() => setEditWalletId(wallet.id)}
                                                      style={{
                                                          borderRadius: 10,
                                                          border: selected
                                                              ? '1.5px solid var(--chip-border)'
                                                              : '1px solid var(--surface-border)',
                                                          background: selected ? 'var(--chip-bg)' : 'var(--surface-soft)',
                                                          color: 'var(--foreground)',
                                                          padding: '7px 11px',
                                                          fontSize: 12,
                                                          fontWeight: selected ? 800 : 600,
                                                          textAlign: 'center',
                                                      }}
                                                  >
                                                      <div>{wallet.name}</div>
                                                      <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
                                                          {formatCurrencyVND(wallet.balance)}
                                                      </div>
                                                  </button>
                                              );
                                          })}
                                  </div>
                              </div>

                              <div>
                                  <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                      <span>Danh mục</span>
                                      <button
                                          type="button"
                                          onClick={() => setIsCategoryOrderOpen(true)}
                                          style={{
                                              border: 'none',
                                              background: 'transparent',
                                              color: 'var(--accent)',
                                              fontSize: 11,
                                              fontWeight: 700,
                                              padding: 0,
                                              cursor: 'pointer',
                                          }}
                                      >
                                          Sắp xếp danh mục
                                      </button>
                                  </div>
                                  <div
                                      style={{
                                          display: 'grid',
                                          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                                          gap: 8,
                                      }}
                                  >
                                      {editTypeCategories.map((item) => {
                                          const selected = item.id === editCategoryId;

                                          return (
                                              <button
                                                  key={item.id}
                                                  type="button"
                                                  onClick={() => setEditCategoryId(item.id)}
                                                  style={{
                                                      minHeight: 44,
                                                      borderRadius: 10,
                                                      border: selected
                                                          ? '1px solid var(--theme-gradient-start)'
                                                          : '1px solid var(--surface-border)',
                                                      background: selected ? 'var(--chip-bg)' : 'var(--surface-soft)',
                                                      color: 'var(--foreground)',
                                                      fontSize: 'clamp(11px, 2.6vw, 12px)',
                                                      fontWeight: selected ? 700 : 600,
                                                      padding: '8px 6px',
                                                      textAlign: 'center',
                                                      lineHeight: 1.25,
                                                      wordBreak: 'break-word',
                                                      display: 'grid',
                                                      gap: 2,
                                                      placeItems: 'center',
                                                  }}
                                              >
                                                  <span style={{ fontSize: 15, lineHeight: 1 }}>{item.icon || '🧩'}</span>
                                                  <span>{item.name}</span>
                                              </button>
                                          );
                                      })}
                                  </div>
                              </div>

                              <div>
                                  <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 5 }}>Ghi chú</div>
                                  <input
                                      value={editDescription}
                                      onChange={(event) => setEditDescription(event.target.value)}
                                      style={{
                                          width: '100%',
                                          borderRadius: 10,
                                          border: '1px solid var(--surface-border)',
                                          background: 'var(--surface-soft)',
                                          color: 'var(--foreground)',
                                          padding: '9px 10px',
                                          fontSize: 12.5,
                                          boxSizing: 'border-box',
                                      }}
                                  />
                              </div>

                              {editError ? <div style={{ color: '#ef4444', fontSize: 12 }}>{editError}</div> : null}

                              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                                  <button
                                      type="button"
                                      onClick={() => setEditingTransaction(null)}
                                      disabled={isSubmittingEdit}
                                      style={{
                                          borderRadius: 9,
                                          border: '1px solid var(--surface-border)',
                                          background: 'transparent',
                                          color: 'var(--foreground)',
                                          fontSize: 12,
                                          padding: '8px 12px',
                                      }}
                                  >
                                      Đóng
                                  </button>
                                  <PrimaryButton
                                      onClick={() => void handleSaveEdit()}
                                      disabled={isSubmittingEdit}
                                  >
                                      {isSubmittingEdit ? <LoaderCircle size={14} className="spin" /> : <Check size={14} />}
                                      {isSubmittingEdit ? 'Đang lưu...' : 'Lưu thay đổi'}
                                  </PrimaryButton>
                              </div>
                          </div>
                      </div>,
                      document.body,
                  )
                : null}

            <CategoryOrderModal
                isOpen={isCategoryOrderOpen}
                type={editType}
                categories={categories}
                isSaving={isSavingCategoryOrder}
                onClose={() => setIsCategoryOrderOpen(false)}
                onSave={handleSaveCategoryOrder}
            />

            {deleteTarget
                ? createPortal(
                      <div
                          style={{
                              position: 'fixed',
                              inset: 0,
                              zIndex: 1310,
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
                                      <div style={{ fontSize: 15, fontWeight: 900 }}>Xác nhận xóa giao dịch</div>
                                      <div style={{ marginTop: 3, color: 'var(--muted)', fontSize: 12.5 }}>
                                          Bạn có chắc chắn muốn xóa giao dịch này?
                                      </div>
                                  </div>
                              </div>

                              <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                  <button
                                      type="button"
                                      onClick={() => setDeleteTarget(null)}
                                      disabled={deletingId === deleteTarget.id}
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
                                      onClick={() => void handleDeleteTransaction()}
                                      disabled={deletingId === deleteTarget.id}
                                      style={{
                                          minHeight: 40,
                                          borderRadius: 12,
                                          border: '1px solid color-mix(in srgb, var(--danger) 45%, var(--border))',
                                          background: 'color-mix(in srgb, var(--danger) 16%, transparent)',
                                          color: 'var(--danger)',
                                          fontWeight: 800,
                                      }}
                                  >
                                      {deletingId === deleteTarget.id ? 'Đang xóa...' : 'Đồng ý'}
                                  </button>
                              </div>
                          </AppCard>
                      </div>,
                      document.body,
                  )
                : null}
        </div>
    );
}
