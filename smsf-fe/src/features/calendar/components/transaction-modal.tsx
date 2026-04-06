'use client';

import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CategoryOrderModal } from '@/components/common/category-order-modal';
import { CustomSelect } from '@/components/common/custom-select';
import { PrimaryButton } from '@/components/common/primary-button';
import { createCategoryRequest, getCategoriesRequest, updateCategoryOrderRequest } from '@/lib/calendar/api';
import { formatCurrencyVND, formatTimeLabel, formatTransactionTypeLabel } from '@/lib/formatters';
import { getActiveSortedWallets } from '@/lib/wallet-selection';
import {
    ICalendarTransaction,
    ICategoryItem,
    ICreateTransactionPayload,
    IUpdateTransactionPayload,
    IWalletItem,
    TypeTransactionKind,
} from '@/types/calendar';

interface ITransactionModalProps {
    isOpen: boolean;
    date: number;
    month: number;
    year: number;
    transactions: ICalendarTransaction[];
    wallets: IWalletItem[];
    categories: ICategoryItem[];
    onClose: () => void;
    onAddTransaction: (payload: ICreateTransactionPayload) => Promise<void>;
    onUpdateTransaction: (
        transactionId: string,
        payload: IUpdateTransactionPayload,
    ) => Promise<void>;
    onDeleteTransaction: (transactionId: string) => Promise<void>;
}

const CATEGORY_ICON_OPTIONS = [
    '🍜', '🛵', '🛒', '🏠', '💡', '🎓', '💊', '🎬', '🛍️', '💘', '📦', '💼', '💰', '📈', '🎁', '🧾',
];

export function TransactionModal({
    isOpen,
    date,
    month,
    year,
    transactions,
    wallets,
    categories,
    onClose,
    onAddTransaction,
    onUpdateTransaction,
    onDeleteTransaction,
}: ITransactionModalProps) {
    const OTHER_CATEGORY_ID = 'other';
    const availableWallets = useMemo(
        () => getActiveSortedWallets(wallets),
        [wallets],
    );
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingTransactionId, setEditingTransactionId] = useState<string | null>(
        null,
    );
    const [amount, setAmount] = useState('');
    const richestWalletId = useMemo(() => {
        if (availableWallets.length === 0) {
            return '';
        }

        return availableWallets.reduce((bestWallet, wallet) => {
            if (!bestWallet || wallet.balance > bestWallet.balance) {
                return wallet;
            }

            return bestWallet;
        }, availableWallets[0]).id;
    }, [availableWallets]);

    const [walletId, setWalletId] = useState(richestWalletId);
    const [categoryId, setCategoryId] = useState('');
    const [type, setType] = useState<TypeTransactionKind>('expense');
    const [description, setDescription] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isMounted, setIsMounted] = useState(false);
    const [localCategories, setLocalCategories] = useState<ICategoryItem[]>(categories);
    const [isCreateCategoryOpen, setIsCreateCategoryOpen] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [newCategoryIcon, setNewCategoryIcon] = useState(CATEGORY_ICON_OPTIONS[0]);
    const [isCreatingCategory, setIsCreatingCategory] = useState(false);
    const [isCategoryOrderOpen, setIsCategoryOrderOpen] = useState(false);
    const [isSavingCategoryOrder, setIsSavingCategoryOrder] = useState(false);
    // Tracks when modal was opened to ignore ghost clicks (300ms delay) on mobile browsers
    const openedAtRef = useRef<number>(0);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    // Record the exact time this modal becomes open to debounce ghost clicks
    useEffect(() => {
        if (isOpen) {
            openedAtRef.current = Date.now();
        }
    }, [isOpen]);

    useEffect(() => {
        setLocalCategories(categories);
    }, [categories]);

    const categoryNameMap = useMemo(() => {
        return localCategories.reduce<Record<string, string>>((acc, category) => {
            acc[category.id] = category.name;
            return acc;
        }, {});
    }, [localCategories]);

    const categoryIconMap = useMemo(() => {
        return localCategories.reduce<Record<string, string>>((acc, category) => {
            acc[category.id] = category.icon || '';
            return acc;
        }, {});
    }, [localCategories]);

    const categoryOptions = useMemo(() => {
        const filtered = localCategories.filter((item) => item.type === type);
        return filtered.length > 0 ? filtered : localCategories;
    }, [localCategories, type]);

    const categoryGridOptions = useMemo(() => {
        const optionsWithoutOther = categoryOptions.filter(
            (item) => item.id !== OTHER_CATEGORY_ID,
        );

        return [
            ...optionsWithoutOther,
            {
                id: OTHER_CATEGORY_ID,
                name: 'Mục khác',
                icon: '➕',
                type,
                orderIndex: 9999,
                isDefault: false,
            },
        ];
    }, [OTHER_CATEGORY_ID, categoryOptions, type]);

    useEffect(() => {
        if (!isFormOpen) {
            return;
        }

        if (!categoryGridOptions.some((item) => item.id === categoryId)) {
            setCategoryId(categoryGridOptions[0]?.id || '');
        }
    }, [isFormOpen, categoryId, categoryGridOptions]);

    useEffect(() => {
        if (!isFormOpen) {
            return;
        }

        if (!availableWallets.some((wallet) => wallet.id === walletId)) {
            setWalletId(richestWalletId);
        }
    }, [availableWallets, isFormOpen, richestWalletId, walletId]);

    const totalIncome = useMemo(
        () =>
            transactions
                .filter((transaction) => transaction.type === 'income')
                .reduce((sum, transaction) => sum + transaction.amount, 0),
        [transactions],
    );
    const totalExpense = useMemo(
        () =>
            transactions
                .filter((transaction) => transaction.type === 'expense')
                .reduce((sum, transaction) => sum + transaction.amount, 0),
        [transactions],
    );

    if (!isOpen) {
        return null;
    }

    if (!isMounted) {
        return null;
    }

    const modalDateTimestamp = new Date(year, month - 1, date, 12, 0, 0, 0).getTime();

    const monthName = new Date(year, month - 1).toLocaleDateString('vi-VN', {
        month: 'long',
        year: 'numeric',
    });

    const netAmount = totalIncome - totalExpense;

    const beginCreateForm = () => {
        setErrorMessage('');
        setEditingTransactionId(null);
        setWalletId(richestWalletId);
        setType('expense');
        setCategoryId(
            localCategories.find((item) => item.type === 'expense')?.id ||
            localCategories[0]?.id ||
            '',
        );
        setAmount('');
        setDescription('');
        setIsFormOpen(true);
    };

    const beginEditForm = (transaction: ICalendarTransaction) => {
        setErrorMessage('');
        setEditingTransactionId(transaction.id);
        setWalletId(transaction.walletId);
        setCategoryId(transaction.category);
        setType(transaction.type);
        setAmount(String(Math.round(transaction.amount)));
        setDescription(transaction.description || '');
        setIsFormOpen(true);
    };

    const closeForm = () => {
        setIsFormOpen(false);
        setEditingTransactionId(null);
        setErrorMessage('');
    };

    const closeCreateCategoryModal = () => {
        setIsCreateCategoryOpen(false);
    };

    const submitCreateCategory = async () => {
        const safeName = newCategoryName.trim();

        if (!safeName) {
            setErrorMessage('Tên danh mục mới không được để trống.');
            return;
        }

        setIsCreatingCategory(true);

        try {
            const created = await createCategoryRequest({
                name: safeName,
                type,
                icon: newCategoryIcon,
            });

            setLocalCategories((prev) => {
                const existing = prev.find((item) => item.id === created.id);
                if (existing) {
                    return prev;
                }

                return [...prev, created];
            });

            setCategoryId(created.id);
            setIsCreateCategoryOpen(false);
            setNewCategoryName('');
            setErrorMessage('');
        } catch (error) {
            setErrorMessage(
                (error as { response?: { data?: { message?: string } } })?.response?.data
                    ?.message || 'Tạo danh mục thất bại.',
            );
        } finally {
            setIsCreatingCategory(false);
        }
    };

    const handleSaveCategoryOrder = async (categoryIds: string[]) => {
        setIsSavingCategoryOrder(true);
        try {
            await updateCategoryOrderRequest({
                type,
                categoryIds,
            });
            const refreshed = await getCategoriesRequest();
            setLocalCategories(refreshed);
            setIsCategoryOrderOpen(false);
        } catch (error) {
            setErrorMessage(
                (error as { response?: { data?: { message?: string } } })?.response?.data
                    ?.message || 'Cập nhật thứ tự danh mục thất bại.',
            );
        } finally {
            setIsSavingCategoryOrder(false);
        }
    };

    const validateForm = (): { isValid: boolean; amountValue: number } => {
        // Strip all non-digits and parse as safe integer to avoid float drift
        const digits = amount.replace(/\D/g, '');
        const amountValue = digits ? parseInt(digits, 10) : 0;

        if (!walletId) {
            setErrorMessage('Vui lòng chọn ví.');
            return { isValid: false, amountValue };
        }

        if (!Number.isFinite(amountValue) || amountValue <= 0) {
            setErrorMessage('Số tiền phải là số dương.');
            return { isValid: false, amountValue };
        }

        if (!categoryId) {
            setErrorMessage('Danh mục không được để trống.');
            return { isValid: false, amountValue };
        }

        setErrorMessage('');
        return { isValid: true, amountValue };
    };

    const submitForm = async () => {
        const validation = validateForm();
        if (!validation.isValid) {
            return;
        }

        setIsSubmitting(true);

        try {
            if (editingTransactionId) {
                await onUpdateTransaction(editingTransactionId, {
                    walletId,
                    amount: validation.amountValue,
                    category: categoryId,
                    type,
                    description: description.trim() || undefined,
                    timestamp: modalDateTimestamp,
                });
            } else {
                await onAddTransaction({
                    walletId,
                    amount: validation.amountValue,
                    category: categoryId,
                    type,
                    description: description.trim() || undefined,
                    timestamp: modalDateTimestamp,
                });
            }

            closeForm();
        } catch (error) {
            setErrorMessage(
                (error as { response?: { data?: { message?: string } } })?.response?.data
                    ?.message || 'Lưu giao dịch thất bại.',
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    const removeTransaction = async (transactionId: string) => {
        try {
            await onDeleteTransaction(transactionId);
        } catch (error) {
            setErrorMessage(
                (error as { response?: { data?: { message?: string } } })?.response?.data
                    ?.message || 'Xóa giao dịch thất bại.',
            );
        }
    };

    // Guard against ghost clicks on mobile: ignore close if triggered within 400ms of open
    const handleBackdropClose = (e: React.MouseEvent | React.TouchEvent) => {
        e.stopPropagation();
        if (Date.now() - openedAtRef.current < 400) {
            return;
        }
        onClose();
    };

    return createPortal(
        <>
            <div
                onClick={handleBackdropClose}
                onTouchEnd={handleBackdropClose}
                style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0, 0, 0, 0.5)',
                    zIndex: 900,
                }}
            />

            {isFormOpen ? (
                <div
                    onClick={(e) => e.stopPropagation()}
                    onTouchEnd={(e) => e.stopPropagation()}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 911,
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        padding: '12px',
                        overflowY: 'auto',
                    }}
                >
                    <div
                        style={{
                            width: 'min(calc(100% - 24px), 520px)',
                            maxHeight: 'calc(100dvh - 24px)',
                            borderRadius: 20,
                            background: 'var(--surface-base)',
                            border: '1px solid var(--surface-border)',
                            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
                            display: 'flex',
                            flexDirection: 'column',
                        }}
                    >
                        <div
                            style={{
                                padding: '14px 16px',
                                borderBottom: '1px solid var(--surface-border)',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                            }}
                        >
                            <h2 style={{ fontSize: 'clamp(15px, 3vw, 16px)', fontWeight: 700, margin: 0 }}>
                                {editingTransactionId ? 'Cập nhật giao dịch' : 'Thêm giao dịch mới'}
                            </h2>
                            <button
                                onClick={closeForm}
                                style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: 8,
                                    border: 'none',
                                    background: 'var(--chip-bg)',
                                    color: 'var(--foreground)',
                                    display: 'grid',
                                    placeItems: 'center',
                                    cursor: 'pointer',
                                }}
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div
                            style={{
                                padding: '14px 16px',
                                display: 'grid',
                                gap: 10,
                                overflowY: 'auto',
                            }}
                        >

                            {errorMessage ? (
                                <div
                                    style={{
                                        fontSize: 12,
                                        color: '#ef4444',
                                        background: 'rgba(239,68,68,0.08)',
                                        border: '1px solid rgba(239,68,68,0.18)',
                                        borderRadius: 8,
                                        padding: '8px 10px',
                                    }}
                                >
                                    {errorMessage}
                                </div>
                            ) : null}

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                {(['income', 'expense'] as const).map((transactionType) => (
                                    <button
                                        key={transactionType}
                                        onClick={() => setType(transactionType)}
                                        style={{
                                            padding: '9px 10px',
                                            borderRadius: 8,
                                            border:
                                                type === transactionType
                                                    ? '2px solid var(--theme-gradient-start)'
                                                    : '1px solid var(--surface-border)',
                                            background:
                                                type === transactionType
                                                    ? 'var(--chip-bg)'
                                                    : 'transparent',
                                            color: 'var(--foreground)',
                                            fontWeight: 700,
                                            fontSize: 12,
                                        }}
                                    >
                                        {transactionType === 'income' ? '💰 Thu nhập' : '💸 Chi tiêu'}
                                    </button>
                                ))}
                            </div>

                            <div style={{ position: 'relative' }}>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    value={
                                        amount
                                            ? new Intl.NumberFormat('vi-VN').format(
                                                parseInt(amount.replace(/\D/g, ''), 10) || 0,
                                            )
                                            : ''
                                    }
                                    onChange={(event) => {
                                        // Keep only digits in state; display handles formatting
                                        const digits = event.target.value.replace(/\D/g, '');
                                        setAmount(digits);
                                    }}
                                    placeholder="0"
                                    style={{
                                        padding: '10px 12px',
                                        paddingRight: 44,
                                        borderRadius: 10,
                                        border: '1px solid var(--surface-border)',
                                        background: 'var(--surface-soft)',
                                        color: 'var(--foreground)',
                                        fontSize: 14,
                                        width: '100%',
                                        boxSizing: 'border-box',
                                    }}
                                />
                                <span
                                    style={{
                                        position: 'absolute',
                                        right: 12,
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        fontSize: 12,
                                        fontWeight: 700,
                                        color: 'var(--muted)',
                                        pointerEvents: 'none',
                                    }}
                                >
                                    ₫
                                </span>
                            </div>

                            <div style={{ display: 'grid', gap: 8 }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>
                                    Chọn ví
                                </div>
                                {availableWallets.length === 0 ? (
                                    <div
                                        style={{
                                            padding: '10px 12px',
                                            borderRadius: 10,
                                            border: '1px solid var(--surface-border)',
                                            color: 'var(--muted)',
                                            fontSize: 12,
                                        }}
                                    >
                                        Không có ví khả dụng để chọn.
                                    </div>
                                ) : (
                                    <CustomSelect
                                        value={walletId}
                                        onChange={setWalletId}
                                        options={availableWallets.map((wallet) => ({
                                            value: wallet.id,
                                            label: `${wallet.name} • ${formatCurrencyVND(wallet.balance)}`,
                                        }))}
                                    />
                                )}
                            </div>

                            <div style={{ display: 'grid', gap: 8 }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span>Chọn danh mục</span>
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
                                    {categoryGridOptions.map((item) => {
                                        const isSelected = item.id === categoryId;

                                        return (
                                            <button
                                                key={item.id}
                                                type="button"
                                                onClick={() => {
                                                    if (item.id === OTHER_CATEGORY_ID) {
                                                        setNewCategoryName('');
                                                        setNewCategoryIcon(CATEGORY_ICON_OPTIONS[0]);
                                                        setIsCreateCategoryOpen(true);
                                                        return;
                                                    }

                                                    setCategoryId(item.id);
                                                }}
                                                style={{
                                                    minHeight: 44,
                                                    borderRadius: 10,
                                                    border: isSelected
                                                        ? '1px solid var(--theme-gradient-start)'
                                                        : '1px solid var(--surface-border)',
                                                    background: isSelected
                                                        ? 'var(--chip-bg)'
                                                        : 'var(--surface-soft)',
                                                    color: 'var(--foreground)',
                                                    fontSize: 'clamp(11px, 2.6vw, 12px)',
                                                    fontWeight: isSelected ? 700 : 600,
                                                    padding: '8px 6px',
                                                    textAlign: 'center',
                                                    lineHeight: 1.25,
                                                    wordBreak: 'break-word',
                                                    display: 'grid',
                                                    gap: 2,
                                                    placeItems: 'center',
                                                }}
                                            >
                                                {item.id === OTHER_CATEGORY_ID ? null : (
                                                    <span style={{ fontSize: 15, lineHeight: 1 }}>
                                                        {item.icon || '🧩'}
                                                    </span>
                                                )}
                                                <span>{item.name}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <input
                                type="text"
                                value={description}
                                onChange={(event) => setDescription(event.target.value)}
                                placeholder="Ghi chú"
                                style={{
                                    padding: '10px 12px',
                                    borderRadius: 10,
                                    border: '1px solid var(--surface-border)',
                                    background: 'var(--surface-soft)',
                                    color: 'var(--foreground)',
                                    fontSize: 14,
                                }}
                            />

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                <button
                                    onClick={closeForm}
                                    style={{
                                        border: '1px solid var(--surface-border)',
                                        background: 'transparent',
                                        color: 'var(--foreground)',
                                        borderRadius: 10,
                                        padding: '10px 12px',
                                        fontWeight: 700,
                                    }}
                                >
                                    Hủy
                                </button>
                                <PrimaryButton
                                    onClick={submitForm}
                                    disabled={isSubmitting}
                                    style={{
                                        padding: '10px 12px',
                                        opacity: isSubmitting ? 0.7 : 1,
                                    }}
                                >
                                    {isSubmitting ? (
                                        <span>Đang lưu...</span>
                                    ) : (
                                        <>
                                            <Check size={16} /> Lưu
                                        </>
                                    )}
                                </PrimaryButton>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div
                    onClick={(e) => e.stopPropagation()}
                    onTouchEnd={(e) => e.stopPropagation()}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 910,
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        padding: '12px',
                        overflowY: 'auto',
                    }}
                >
                    <div
                        style={{
                            width: 'min(calc(100% - 24px), 560px)',
                            maxHeight: 'calc(100dvh - 24px)',
                            borderRadius: 20,
                            background: 'var(--surface-base)',
                            border: '1px solid var(--surface-border)',
                            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
                            display: 'flex',
                            flexDirection: 'column',
                        }}
                    >
                        <div
                            style={{
                                padding: '14px 16px',
                                borderBottom: '1px solid var(--surface-border)',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                            }}
                        >
                            <h2 style={{ fontSize: 'clamp(15px, 3vw, 16px)', fontWeight: 700, margin: 0 }}>
                                Ngày {date} {monthName}
                            </h2>
                            <button
                                onClick={onClose}
                                style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: 8,
                                    border: 'none',
                                    background: 'var(--chip-bg)',
                                    color: 'var(--foreground)',
                                    display: 'grid',
                                    placeItems: 'center',
                                    cursor: 'pointer',
                                }}
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div
                            style={{
                                padding: '12px 16px',
                                background: 'var(--chip-bg)',
                                display: 'grid',
                                gridTemplateColumns: '1fr 1fr 1fr',
                                gap: 8,
                                borderBottom: '1px solid var(--surface-border)',
                            }}
                        >
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 3 }}>Thu nhập</div>
                                <div style={{ fontSize: 13, fontWeight: 700, color: '#10b981' }}>
                                    +{formatCurrencyVND(totalIncome)}
                                </div>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 3 }}>Chi tiêu</div>
                                <div style={{ fontSize: 13, fontWeight: 700, color: '#ef4444' }}>
                                    -{formatCurrencyVND(totalExpense)}
                                </div>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 3 }}>Lệch</div>
                                <div
                                    style={{
                                        fontSize: 13,
                                        fontWeight: 700,
                                        color: netAmount >= 0 ? '#10b981' : '#ef4444',
                                    }}
                                >
                                    {netAmount >= 0 ? '+' : ''}
                                    {formatCurrencyVND(netAmount)}
                                </div>
                            </div>
                        </div>

                        <div style={{ flex: 1, overflowY: 'auto' }}>
                            {transactions.length === 0 ? (
                                <div style={{ padding: '26px 16px', textAlign: 'center', color: 'var(--muted)' }}>
                                    Không có giao dịch nào
                                </div>
                            ) : (
                                transactions.map((transaction) => {
                                    const transactionWallet = wallets.find(
                                        (wallet) => wallet.id === transaction.walletId,
                                    );

                                    return (
                                        <div
                                            key={transaction.id}
                                            style={{
                                                padding: '10px 16px',
                                                borderBottom: '1px solid var(--surface-border)',
                                                display: 'grid',
                                                gridTemplateColumns: '1fr auto',
                                                gap: 8,
                                            }}
                                        >
                                            <div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                                    <span style={{ fontSize: 14, lineHeight: 1 }}>
                                                        {categoryIconMap[transaction.category] || '🧩'}
                                                    </span>
                                                    <div style={{ fontSize: 13, fontWeight: 700 }}>
                                                        {transaction.cateName || categoryNameMap[transaction.category] || transaction.category}
                                                    </div>
                                                    <span
                                                        style={{
                                                            padding: '2px 7px',
                                                            borderRadius: 999,
                                                            fontSize: 10,
                                                            fontWeight: 700,
                                                            color: transaction.type === 'expense' ? '#b91c1c' : '#166534',
                                                            background: transaction.type === 'expense' ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.12)',
                                                        }}
                                                    >
                                                        {formatTransactionTypeLabel(transaction.type)}
                                                    </span>
                                                </div>
                                                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                                                    {transactionWallet?.name || 'Không rõ ví'}
                                                    {transaction.description ? ` • ${transaction.description}` : ''}
                                                </div>
                                                <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
                                                    {formatTimeLabel(transaction.timestamp)}
                                                </div>
                                            </div>
                                            <div style={{ display: 'grid', gap: 6, justifyItems: 'end' }}>
                                                <div
                                                    style={{
                                                        fontSize: 13,
                                                        fontWeight: 700,
                                                        color:
                                                            transaction.type === 'income'
                                                                ? '#15803d'
                                                                : '#dc2626',
                                                    }}
                                                >
                                                    {transaction.type === 'income' ? '+' : '-'}
                                                    {formatCurrencyVND(transaction.amount)}
                                                </div>
                                                <div style={{ display: 'flex', gap: 6 }}>
                                                    <button
                                                        onClick={() => beginEditForm(transaction)}
                                                        style={{
                                                            border: '1px solid var(--surface-border)',
                                                            background: 'transparent',
                                                            color: 'var(--foreground)',
                                                            borderRadius: 8,
                                                            width: 28,
                                                            height: 28,
                                                            display: 'grid',
                                                            placeItems: 'center',
                                                        }}
                                                    >
                                                        <Pencil size={13} />
                                                    </button>
                                                    <button
                                                        onClick={() => void removeTransaction(transaction.id)}
                                                        style={{
                                                            border: '1px solid rgba(239,68,68,0.25)',
                                                            background: 'transparent',
                                                            color: '#ef4444',
                                                            borderRadius: 8,
                                                            width: 28,
                                                            height: 28,
                                                            display: 'grid',
                                                            placeItems: 'center',
                                                        }}
                                                    >
                                                        <Trash2 size={13} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--surface-border)' }}>
                            <button
                                onClick={beginCreateForm}
                                style={{
                                    width: '100%',
                                    padding: '12px',
                                    borderRadius: 10,
                                    border: '1px solid var(--theme-gradient-start)',
                                    background: 'transparent',
                                    color: 'var(--theme-gradient-start)',
                                    fontWeight: 700,
                                    fontSize: 14,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 6,
                                }}
                            >
                                <Plus size={16} /> Thêm giao dịch
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <CategoryOrderModal
                isOpen={isCategoryOrderOpen}
                type={type}
                categories={localCategories}
                isSaving={isSavingCategoryOrder}
                onClose={() => setIsCategoryOrderOpen(false)}
                onSave={handleSaveCategoryOrder}
            />

            {isCreateCategoryOpen ? (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 920,
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        padding: '12px',
                        background: 'rgba(2, 8, 23, 0.5)',
                        backdropFilter: 'blur(2px)',
                    }}
                >
                    <div
                        style={{
                            width: 'min(calc(100% - 24px), 480px)',
                            maxHeight: 'calc(100dvh - 24px)',
                            borderRadius: 18,
                            background: 'var(--surface-base)',
                            border: '1px solid var(--surface-border)',
                            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
                            display: 'flex',
                            flexDirection: 'column',
                            overflow: 'hidden',
                        }}
                    >
                        <div
                            style={{
                                padding: '12px 14px',
                                borderBottom: '1px solid var(--surface-border)',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                            }}
                        >
                            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800 }}>Tạo danh mục mới</h3>
                            <button
                                onClick={closeCreateCategoryModal}
                                style={{
                                    width: 30,
                                    height: 30,
                                    borderRadius: 8,
                                    border: 'none',
                                    background: 'var(--chip-bg)',
                                    color: 'var(--foreground)',
                                    display: 'grid',
                                    placeItems: 'center',
                                }}
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <div style={{ padding: '12px 14px', display: 'grid', gap: 10, overflowY: 'auto' }}>
                            <input
                                type="text"
                                value={newCategoryName}
                                onChange={(event) => setNewCategoryName(event.target.value)}
                                placeholder="Tên category (VD: Cà phê sáng)"
                                style={{
                                    padding: '10px 12px',
                                    borderRadius: 10,
                                    border: '1px solid var(--surface-border)',
                                    background: 'var(--surface-soft)',
                                    color: 'var(--foreground)',
                                    fontSize: 13,
                                }}
                            />

                            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>
                                Chọn icon
                            </div>

                            <div
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                                    gap: 8,
                                }}
                            >
                                {CATEGORY_ICON_OPTIONS.map((icon) => {
                                    const selected = icon === newCategoryIcon;

                                    return (
                                        <button
                                            key={icon}
                                            type="button"
                                            onClick={() => setNewCategoryIcon(icon)}
                                            style={{
                                                borderRadius: 10,
                                                border: selected
                                                    ? '1px solid var(--theme-gradient-start)'
                                                    : '1px solid var(--surface-border)',
                                                background: selected ? 'var(--chip-bg)' : 'var(--surface-soft)',
                                                color: 'var(--foreground)',
                                                aspectRatio: '1 / 1',
                                                display: 'grid',
                                                placeItems: 'center',
                                                fontSize: 20,
                                            }}
                                        >
                                            {icon}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div
                            style={{
                                padding: '12px 14px',
                                borderTop: '1px solid var(--surface-border)',
                                display: 'grid',
                                gridTemplateColumns: '1fr 1fr',
                                gap: 8,
                            }}
                        >
                            <button
                                onClick={closeCreateCategoryModal}
                                style={{
                                    border: '1px solid var(--surface-border)',
                                    background: 'transparent',
                                    color: 'var(--foreground)',
                                    borderRadius: 10,
                                    padding: '10px 12px',
                                    fontWeight: 700,
                                }}
                            >
                                Hủy
                            </button>
                            <PrimaryButton
                                onClick={submitCreateCategory}
                                disabled={isCreatingCategory}
                                style={{
                                    padding: '10px 12px',
                                    opacity: isCreatingCategory ? 0.7 : 1,
                                }}
                            >
                                {isCreatingCategory ? 'Đang tạo...' : 'Tạo category'}
                            </PrimaryButton>
                        </div>
                    </div>
                </div>
            ) : null}
        </>,
        document.body,
    );
}
