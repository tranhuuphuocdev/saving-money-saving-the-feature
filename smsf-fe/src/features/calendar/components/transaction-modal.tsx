'use client';

import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { CustomSelect } from '@/components/common/custom-select';
import { PrimaryButton } from '@/components/common/primary-button';
import { formatCurrencyVND, formatTimeLabel, formatTransactionTypeLabel } from '@/lib/formatters';
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
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingTransactionId, setEditingTransactionId] = useState<string | null>(
        null,
    );
    const [amount, setAmount] = useState('');
    const [walletId, setWalletId] = useState(wallets[0]?.id ?? '');
    const [categoryId, setCategoryId] = useState('');
    const [type, setType] = useState<TypeTransactionKind>('expense');
    const [description, setDescription] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    const categoryNameMap = useMemo(() => {
        return categories.reduce<Record<string, string>>((acc, category) => {
            acc[category.id] = category.name;
            return acc;
        }, {});
    }, [categories]);

    const categoryOptions = useMemo(() => {
        const filtered = categories.filter((item) => item.type === type);
        return filtered.length > 0 ? filtered : categories;
    }, [categories, type]);

    useEffect(() => {
        if (!isFormOpen) {
            return;
        }

        if (!categoryOptions.some((item) => item.id === categoryId)) {
            setCategoryId(categoryOptions[0]?.id || '');
        }
    }, [isFormOpen, categoryId, categoryOptions]);

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
        setWalletId(wallets[0]?.id ?? '');
        setType('expense');
        setCategoryId(
            categories.find((item) => item.type === 'expense')?.id ||
                categories[0]?.id ||
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

    return createPortal(
        <>
            <div
                onClick={onClose}
                style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0, 0, 0, 0.5)',
                    zIndex: 900,
                }}
            />

            {isFormOpen ? (
                <div
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
                            {wallets.length === 0 ? (
                                <div
                                    style={{
                                        padding: '10px 12px',
                                        borderRadius: 10,
                                        border: '1px solid var(--surface-border)',
                                        color: 'var(--muted)',
                                        fontSize: 12,
                                    }}
                                >
                                    Chưa có ví để chọn.
                                </div>
                            ) : (
                                <div style={{ display: 'grid', gap: 8, maxHeight: 190, overflowY: 'auto' }}>
                                    {wallets.map((wallet) => {
                                        const isSelected = wallet.id === walletId;

                                        return (
                                            <button
                                                key={wallet.id}
                                                type="button"
                                                onClick={() => setWalletId(wallet.id)}
                                                style={{
                                                    borderRadius: 10,
                                                    border: isSelected
                                                        ? '1px solid var(--theme-gradient-start)'
                                                        : '1px solid var(--surface-border)',
                                                    background: isSelected
                                                        ? 'var(--chip-bg)'
                                                        : 'var(--surface-soft)',
                                                    color: 'var(--foreground)',
                                                    padding: '10px 12px',
                                                    display: 'grid',
                                                    gridTemplateColumns: '1fr auto',
                                                    alignItems: 'center',
                                                    gap: 10,
                                                    textAlign: 'left',
                                                }}
                                            >
                                                <div>
                                                    <div style={{ fontSize: 13, fontWeight: 700 }}>{wallet.name}</div>
                                                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                                                        {wallet.type.toUpperCase()} • {formatCurrencyVND(wallet.balance)}
                                                    </div>
                                                </div>

                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() =>
                                                        setWalletId((currentWalletId) =>
                                                            currentWalletId === wallet.id ? '' : wallet.id,
                                                        )
                                                    }
                                                    onClick={(event) => event.stopPropagation()}
                                                    style={{ width: 16, height: 16 }}
                                                />
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <CustomSelect
                            value={categoryId}
                            onChange={setCategoryId}
                            placeholder="Chưa có danh mục"
                            options={categoryOptions.map((item) => ({
                                value: item.id,
                                label: item.name,
                            }))}
                        />

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
                                                <div style={{ fontSize: 13, fontWeight: 700 }}>
                                                    {categoryNameMap[transaction.category] || transaction.category}
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
        </>,
        document.body,
    );
}
