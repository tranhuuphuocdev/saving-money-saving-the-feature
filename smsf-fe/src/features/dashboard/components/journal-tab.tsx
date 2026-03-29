'use client';

import { Check, ImagePlus, LoaderCircle, MessageCircle, Pencil, Send, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AppCard } from '@/components/common/app-card';
import { CustomSelect } from '@/components/common/custom-select';
import { PrimaryButton } from '@/components/common/primary-button';
import {
    analyzeSmartReceiptRequest,
    analyzeSmartTextRequest,
    createTransactionRequest,
    getCategoriesRequest,
    getRecentTransactionsRequest,
    getWalletsRequest,
} from '@/lib/calendar/api';
import { formatCurrencyVND } from '@/lib/formatters';
import { useAuth } from '@/providers/auth-provider';
import { IAiTransactionSuggestion } from '@/types/ai';
import { ICalendarTransaction, ICategoryItem, IWalletItem, TypeTransactionKind } from '@/types/calendar';

interface IImageAttachment {
    base64: string;
    mimeType: string;
    previewUrl: string;
    fileName: string;
}

interface ITransactionDraft {
    walletId: string;
    amount: string;
    categoryId: string;
    type: TypeTransactionKind;
    timestamp: number;
    description: string;
    merchant?: string;
    confidence: number;
    warnings: string[];
    status: 'pending' | 'creating' | 'confirmed' | 'cancelled' | 'error';
    error?: string;
    isEditing: boolean;
}

interface IChatMessage {
    id: string;
    role: 'user' | 'assistant';
    text?: string;
    imageUrl?: string;
    transactionDraft?: ITransactionDraft;
    compact?: boolean;
}

interface IRecentActionItem {
    transaction: ICalendarTransaction;
    actionCreatedAt: number;
}

const formatDateInput = (timestamp: number): string => {
    const date = new Date(timestamp);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');

    return `${y}-${m}-${d}`;
};

const formatDateDisplay = (timestamp: number): string => {
    const date = new Date(timestamp);
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();

    return `${d}/${m}/${y}`;
};

const formatDateTimeDisplay = (timestamp: number): string => {
    const date = new Date(timestamp);
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');

    return `${d}/${m}/${y} ${hh}:${mm}`;
};

const parseDateInputToTimestamp = (dateInput: string): number => {
    const parsed = Date.parse(`${dateInput}T12:00:00`);
    if (!Number.isFinite(parsed)) return Date.now();
    return parsed;
};

const truncateText = (value: string | undefined, maxLength = 34): string => {
    const text = String(value || '').trim();
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return `${text.slice(0, maxLength).trimEnd()}...`;
};

const TRANSACTION_INTENT_PATTERN = /(\d|k\b|tr\b|triệu|nghìn|ngan|đ\b|vnd|chi|thu|mua|trả|lương|xăng|đi chợ|hoa don|hoá đơn|bill)/i;

const seemsTransactionIntent = (text: string): boolean => {
    return TRANSACTION_INTENT_PATTERN.test(String(text || '').toLowerCase());
};

const normalizeAiWarnings = (warnings: string[]): string[] => {
    return warnings
        .map((item) => {
            const text = String(item || '').trim();
            if (!text) return '';
            if (text.includes('Unable to determine amount confidently')) return 'Chưa xác định chắc chắn số tiền.';
            if (text.includes('Could not map category to existing categories')) return 'Chưa khớp danh mục tự động, bạn có thể chọn thủ công.';
            if (text.includes('AI confidence is low')) return 'Độ tin cậy thấp, nên kiểm tra lại trước khi tạo.';
            return text;
        })
        .filter(Boolean);
};

const isSuggestionActionable = (
    suggestion: IAiTransactionSuggestion,
    resolvedCategoryId: string,
): boolean => {
    if (!suggestion.amount || suggestion.amount <= 0) return false;
    if (!resolvedCategoryId) return false;
    if (suggestion.confidence < 0.35) return false;
    return true;
};

const buildDraftFromSuggestion = (params: {
    walletId: string;
    categoryId: string;
    amount: number | null;
    timestamp: number;
    type: TypeTransactionKind;
    description?: string;
    merchant?: string;
    confidence: number;
    warnings: string[];
}): ITransactionDraft => {
    const description = [params.merchant, params.description]
        .filter(Boolean)
        .join(' - ')
        .trim();

    return {
        walletId: params.walletId,
        amount: params.amount ? String(Math.round(params.amount)) : '',
        categoryId: params.categoryId,
        type: params.type,
        timestamp: Number.isFinite(params.timestamp) ? params.timestamp : Date.now(),
        description,
        merchant: params.merchant,
        confidence: params.confidence,
        warnings: params.warnings,
        status: 'pending',
        isEditing: false,
    };
};

export function ChatTab() {
    const { refreshWallets } = useAuth();
    const [messages, setMessages] = useState<IChatMessage[]>([
        {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            compact: true,
            text: 'Nhắn nhanh với tui hoặc cho tui ảnh đi tui tạo giao dịch cho nè!',
        },
    ]);
    const [wallets, setWallets] = useState<IWalletItem[]>([]);
    const [categories, setCategories] = useState<ICategoryItem[]>([]);
    const [selectedWalletId, setSelectedWalletId] = useState('');
    const [textInput, setTextInput] = useState('');
    const [imageAttachment, setImageAttachment] = useState<IImageAttachment | null>(null);
    const [recentActions, setRecentActions] = useState<IRecentActionItem[]>([]);
    const [isBusy, setIsBusy] = useState(false);
    const [isRecentLoading, setIsRecentLoading] = useState(false);
    const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
    const [topError, setTopError] = useState('');
    const chatViewportRef = useRef<HTMLDivElement | null>(null);
    const shouldAutoScrollRef = useRef(false);

    useEffect(() => {
        let ignore = false;

        Promise.all([getWalletsRequest(), getCategoriesRequest()])
            .then(([walletSummary, fetchedCategories]) => {
                if (ignore) return;

                setWallets(walletSummary.wallets);
                setCategories(fetchedCategories);

                if (walletSummary.wallets.length > 0) {
                    const richest = walletSummary.wallets.reduce((a, b) =>
                        b.balance > a.balance ? b : a,
                    );
                    setSelectedWalletId(richest.id);
                }
            })
            .catch(() => {
                if (ignore) return;
                setTopError('Không thể tải dữ liệu ví/danh mục. Vui lòng thử lại.');
            });

        return () => {
            ignore = true;
        };
    }, []);

    const loadRecentTransactions = async () => {
        setIsRecentLoading(true);
        try {
            const items = await getRecentTransactionsRequest(20);
            setRecentActions((previous) => {
                const prevActionMap = new Map(
                    previous.map((item) => [item.transaction.id, item.actionCreatedAt]),
                );

                const merged = items.map((transaction) => ({
                    transaction,
                    actionCreatedAt:
                        prevActionMap.get(transaction.id)
                        || transaction.createdAt
                        || transaction.updatedAt
                        || transaction.timestamp,
                }));

                return merged
                    .sort((a, b) => b.actionCreatedAt - a.actionCreatedAt)
                    .slice(0, 5);
            });
        } catch {
            setRecentActions([]);
        } finally {
            setIsRecentLoading(false);
        }
    };

    useEffect(() => {
        void loadRecentTransactions();
    }, []);

    const scrollChatToBottom = (behavior: ScrollBehavior = 'smooth') => {
        if (!chatViewportRef.current) return;

        chatViewportRef.current.scrollTo({
            top: chatViewportRef.current.scrollHeight,
            behavior,
        });
    };

    useEffect(() => {
        if (!shouldAutoScrollRef.current) return;

        requestAnimationFrame(() => {
            scrollChatToBottom('smooth');
            shouldAutoScrollRef.current = false;
        });
    }, [messages.length, isBusy]);

    useEffect(() => {
        return () => {
            if (imageAttachment?.previewUrl) {
                URL.revokeObjectURL(imageAttachment.previewUrl);
            }
        };
    }, [imageAttachment]);

    const walletOptions = useMemo(
        () =>
            wallets.map((wallet) => ({
                value: wallet.id,
                label: `${wallet.name} • ${formatCurrencyVND(wallet.balance)}`,
            })),
        [wallets],
    );

    const editingMessage = useMemo(
        () => messages.find((message) => message.id === editingMessageId && message.transactionDraft),
        [messages, editingMessageId],
    );

    const editingDraft = editingMessage?.transactionDraft;

    useEffect(() => {
        if (!selectedWalletId) return;

        setMessages((previous) =>
            previous.map((message) => {
                if (!message.transactionDraft) return message;

                const draft = message.transactionDraft;
                const shouldSyncWallet =
                    !draft.isEditing
                    && (draft.status === 'pending' || draft.status === 'error')
                    && draft.walletId !== selectedWalletId;

                if (!shouldSyncWallet) return message;

                return {
                    ...message,
                    transactionDraft: {
                        ...draft,
                        walletId: selectedWalletId,
                        error: undefined,
                    },
                };
            }),
        );
    }, [selectedWalletId]);

    const updateMessageDraft = (
        messageId: string,
        updater: (draft: ITransactionDraft) => ITransactionDraft,
    ) => {
        setMessages((previous) =>
            previous.map((message) => {
                if (message.id !== messageId || !message.transactionDraft) return message;

                return {
                    ...message,
                    transactionDraft: updater(message.transactionDraft),
                };
            }),
        );
    };

    const appendSuggestionMessage = (args: {
        text?: string;
        walletId: string;
        categoryId: string;
        amount: number | null;
        timestamp: number;
        type: TypeTransactionKind;
        description?: string;
        merchant?: string;
        confidence: number;
        warnings: string[];
    }) => {
        const draft = buildDraftFromSuggestion({
            walletId: args.walletId,
            categoryId: args.categoryId,
            amount: args.amount,
            timestamp: args.timestamp,
            type: args.type,
            description: args.description,
            merchant: args.merchant,
            confidence: args.confidence,
            warnings: normalizeAiWarnings(args.warnings),
        });

        setMessages((previous) => [
            ...previous,
            {
                id: `assistant-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                role: 'assistant',
                text: args.text || 'Mình đã phân tích xong. Kiểm tra và xác nhận nhanh bên dưới.',
                transactionDraft: draft,
            },
        ]);
    };

    const resolveCategoryId = (input: {
        categoryId?: string;
        categoryName?: string;
        type: TypeTransactionKind;
    }): string => {
        if (input.categoryId && categories.some((item) => item.id === input.categoryId)) {
            return input.categoryId;
        }

        if (input.categoryName) {
            const byName = categories.find(
                (item) => item.type === input.type && item.name.toLowerCase() === input.categoryName?.toLowerCase(),
            );

            if (byName) return byName.id;
        }

        return categories.find((item) => item.type === input.type)?.id || categories[0]?.id || '';
    };

    const handleSendText = async () => {
        const normalized = textInput.trim();
        if (!normalized || isBusy) return;

        setTopError('');
        if (!seemsTransactionIntent(normalized)) {
            shouldAutoScrollRef.current = true;
            setMessages((previous) => [
                ...previous,
                {
                    id: `user-${Date.now()}`,
                    role: 'user',
                    text: normalized,
                },
                {
                    id: `assistant-help-${Date.now()}`,
                    role: 'assistant',
                    compact: true,
                    text: 'Mình chỉ xử lý nội dung liên quan giao dịch. Bạn thử dạng: "Đi chợ 100k hôm qua" hoặc "Ăn trưa 45k" nhé.',
                },
            ]);
            setTextInput('');
            return;
        }

        setIsBusy(true);
        shouldAutoScrollRef.current = true;
        setMessages((previous) => [
            ...previous,
            {
                id: `user-${Date.now()}`,
                role: 'user',
                text: normalized,
            },
        ]);
        setTextInput('');

        try {
            const suggestion = await analyzeSmartTextRequest({
                text: normalized,
                walletId: selectedWalletId || undefined,
                fallbackTimestamp: Date.now(),
            });

            const resolvedCategoryId = resolveCategoryId({
                categoryId: suggestion.categoryId,
                categoryName: suggestion.categoryName,
                type: suggestion.type,
            });

            if (!isSuggestionActionable(suggestion, resolvedCategoryId)) {
                setMessages((previous) => [
                    ...previous,
                    {
                        id: `assistant-soft-${Date.now()}`,
                        role: 'assistant',
                        compact: true,
                        text: 'Mình chưa đủ dữ liệu để tạo giao dịch. Bạn thêm số tiền và ngữ cảnh rõ hơn nhé.',
                    },
                ]);
                return;
            }

            appendSuggestionMessage({
                walletId: selectedWalletId || wallets[0]?.id || '',
                categoryId: resolvedCategoryId,
                amount: suggestion.amount,
                timestamp: suggestion.timestamp,
                type: suggestion.type,
                description: suggestion.description,
                merchant: suggestion.merchant,
                confidence: suggestion.confidence,
                warnings: suggestion.warnings,
            });
        } catch (error) {
            setMessages((previous) => [
                ...previous,
                {
                    id: `assistant-error-${Date.now()}`,
                    role: 'assistant',
                    text: (error as { response?: { data?: { message?: string } } })?.response?.data?.message
                        || 'AI chưa phân tích được từ nội dung nhập. Bạn thử diễn đạt rõ hơn nhé.',
                },
            ]);
        } finally {
            setIsBusy(false);
        }
    };

    const fileToBase64 = (file: File): Promise<string> =>
        new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const result = String(reader.result || '');
                const base64 = result.split(',')[1] || '';
                resolve(base64);
            };
            reader.onerror = () => reject(new Error('Không thể đọc file ảnh.'));
            reader.readAsDataURL(file);
        });

    const handlePickImage = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;

        const mimeType = String(file.type || '').toLowerCase();
        const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/heic', 'image/heif'];
        if (!allowed.includes(mimeType)) {
            setTopError('Định dạng ảnh chưa được hỗ trợ. Hãy chọn PNG/JPG/WEBP/HEIC.');
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            setTopError('Ảnh quá lớn (tối đa 5MB).');
            return;
        }

        if (imageAttachment?.previewUrl) {
            URL.revokeObjectURL(imageAttachment.previewUrl);
        }

        try {
            const base64 = await fileToBase64(file);
            const previewUrl = URL.createObjectURL(file);
            setImageAttachment({
                base64,
                mimeType,
                previewUrl,
                fileName: file.name,
            });
            setTopError('');
        } catch (error) {
            setTopError((error as Error).message || 'Không thể xử lý ảnh.');
        }
    };

    const handleAnalyzeImage = async () => {
        if (!imageAttachment || isBusy) return;

        setIsBusy(true);
        setTopError('');
        shouldAutoScrollRef.current = true;

        setMessages((previous) => [
            ...previous,
            {
                id: `user-image-${Date.now()}`,
                role: 'user',
                text: `Phân tích hóa đơn: ${imageAttachment.fileName}`,
                imageUrl: imageAttachment.previewUrl,
            },
        ]);

        try {
            const suggestion = await analyzeSmartReceiptRequest({
                imageBase64: imageAttachment.base64,
                mimeType: imageAttachment.mimeType,
                walletId: selectedWalletId || undefined,
                fallbackTimestamp: Date.now(),
            });

            const resolvedCategoryId = resolveCategoryId({
                categoryId: suggestion.categoryId,
                categoryName: suggestion.categoryName,
                type: suggestion.type,
            });

            if (!isSuggestionActionable(suggestion, resolvedCategoryId)) {
                setMessages((previous) => [
                    ...previous,
                    {
                        id: `assistant-receipt-soft-${Date.now()}`,
                        role: 'assistant',
                        compact: true,
                        text: 'Mình chưa đọc đủ dữ liệu từ ảnh để tạo giao dịch. Bạn thử ảnh rõ hơn hoặc nhập tay số tiền nhé.',
                    },
                ]);
                return;
            }

            appendSuggestionMessage({
                text: 'Mình đã phân tích. Đây là giao dịch được đề xuất từ trợ lý Pô con.',
                walletId: selectedWalletId || wallets[0]?.id || '',
                categoryId: resolvedCategoryId,
                amount: suggestion.amount,
                timestamp: suggestion.timestamp,
                type: suggestion.type,
                description: suggestion.description,
                merchant: suggestion.merchant,
                confidence: suggestion.confidence,
                warnings: suggestion.warnings,
            });
        } catch (error) {
            setMessages((previous) => [
                ...previous,
                {
                    id: `assistant-error-${Date.now()}`,
                    role: 'assistant',
                    text: (error as { response?: { data?: { message?: string } } })?.response?.data?.message
                        || 'Không thể phân tích hóa đơn lúc này. Bạn thử lại với ảnh rõ hơn nhé.',
                },
            ]);
        } finally {
            setIsBusy(false);
            setImageAttachment(null);
        }
    };

    const handleConfirmDraft = async (messageId: string, draft: ITransactionDraft) => {
        const amount = Number(draft.amount);
        if (!draft.walletId || !draft.categoryId || !Number.isFinite(amount) || amount <= 0) {
            updateMessageDraft(messageId, (current) => ({
                ...current,
                status: 'error',
                error: 'Vui lòng điền đủ ví, danh mục và số tiền hợp lệ.',
            }));
            return;
        }

        updateMessageDraft(messageId, (current) => ({
            ...current,
            status: 'creating',
            error: undefined,
        }));

        try {
            const result = await createTransactionRequest({
                walletId: draft.walletId,
                amount,
                category: draft.categoryId,
                description: draft.description || undefined,
                type: draft.type,
                timestamp: draft.timestamp,
            });

            if (Array.isArray(result.wallets) && result.wallets.length > 0) {
                setWallets(result.wallets);
                setSelectedWalletId((current) => {
                    if (current && result.wallets.some((wallet) => wallet.id === current)) {
                        return current;
                    }

                    return result.wallets[0]?.id || '';
                });
            }

            // Keep dashboard-level wallet summaries in sync after chat-created transactions.
            try {
                await refreshWallets();
            } catch {
                // Ignore here because local wallet state already updated from transaction response.
            }

            const actionTime = Date.now();
            const createdTransaction: ICalendarTransaction = result.transaction || {
                id: `local-${messageId}-${actionTime}`,
                walletId: draft.walletId,
                amount,
                category: draft.categoryId,
                description: draft.description || undefined,
                type: draft.type,
                timestamp: draft.timestamp,
                date: new Date(draft.timestamp).getDate(),
                createdAt: actionTime,
                updatedAt: actionTime,
            };

            setRecentActions((previous) => {
                const filtered = previous.filter((item) => item.transaction.id !== createdTransaction.id);

                return [
                    { transaction: createdTransaction, actionCreatedAt: actionTime },
                    ...filtered,
                ]
                    .sort((a, b) => b.actionCreatedAt - a.actionCreatedAt)
                    .slice(0, 5);
            });

            updateMessageDraft(messageId, (current) => ({
                ...current,
                status: 'confirmed',
                isEditing: false,
            }));
            if (editingMessageId === messageId) {
                setEditingMessageId(null);
            }
            window.dispatchEvent(new CustomEvent('transaction:changed'));
            void loadRecentTransactions();
        } catch (error) {
            const rawMessage =
                (error as { response?: { data?: { message?: string } } })?.response?.data?.message
                || 'Tạo giao dịch thất bại.';
            const isInsufficientBalance = /insufficient|kh[oô]ng đủ tiền|số dư|so du|balance/i.test(rawMessage);

            if (isInsufficientBalance && selectedWalletId && selectedWalletId !== draft.walletId) {
                updateMessageDraft(messageId, (current) => ({
                    ...current,
                    walletId: selectedWalletId,
                    status: 'error',
                    error: 'Ví trước không đủ tiền. Mình đã đổi sang ví mặc định mới, bấm tạo lại để thử.',
                }));
                return;
            }

            updateMessageDraft(messageId, (current) => ({
                ...current,
                status: 'error',
                error: rawMessage,
            }));
        }
    };

    const renderDraftCard = (messageId: string, draft: ITransactionDraft) => {
        const categoryLabel = categories.find((item) => item.id === draft.categoryId)?.name || 'Chưa rõ danh mục';
        const categoryIcon = categories.find((item) => item.id === draft.categoryId)?.icon || '🧩';
        const draftAmount = draft.amount ? Number(draft.amount) : 0;

        return (
            <div
                style={{
                    marginTop: 8,
                    border: '1px solid var(--surface-border)',
                    borderRadius: 10,
                    background: 'var(--surface-base)',
                    padding: 8,
                    display: 'grid',
                    gap: 8,
                }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                    <div style={{ fontWeight: 800, fontSize: 12.2 }}>Kiểm tra giao dịch</div>
                    <div style={{ color: 'var(--muted)', fontSize: 10.5 }}>
                        {Math.round(draft.confidence * 100)}%
                    </div>
                </div>

                {draft.warnings.length > 0 ? (
                    <div style={{ fontSize: 10.5, color: '#f59e0b', lineHeight: 1.4 }}>
                        {draft.warnings.join(' ')}
                    </div>
                ) : null}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
                    <div style={{ borderRadius: 9, border: '1px solid var(--surface-border)', background: 'var(--surface-soft)', padding: '7px 8px' }}>
                        <div style={{ fontSize: 10.5, color: 'var(--muted)' }}>Số tiền</div>
                        <div style={{ marginTop: 2, fontSize: 13.5, fontWeight: 900, color: draft.type === 'income' ? '#16a34a' : '#f97316' }}>
                            {draft.amount ? formatCurrencyVND(draftAmount) : '--'}
                        </div>
                    </div>
                    <div style={{ borderRadius: 9, border: '1px solid var(--surface-border)', background: 'var(--surface-soft)', padding: '7px 8px' }}>
                        <div style={{ fontSize: 10.5, color: 'var(--muted)' }}>Ngày</div>
                        <div style={{ marginTop: 2, fontSize: 13, fontWeight: 800 }}>{formatDateDisplay(draft.timestamp)}</div>
                    </div>
                    <div style={{ borderRadius: 9, border: '1px solid var(--surface-border)', background: 'var(--surface-soft)', padding: '7px 8px' }}>
                        <div style={{ fontSize: 10.5, color: 'var(--muted)' }}>Loại</div>
                        <div style={{ marginTop: 2, fontSize: 12.5, fontWeight: 800 }}>{draft.type === 'expense' ? 'Chi tiêu' : 'Thu nhập'}</div>
                    </div>
                    <div style={{ borderRadius: 9, border: '1px solid var(--surface-border)', background: 'var(--surface-soft)', padding: '7px 8px' }}>
                        <div style={{ fontSize: 10.5, color: 'var(--muted)' }}>Danh mục</div>
                        <div style={{ marginTop: 2, fontSize: 12.5, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            <span>{categoryIcon}</span>
                            <span>{categoryLabel}</span>
                        </div>
                    </div>
                </div>

                {draft.error ? <div style={{ color: '#ef4444', fontSize: 11.5 }}>{draft.error}</div> : null}

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-end' }}>
                    {draft.status === 'confirmed' ? (
                        <span
                            style={{
                                fontSize: 10.8,
                                color: '#16a34a',
                                fontWeight: 700,
                                padding: '6px 9px',
                                borderRadius: 999,
                                border: '1px solid rgba(22, 163, 74, 0.4)',
                                background: 'rgba(22, 163, 74, 0.12)',
                            }}
                        >
                            Đã tạo giao dịch
                        </span>
                    ) : draft.status === 'cancelled' ? (
                        <span
                            style={{
                                fontSize: 10.8,
                                color: 'var(--muted)',
                                fontWeight: 700,
                                padding: '6px 9px',
                                borderRadius: 999,
                                border: '1px solid var(--surface-border)',
                            }}
                        >
                            Đã hủy
                        </span>
                    ) : (
                        <>
                            <button
                                type="button"
                                onClick={() => {
                                    setEditingMessageId(messageId);
                                }}
                                style={{
                                    width: 30,
                                    height: 30,
                                    borderRadius: 8,
                                    border: '1px solid var(--surface-border)',
                                    background: 'transparent',
                                    color: 'var(--foreground)',
                                    display: 'grid',
                                    placeItems: 'center',
                                }}
                                title="Chỉnh sửa"
                            >
                                <Pencil size={14} />
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    updateMessageDraft(messageId, (current) => ({
                                        ...current,
                                        status: 'cancelled',
                                        isEditing: false,
                                    }));
                                    if (editingMessageId === messageId) {
                                        setEditingMessageId(null);
                                    }
                                }}
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
                                title="Hủy"
                            >
                                <X size={14} />
                            </button>
                            <button
                                type="button"
                                disabled={draft.status === 'creating'}
                                onClick={() => void handleConfirmDraft(messageId, draft)}
                                style={{
                                    opacity: draft.status === 'creating' ? 0.7 : 1,
                                    width: 30,
                                    height: 30,
                                    borderRadius: 8,
                                    border: '1px solid var(--chip-border)',
                                    background: 'var(--chip-bg)',
                                    color: 'var(--foreground)',
                                    display: 'grid',
                                    placeItems: 'center',
                                }}
                                title={draft.status === 'creating' ? 'Đang tạo...' : 'Tạo giao dịch'}
                            >
                                {draft.status === 'creating' ? <LoaderCircle size={14} className="spin" /> : <Check size={14} />}
                            </button>
                        </>
                    )}
                </div>
            </div>
        );
    };

    const renderEditModal = () => {
        if (!editingMessageId || !editingDraft) return null;

        const categoryOptions = categories
            .filter((item) => item.type === editingDraft.type)
            .map((item) => ({
                value: item.id,
                label: `${item.icon || '🧩'} ${item.name}`,
            }));

        return createPortal(
            <div
                onClick={(event) => {
                    if (event.target === event.currentTarget) setEditingMessageId(null);
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
                            onClick={() => setEditingMessageId(null)}
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
                                    updateMessageDraft(editingMessageId, (current) => ({
                                        ...current,
                                        type,
                                        categoryId:
                                            categories.find((item) => item.type === type)?.id || current.categoryId,
                                    }));
                                }}
                                style={{
                                    borderRadius: 9,
                                    border: editingDraft.type === type ? '1.5px solid var(--chip-border)' : '1px solid var(--surface-border)',
                                    background: editingDraft.type === type ? 'var(--chip-bg)' : 'transparent',
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
                                value={editingDraft.amount}
                                onChange={(event) => {
                                    const value = event.target.value.replace(/\D/g, '');
                                    updateMessageDraft(editingMessageId, (current) => ({ ...current, amount: value }));
                                }}
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
                            <input
                                type="date"
                                value={formatDateInput(editingDraft.timestamp)}
                                onChange={(event) => {
                                    updateMessageDraft(editingMessageId, (current) => ({
                                        ...current,
                                        timestamp: parseDateInputToTimestamp(event.target.value),
                                    }));
                                }}
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
                    </div>

                    <div>
                        <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 5 }}>Ví</div>
                        <CustomSelect
                            value={editingDraft.walletId}
                            onChange={(value) => updateMessageDraft(editingMessageId, (current) => ({ ...current, walletId: value }))}
                            options={walletOptions}
                        />
                    </div>

                    <div>
                        <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 5 }}>Danh mục</div>
                        <CustomSelect
                            value={editingDraft.categoryId}
                            onChange={(value) => updateMessageDraft(editingMessageId, (current) => ({ ...current, categoryId: value }))}
                            options={categoryOptions}
                        />
                    </div>

                    <div>
                        <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 5 }}>Ghi chú</div>
                        <input
                            value={editingDraft.description}
                            onChange={(event) => {
                                updateMessageDraft(editingMessageId, (current) => ({
                                    ...current,
                                    description: event.target.value,
                                }));
                            }}
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

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                        <button
                            type="button"
                            onClick={() => setEditingMessageId(null)}
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
                            onClick={() => {
                                void handleConfirmDraft(editingMessageId, editingDraft);
                            }}
                        >
                            Lưu & tạo giao dịch
                        </PrimaryButton>
                    </div>
                </div>
            </div>,
            document.body,
        );
    };

    return (
        <AppCard
            strong
            style={{
                padding: 16,
                display: 'grid',
                gap: 12,
                maxWidth: 920,
                margin: '0 auto',
                background:
                    'radial-gradient(120% 90% at 10% 0%, color-mix(in srgb, var(--theme-gradient-start) 14%, transparent), transparent 55%), var(--surface-base)',
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                    style={{
                        width: 36,
                        height: 36,
                        borderRadius: 12,
                        display: 'grid',
                        placeItems: 'center',
                        background: 'linear-gradient(135deg, var(--theme-gradient-start), var(--theme-gradient-end))',
                        color: '#fff',
                    }}
                >
                    <MessageCircle size={18} />
                </div>
                <div>
                    <div style={{ fontSize: 15, fontWeight: 900 }}>Trợ lý Pô con</div>
                    <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 2 }}>
                        Mô tả giao dịch hoặc gửi hóa đơn để Pô con phân tích nhé!
                    </div>
                </div>
            </div>

            {topError ? (
                <div
                    style={{
                        borderRadius: 10,
                        padding: '9px 12px',
                        border: '1px solid rgba(239,68,68,0.35)',
                        background: 'rgba(239,68,68,0.12)',
                        color: '#f87171',
                        fontSize: 12,
                    }}
                >
                    {topError}
                </div>
            ) : null}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>Ví mặc định khi tạo giao dịch</div>
                {walletOptions.length > 0 ? (
                    <CustomSelect
                        value={selectedWalletId}
                        onChange={setSelectedWalletId}
                        options={walletOptions}
                    />
                ) : (
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>Chưa có ví nào khả dụng.</div>
                )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <div style={{ fontSize: 12.2, fontWeight: 800 }}>Đoạn chat</div>
                <button
                    type="button"
                    onClick={() => {
                        setMessages((previous) => previous.slice(0, 1));
                    }}
                    style={{
                        width: 32,
                        height: 32,
                        borderRadius: 10,
                        border: '1px solid var(--surface-border)',
                        background: 'var(--surface-soft)',
                        color: 'var(--foreground)',
                        display: 'grid',
                        placeItems: 'center',
                    }}
                    title="Xóa đoạn chat"
                >
                    <Trash2 size={14} />
                </button>
            </div>

            <div
                ref={chatViewportRef}
                style={{
                    borderRadius: 12,
                    border: '1px solid var(--surface-border)',
                    background:
                        'linear-gradient(180deg, color-mix(in srgb, var(--theme-gradient-start) 7%, var(--surface-base)), var(--surface-base) 25%, var(--surface-base))',
                    height: 'clamp(280px, 46vh, 460px)',
                    overflowY: 'auto',
                    padding: 10,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                }}
            >
                {messages.map((message) => (
                    <div
                        key={message.id}
                        className="chat-bubble-in"
                        style={{
                            alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start',
                            maxWidth: 'min(92%, 620px)',
                            borderRadius: message.compact ? 10 : 12,
                            border: message.role === 'assistant' ? '1px solid color-mix(in srgb, var(--theme-gradient-start) 22%, var(--surface-border))' : 'none',
                            background:
                                message.role === 'assistant'
                                    ? 'linear-gradient(135deg, color-mix(in srgb, var(--surface-strong) 80%, #ffffff), var(--surface-strong))'
                                    : 'linear-gradient(135deg, color-mix(in srgb, var(--theme-gradient-start) 42%, var(--chip-bg)), color-mix(in srgb, var(--theme-gradient-end) 42%, var(--chip-bg)))',
                            color: message.role === 'assistant' ? 'var(--foreground)' : 'var(--theme-nav-active)',
                            padding: message.compact ? '7px 10px' : '10px 12px',
                            boxShadow:
                                message.role === 'assistant'
                                    ? '0 8px 20px rgba(15, 23, 42, 0.08)'
                                    : '0 12px 24px color-mix(in srgb, var(--theme-gradient-start) 25%, transparent)',
                        }}
                    >
                        {message.text ? (
                            <div style={{ fontSize: message.compact ? 11.4 : 11.4, lineHeight: message.compact ? 1.35 : 1.45 }}>
                                {message.text}
                            </div>
                        ) : null}

                        {message.imageUrl ? (
                            <img
                                src={message.imageUrl}
                                alt="receipt"
                                style={{
                                    display: 'block',
                                    marginTop: 8,
                                    borderRadius: 8,
                                    width: 'min(260px, 100%)',
                                    objectFit: 'cover',
                                }}
                            />
                        ) : null}

                        {message.transactionDraft
                            ? renderDraftCard(message.id, message.transactionDraft)
                            : null}
                    </div>
                ))}

                {isBusy ? (
                    <div
                        className="chat-busy-pulse"
                        style={{
                            alignSelf: 'flex-start',
                            borderRadius: 12,
                            border: '1px solid var(--surface-border)',
                            background: 'var(--surface-strong)',
                            color: 'var(--foreground)',
                            padding: '8px 10px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 8,
                            fontSize: 12,
                        }}
                    >
                        <LoaderCircle size={14} className="spin" />
                        Trợ lý của anh Pô đang phân tích...
                    </div>
                ) : null}
            </div>

            {renderEditModal()}

            {imageAttachment ? (
                <div
                    style={{
                        borderRadius: 10,
                        border: '1px solid var(--surface-border)',
                        padding: 10,
                        background: 'var(--surface-soft)',
                        display: 'grid',
                        gap: 10,
                    }}
                >
                    <div style={{ display: 'grid', gridTemplateColumns: '64px 1fr', gap: 10, alignItems: 'center' }}>
                        <img
                            src={imageAttachment.previewUrl}
                            alt={imageAttachment.fileName}
                            style={{ width: 64, height: 64, borderRadius: 9, objectFit: 'cover', border: '1px solid var(--surface-border)' }}
                        />
                        <div>
                            <div style={{ fontWeight: 700, fontSize: 12, lineHeight: 1.3 }}>{imageAttachment.fileName}</div>
                            <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                                Ảnh đã sẵn sàng để OCR hóa đơn
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <button
                            type="button"
                            onClick={() => setImageAttachment(null)}
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
                            <Trash2 size={14} />
                        </button>
                        <PrimaryButton
                            disabled={isBusy}
                            onClick={() => void handleAnalyzeImage()}
                            style={{
                                opacity: isBusy ? 0.7 : 1,
                                minHeight: 32,
                                padding: '0 10px',
                                fontSize: 12,
                                borderRadius: 8,
                                whiteSpace: 'nowrap',
                            }}
                        >
                            Phân tích hóa đơn
                        </PrimaryButton>
                    </div>
                </div>
            ) : null}

            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 8, alignItems: 'center' }}>
                <label
                    style={{
                        width: 38,
                        height: 38,
                        borderRadius: 10,
                        border: '1px solid var(--surface-border)',
                        background: 'var(--surface-soft)',
                        color: 'var(--foreground)',
                        display: 'grid',
                        placeItems: 'center',
                        cursor: isBusy ? 'not-allowed' : 'pointer',
                        opacity: isBusy ? 0.7 : 1,
                    }}
                >
                    <ImagePlus size={16} />
                    <input
                        type="file"
                        accept="image/*"
                        hidden
                        disabled={isBusy}
                        onChange={(event) => {
                            void handlePickImage(event);
                        }}
                    />
                </label>

                <input
                    value={textInput}
                    disabled={isBusy}
                    onChange={(event) => setTextInput(event.target.value)}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter' && !event.shiftKey) {
                            event.preventDefault();
                            void handleSendText();
                        }
                    }}
                    placeholder='Nhập ví dụ: "Đi chợ 100k" hoặc "Lương tháng 20 triệu"'
                    style={{
                        width: '100%',
                        borderRadius: 10,
                        border: '1px solid var(--surface-border)',
                        background: 'var(--surface-soft)',
                        color: 'var(--foreground)',
                        padding: '10px 12px',
                        fontSize: 13,
                        boxSizing: 'border-box',
                    }}
                />

                <PrimaryButton
                    disabled={isBusy || !textInput.trim()}
                    onClick={() => void handleSendText()}
                    style={{
                        minWidth: 44,
                        height: 38,
                        padding: '0 12px',
                    }}
                >
                    <Send size={14} />
                </PrimaryButton>
            </div>

            <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                Nhớ kiểm tra kỹ trước khi tạo giao dịch nhé, nếu sai sót mong bạn thông cảm.
            </div>

            <div style={{ borderTop: '1px solid var(--surface-border)', paddingTop: 10, display: 'grid', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <div style={{ fontSize: 12.2, fontWeight: 800 }}>5 giao dịch gần đây</div>
                    <button
                        type="button"
                        onClick={() => void loadRecentTransactions()}
                        style={{
                            border: '1px solid var(--surface-border)',
                            background: 'var(--surface-soft)',
                            color: 'var(--foreground)',
                            borderRadius: 8,
                            padding: '5px 8px',
                            fontSize: 10.8,
                        }}
                    >
                        Làm mới
                    </button>
                </div>
                <div style={{ display: 'grid', gap: 6 }}>
                    {isRecentLoading ? (
                        <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>Đang tải giao dịch...</div>
                    ) : recentActions.length === 0 ? (
                        <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>Chưa có giao dịch nào.</div>
                    ) : (
                        recentActions.map((item) => {
                            const transaction = item.transaction;
                            const categoryObj = categories.find((cate) => cate.id === transaction.category);
                            const categoryLabel = categoryObj?.name || transaction.cateName || 'Danh mục';
                            const categoryIcon = categoryObj?.icon || '🧩';
                            const fullDescription = transaction.description || categoryLabel;
                            const shortDescription = truncateText(fullDescription, 36);

                            return (
                                <div
                                    key={transaction.id}
                                    style={{
                                        border: '1px solid var(--surface-border)',
                                        background: 'linear-gradient(135deg, color-mix(in srgb, var(--surface-soft) 92%, white), var(--surface-soft))',
                                        borderRadius: 9,
                                        padding: '8px 9px',
                                        display: 'grid',
                                        gridTemplateColumns: 'auto 1fr auto',
                                        gap: 8,
                                        alignItems: 'center',
                                    }}
                                >
                                    <div
                                        style={{
                                            width: 28,
                                            height: 28,
                                            borderRadius: 8,
                                            border: '1px solid var(--surface-border)',
                                            background: 'var(--surface-base)',
                                            display: 'grid',
                                            placeItems: 'center',
                                            fontSize: 14,
                                        }}
                                    >
                                        {categoryIcon}
                                    </div>
                                    <div>
                                        <div
                                            title={fullDescription}
                                            style={{
                                                fontSize: 11.6,
                                                fontWeight: 700,
                                                lineHeight: 1.35,
                                                whiteSpace: 'nowrap',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                maxWidth: '100%',
                                            }}
                                        >
                                            {shortDescription}
                                        </div>
                                        <div style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 2 }}>
                                            {categoryLabel} • thêm lúc {formatDateTimeDisplay(item.actionCreatedAt)}
                                        </div>
                                    </div>
                                    <div
                                        style={{
                                            fontSize: 11.8,
                                            fontWeight: 800,
                                            color: transaction.type === 'income' ? '#16a34a' : '#f97316',
                                            whiteSpace: 'nowrap',
                                        }}
                                    >
                                        {transaction.type === 'income' ? '+' : '-'}{formatCurrencyVND(transaction.amount)}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </AppCard>
    );
}
