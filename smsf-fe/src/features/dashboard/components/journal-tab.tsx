'use client';

import { BarChart3, Check, ImagePlus, LoaderCircle, MessageCircle, Mic, Pencil, Send, Square, Trash2, X } from 'lucide-react';
import { PointerEvent, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AppCard } from '@/components/common/app-card';
import { CategoryOrderModal } from '@/components/common/category-order-modal';
import { CustomDatePicker } from '@/components/common/custom-date-picker';
import { CustomSelect } from '@/components/common/custom-select';
import { PrimaryButton } from '@/components/common/primary-button';
import {
    analyzeMonthlyInsightsRequest,
    analyzeSmartReceiptRequest,
    analyzeSmartTextMultiRequest,
    createTransactionRequest,
    deleteTransactionRequest,
    getCategoriesRequest,
    getRecentTransactionsRequest,
    getWalletsRequest,
    updateCategoryOrderRequest,
    updateTransactionRequest,
} from '@/lib/calendar/api';
import { formatCurrencyVND } from '@/lib/formatters';
import { useAuth } from '@/providers/auth-provider';
import {
    IAiMonthlyInsightResult,
    IAiTransactionSuggestion,
    TypeAiInsightPeriod,
    TypeAiMonthlyAnalysis,
} from '@/types/ai';
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
    monthlyInsight?: IAiMonthlyInsightResult;
    compact?: boolean;
}

interface IRecentActionItem {
    transaction: ICalendarTransaction;
    actionCreatedAt: number;
}

interface ISpeechRecognitionLike {
    lang: string;
    continuous: boolean;
    interimResults: boolean;
    onresult: ((event: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
    onerror: ((event: { error?: string }) => void) | null;
    onend: (() => void) | null;
    start: () => void;
    stop: () => void;
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

const formatMonthYearLabel = (month: number, year: number): string => {
    return `${String(month).padStart(2, '0')}/${year}`;
};

const truncateText = (value: string | undefined, maxLength = 34): string => {
    const text = String(value || '').trim();
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return `${text.slice(0, maxLength).trimEnd()}...`;
};

const CHAT_ACTION_SIDE_PADDING = 6;
const CHAT_ACTION_BUTTON_WIDTH = 34;
const CHAT_ACTION_GAP = 6;
const CHAT_ACTION_TRAILING_PADDING = 6;
const CHAT_SWIPE_SNAP_TO_EDIT =
    CHAT_ACTION_SIDE_PADDING
    + CHAT_ACTION_BUTTON_WIDTH
    + CHAT_ACTION_GAP
    + CHAT_ACTION_BUTTON_WIDTH
    + CHAT_ACTION_TRAILING_PADDING;

const TRANSACTION_INTENT_PATTERN = /(\d|k\b|tr\b|triệu|nghìn|ngan|đ\b|vnd|chi|thu|mua|trả|lương|xăng|đi chợ|hoa don|hoá đơn|bill)/i;
const ANALYSIS_INTENT_PATTERN = /(phân tích|phan tich|phân thích|phan thich|nhận định|nhan dinh|liệt kê|liet ke|bất thường|bat thuong|chi tiêu|chi tieu)/i;

const seemsTransactionIntent = (text: string): boolean => {
    return TRANSACTION_INTENT_PATTERN.test(String(text || '').toLowerCase());
};

const parseInsightIntentFromText = (text: string): {
    analysisType: TypeAiMonthlyAnalysis;
    periodType: TypeAiInsightPeriod;
    isYearUnsupported: boolean;
    referenceTimestamp?: number;
} | null => {
    const normalized = String(text || '').trim().toLowerCase();
    if (!normalized || !ANALYSIS_INTENT_PATTERN.test(normalized)) return null;

    const includesYear = /(năm|nam|theo năm|theo nam)/i.test(normalized);
    if (includesYear) {
        return {
            analysisType: /bất thường|bat thuong/i.test(normalized) ? 'wasteful-top' : 'spending-overview',
            periodType: 'month',
            isYearUnsupported: true,
        };
    }

    const dateMatch = normalized.match(/(?:ngày\s*)?(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?/i);
    let referenceTimestamp: number | undefined;
    if (dateMatch) {
        const day = Number(dateMatch[1]);
        const month = Number(dateMatch[2]);
        const yearRaw = Number(dateMatch[3]);
        const nowYear = new Date().getFullYear();
        const year = Number.isFinite(yearRaw)
            ? (yearRaw < 100 ? 2000 + yearRaw : yearRaw)
            : nowYear;

        const parsed = new Date(year, month - 1, day, 12, 0, 0, 0).getTime();
        if (Number.isFinite(parsed)) {
            referenceTimestamp = parsed;
        }
    }

    const periodType: TypeAiInsightPeriod =
        referenceTimestamp
            ? 'day'
            : /(hôm nay|hom nay|today)/i.test(normalized)
            ? 'day'
            : /(tuần này|tuan nay|this week)/i.test(normalized)
                ? 'week'
                : 'month';

    const analysisType: TypeAiMonthlyAnalysis =
        /(bất thường|bat thuong|không đáng|khong dang|top)/i.test(normalized)
            ? 'wasteful-top'
            : 'spending-overview';

    return {
        analysisType,
        periodType,
        isYearUnsupported: false,
        referenceTimestamp,
    };
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
    const [isVoiceListening, setIsVoiceListening] = useState(false);
    const [voiceLevel, setVoiceLevel] = useState(0);
    const [isRecentLoading, setIsRecentLoading] = useState(false);
    const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
    const [isCategoryOrderOpen, setIsCategoryOrderOpen] = useState(false);
    const [isSavingCategoryOrder, setIsSavingCategoryOrder] = useState(false);
    const [topError, setTopError] = useState('');
    const [recentEditingTransaction, setRecentEditingTransaction] = useState<ICalendarTransaction | null>(null);
    const [isSubmittingRecentEdit, setIsSubmittingRecentEdit] = useState(false);
    const [recentEditError, setRecentEditError] = useState('');
    const [recentDeleteTarget, setRecentDeleteTarget] = useState<ICalendarTransaction | null>(null);
    const [recentDeletingId, setRecentDeletingId] = useState<string | null>(null);
    const [swipedRecentTransactionId, setSwipedRecentTransactionId] = useState<string | null>(null);
    const [recentDragOffsetX, setRecentDragOffsetX] = useState(0);
    const [recentEditType, setRecentEditType] = useState<TypeTransactionKind>('expense');
    const [recentEditAmount, setRecentEditAmount] = useState('');
    const [recentEditWalletId, setRecentEditWalletId] = useState('');
    const [recentEditCategoryId, setRecentEditCategoryId] = useState('');
    const [recentEditDescription, setRecentEditDescription] = useState('');
    const [recentEditDate, setRecentEditDate] = useState('');
    const chatViewportRef = useRef<HTMLDivElement | null>(null);
    const shouldAutoScrollRef = useRef(false);
    const speechRecognitionRef = useRef<ISpeechRecognitionLike | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const levelAnimationFrameRef = useRef<number | null>(null);
    const recentIgnoreNextClickRef = useRef(false);
    const recentDragRef = useRef<{
        id: string;
        startX: number;
        startOffset: number;
        maxLeft: number;
        hasMoved: boolean;
    } | null>(null);

    useEffect(() => {
        let ignore = false;

        Promise.all([getWalletsRequest(), getCategoriesRequest()])
            .then(([walletSummary, fetchedCategories]) => {
                if (ignore) return;

                setWallets(walletSummary.wallets);
                setCategories(fetchedCategories);

                const activeWallets = walletSummary.wallets.filter((w) => w.isActive !== false);
                if (activeWallets.length > 0) {
                    const richest = activeWallets.reduce((a, b) =>
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

    const openRecentEditModal = (transaction: ICalendarTransaction) => {
        setRecentEditingTransaction(transaction);
        setRecentEditType(transaction.type);
        setRecentEditAmount(String(Math.round(transaction.amount)));
        setRecentEditWalletId(transaction.walletId);
        setRecentEditCategoryId(transaction.category);
        setRecentEditDescription(transaction.description || '');
        setRecentEditDate(formatDateInput(transaction.timestamp));
        setRecentEditError('');
        setSwipedRecentTransactionId(null);
    };

    const handleDeleteRecentTransaction = async () => {
        if (!recentDeleteTarget) return;

        setRecentDeletingId(recentDeleteTarget.id);
        setTopError('');

        try {
            await deleteTransactionRequest(recentDeleteTarget.id);
            await refreshWallets();
            window.dispatchEvent(new CustomEvent('transaction:changed'));
            await loadRecentTransactions();
            setRecentDeleteTarget(null);
        } catch (error) {
            setTopError(
                (error as { response?: { data?: { message?: string } } })?.response?.data?.message
                    || 'Xóa giao dịch thất bại.',
            );
        } finally {
            setRecentDeletingId(null);
        }
    };

    const handleSaveRecentEdit = async () => {
        if (!recentEditingTransaction) return;

        const parsedAmount = Number(recentEditAmount || 0);
        if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
            setRecentEditError('Số tiền không hợp lệ.');
            return;
        }

        if (!recentEditWalletId) {
            setRecentEditError('Vui lòng chọn ví.');
            return;
        }

        if (!recentEditCategoryId) {
            setRecentEditError('Vui lòng chọn danh mục.');
            return;
        }

        setIsSubmittingRecentEdit(true);
        setRecentEditError('');
        setTopError('');

        try {
            await updateTransactionRequest(recentEditingTransaction.id, {
                type: recentEditType,
                amount: parsedAmount,
                walletId: recentEditWalletId,
                category: recentEditCategoryId,
                description: recentEditDescription.trim() || undefined,
                timestamp: parseDateInputToTimestamp(recentEditDate),
            });

            await refreshWallets();
            window.dispatchEvent(new CustomEvent('transaction:changed'));
            await loadRecentTransactions();
            setRecentEditingTransaction(null);
            setSwipedRecentTransactionId(null);
            setRecentDragOffsetX(0);
        } catch (error) {
            setRecentEditError(
                (error as { response?: { data?: { message?: string } } })?.response?.data?.message
                    || 'Cập nhật giao dịch thất bại.',
            );
        } finally {
            setIsSubmittingRecentEdit(false);
        }
    };

    const handleRecentPointerDown = (id: string, event: PointerEvent<HTMLDivElement>) => {
        if (event.pointerType === 'mouse' && event.button !== 0) {
            return;
        }

        event.currentTarget.setPointerCapture(event.pointerId);
        const rowWidth = event.currentTarget.getBoundingClientRect().width;
        const maxLeft = Math.min(rowWidth / 2, rowWidth - 20);

        recentDragRef.current = {
            id,
            startX: event.clientX,
            startOffset: swipedRecentTransactionId === id ? -CHAT_SWIPE_SNAP_TO_EDIT : 0,
            maxLeft,
            hasMoved: false,
        };

        if (swipedRecentTransactionId !== id) {
            setSwipedRecentTransactionId(null);
        }
    };

    const handleRecentPointerMove = (id: string, event: PointerEvent<HTMLDivElement>) => {
        if (!recentDragRef.current || recentDragRef.current.id !== id) return;

        const delta = event.clientX - recentDragRef.current.startX;
        if (Math.abs(delta) > 8) {
            recentDragRef.current.hasMoved = true;
        }

        const next = Math.min(0, Math.max(-recentDragRef.current.maxLeft, recentDragRef.current.startOffset + delta));
        setRecentDragOffsetX(next);
    };

    const handleRecentPointerEnd = (id: string) => {
        if (!recentDragRef.current || recentDragRef.current.id !== id) return;

        recentIgnoreNextClickRef.current = recentDragRef.current.hasMoved;

        if (Math.abs(recentDragOffsetX) > 12) {
            setSwipedRecentTransactionId(id);
        } else {
            setSwipedRecentTransactionId(null);
        }

        setRecentDragOffsetX(0);
        recentDragRef.current = null;
    };

    const scrollChatToBottom = (behavior: ScrollBehavior = 'smooth') => {
        if (!chatViewportRef.current) return;

        chatViewportRef.current.scrollTo({
            top: chatViewportRef.current.scrollHeight,
            behavior,
        });
    };

    const stopVoiceLevelMeter = () => {
        if (levelAnimationFrameRef.current) {
            cancelAnimationFrame(levelAnimationFrameRef.current);
            levelAnimationFrameRef.current = null;
        }

        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach((track) => track.stop());
            mediaStreamRef.current = null;
        }

        if (audioContextRef.current) {
            void audioContextRef.current.close();
            audioContextRef.current = null;
        }

        analyserRef.current = null;
        setVoiceLevel(0);
    };

    const stopVoiceListening = () => {
        if (speechRecognitionRef.current) {
            speechRecognitionRef.current.onend = null;
            speechRecognitionRef.current.onerror = null;
            speechRecognitionRef.current.onresult = null;
            speechRecognitionRef.current.stop();
            speechRecognitionRef.current = null;
        }

        stopVoiceLevelMeter();
        setIsVoiceListening(false);
    };

    const startVoiceListening = async () => {
        if (isBusy || isVoiceListening) return;

        const SpeechRecognitionCtor = (window as typeof window & {
            SpeechRecognition?: new () => ISpeechRecognitionLike;
            webkitSpeechRecognition?: new () => ISpeechRecognitionLike;
        }).SpeechRecognition
            || (window as typeof window & {
                SpeechRecognition?: new () => ISpeechRecognitionLike;
                webkitSpeechRecognition?: new () => ISpeechRecognitionLike;
            }).webkitSpeechRecognition;

        if (!SpeechRecognitionCtor) {
            setTopError('Trình duyệt chưa hỗ trợ voice chat. Bạn thử Chrome hoặc Edge mới nhất nhé.');
            return;
        }

        try {
            setTopError('');
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaStreamRef.current = stream;

            const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
            if (AudioContextCtor) {
                const audioContext = new AudioContextCtor();
                audioContextRef.current = audioContext;
                const analyser = audioContext.createAnalyser();
                analyser.fftSize = 256;
                analyserRef.current = analyser;

                const source = audioContext.createMediaStreamSource(stream);
                source.connect(analyser);

                const data = new Uint8Array(analyser.frequencyBinCount);
                const tick = () => {
                    if (!analyserRef.current) return;

                    analyserRef.current.getByteFrequencyData(data);
                    const average = data.reduce((sum, value) => sum + value, 0) / (data.length || 1);
                    const normalized = Math.max(0, Math.min(1, average / 120));
                    setVoiceLevel(normalized);
                    levelAnimationFrameRef.current = requestAnimationFrame(tick);
                };
                tick();
            }

            const recognition = new SpeechRecognitionCtor();
            speechRecognitionRef.current = recognition;
            recognition.lang = 'vi-VN';
            recognition.continuous = true;
            recognition.interimResults = true;

            recognition.onresult = (event) => {
                let transcript = '';
                for (let index = event.resultIndex; index < event.results.length; index += 1) {
                    transcript += String(event.results[index]?.[0]?.transcript || '');
                }

                if (transcript.trim()) {
                    setTextInput(transcript.trim());
                }
            };

            recognition.onerror = (event) => {
                const errorType = String(event.error || '').toLowerCase();
                if (errorType !== 'no-speech') {
                    setTopError('Không nhận diện được giọng nói. Bạn thử nói rõ hơn hoặc thử lại nhé.');
                }
                stopVoiceListening();
            };

            recognition.onend = () => {
                stopVoiceListening();
            };

            setIsVoiceListening(true);
            recognition.start();
        } catch {
            stopVoiceListening();
            setTopError('Không thể mở micro. Bạn hãy kiểm tra quyền truy cập microphone của trình duyệt.');
        }
    };

    useEffect(() => {
        return () => {
            stopVoiceListening();
        };
    }, []);

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
            wallets.filter((wallet) => wallet.isActive !== false).map((wallet) => ({
                value: wallet.id,
                label: `${wallet.name} • ${formatCurrencyVND(wallet.balance)}`,
            })),
        [wallets],
    );

    const recentCategoryOptions = useMemo(
        () =>
            categories
                .filter((item) => item.type === recentEditType)
                .map((item) => ({
                    value: item.id,
                    label: `${item.icon || '🧩'} ${item.name}`,
                })),
        [categories, recentEditType],
    );

    const editingMessage = useMemo(
        () => messages.find((message) => message.id === editingMessageId && message.transactionDraft),
        [messages, editingMessageId],
    );

    const editingDraft = editingMessage?.transactionDraft;

    const handleSaveCategoryOrder = async (categoryIds: string[]) => {
        if (!editingDraft) {
            return;
        }

        setIsSavingCategoryOrder(true);
        try {
            await updateCategoryOrderRequest({
                type: editingDraft.type,
                categoryIds,
            });

            const refreshed = await getCategoriesRequest();
            setCategories(refreshed);
            setIsCategoryOrderOpen(false);
        } finally {
            setIsSavingCategoryOrder(false);
        }
    };

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

        if (isVoiceListening) {
            stopVoiceListening();
        }

        setTopError('');
        const insightIntent = parseInsightIntentFromText(normalized);
        if (insightIntent?.isYearUnsupported) {
            shouldAutoScrollRef.current = true;
            setMessages((previous) => [
                ...previous,
                {
                    id: `user-${Date.now()}`,
                    role: 'user',
                    text: normalized,
                },
                {
                    id: `assistant-year-${Date.now()}`,
                    role: 'assistant',
                    compact: true,
                    text: 'trợ lý Pô con chưa được nạp VIP lần đầu, bạn thông cảm nhé huhu',
                },
            ]);
            setTextInput('');
            return;
        }

        if (insightIntent) {
            setTextInput('');
            await runInsightAnalysis({
                analysisType: insightIntent.analysisType,
                periodType: insightIntent.periodType,
                userText: normalized,
                referenceTimestamp: insightIntent.referenceTimestamp,
            });
            return;
        }

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
            const suggestions = await analyzeSmartTextMultiRequest({
                text: normalized,
                walletId: selectedWalletId || undefined,
                fallbackTimestamp: Date.now(),
            });

            const actionable = suggestions
                .map((suggestion) => {
                    const resolvedCategoryId = resolveCategoryId({
                        categoryId: suggestion.categoryId,
                        categoryName: suggestion.categoryName,
                        type: suggestion.type,
                    });
                    return { suggestion, resolvedCategoryId };
                })
                .filter(({ suggestion, resolvedCategoryId }) =>
                    isSuggestionActionable(suggestion, resolvedCategoryId),
                );

            if (actionable.length === 0) {
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

            const now = Date.now();
            const newMessages = actionable.map(({ suggestion, resolvedCategoryId }, index) => {
                const draft = buildDraftFromSuggestion({
                    walletId: selectedWalletId || wallets[0]?.id || '',
                    categoryId: resolvedCategoryId,
                    amount: suggestion.amount,
                    timestamp: suggestion.timestamp,
                    type: suggestion.type,
                    description: suggestion.description,
                    merchant: suggestion.merchant,
                    confidence: suggestion.confidence,
                    warnings: normalizeAiWarnings(suggestion.warnings),
                });

                return {
                    id: `assistant-${now}-${index}-${Math.random().toString(36).slice(2)}`,
                    role: 'assistant' as const,
                    text: actionable.length > 1
                        ? `Giao dịch ${index + 1}/${actionable.length} — kiểm tra và xác nhận nhé.`
                        : 'Mình đã phân tích xong. Kiểm tra và xác nhận nhanh bên dưới.',
                    transactionDraft: draft,
                };
            });

            setMessages((previous) => [...previous, ...newMessages]);
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

    const runInsightAnalysis = async (params: {
        analysisType: TypeAiMonthlyAnalysis;
        periodType: TypeAiInsightPeriod;
        userText: string;
        referenceTimestamp?: number;
    }) => {
        if (isBusy) return;

        setIsBusy(true);
        setTopError('');
        shouldAutoScrollRef.current = true;

        setMessages((previous) => [
            ...previous,
            {
                id: `user-insight-${Date.now()}`,
                role: 'user',
                text: params.userText,
            },
        ]);

        try {
            const insight = await analyzeMonthlyInsightsRequest({
                analysisType: params.analysisType,
                periodType: params.periodType,
                referenceTimestamp: params.referenceTimestamp || Date.now(),
                userQuery: params.userText,
            });

            setMessages((previous) => [
                ...previous,
                {
                    id: `assistant-insight-${Date.now()}`,
                    role: 'assistant',
                    text: '',
                    monthlyInsight: insight,
                },
            ]);
        } catch (error) {
            setMessages((previous) => [
                ...previous,
                {
                    id: `assistant-insight-error-${Date.now()}`,
                    role: 'assistant',
                    text:
                        (error as { response?: { data?: { message?: string } } })?.response?.data?.message
                        || 'Mình chưa phân tích được báo cáo lúc này. Bạn thử lại sau nhé.',
                },
            ]);
        } finally {
            setIsBusy(false);
        }
    };

    const handleQuickMonthlyInsight = async (analysisType: TypeAiMonthlyAnalysis) => {
        const userText =
            analysisType === 'wasteful-top'
                ? 'Liệt kê chi tiêu bất thường tháng này'
                : 'Phân tích chi tiêu tháng này';

        await runInsightAnalysis({
            analysisType,
            periodType: 'month',
            userText,
        });
    };

    const renderInsightCard = (insight: IAiMonthlyInsightResult) => {
        const isWastefulMode = insight.analysisType === 'wasteful-top';

        return (
            <div
                style={{
                    marginTop: 8,
                    border: '1px solid var(--surface-border)',
                    borderRadius: 10,
                    background: 'var(--surface-base)',
                    padding: 9,
                    display: 'grid',
                    gap: 9,
                }}
            >
                {/* Header */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center' }}>
                    <div style={{ fontWeight: 800, fontSize: 12.2 }}>
                        {isWastefulMode ? 'Phân tích giao dịch bất thường' : 'Phân tích chi tiêu'}
                    </div>
                    <div style={{ fontSize: 10.8, color: 'var(--muted)' }}>
                        {insight.periodLabel || formatMonthYearLabel(insight.month, insight.year)}
                    </div>
                </div>

                {/* Summary text */}
                <div style={{
                    fontSize: 11.5,
                    lineHeight: 1.5,
                    color: 'var(--foreground)',
                    borderRadius: 8,
                    background: 'var(--surface-soft)',
                    padding: '7px 9px',
                    borderLeft: '3px solid var(--chip-border)',
                }}>
                    {insight.summary}
                </div>

                {/* Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 7 }}>
                    <div style={{ borderRadius: 8, border: '1px solid var(--surface-border)', background: 'var(--surface-soft)', padding: '6px 7px' }}>
                        <div style={{ fontSize: 10.5, color: 'var(--muted)' }}>Giao dịch</div>
                        <div style={{ marginTop: 2, fontSize: 12.8, fontWeight: 800 }}>{insight.totalTransactions}</div>
                    </div>
                    <div style={{ borderRadius: 8, border: '1px solid var(--surface-border)', background: 'var(--surface-soft)', padding: '6px 7px' }}>
                        <div style={{ fontSize: 10.5, color: 'var(--muted)' }}>Thu</div>
                        <div style={{ marginTop: 2, fontSize: 12.2, fontWeight: 800, color: '#16a34a' }}>{formatCurrencyVND(insight.totalIncome)}</div>
                    </div>
                    <div style={{ borderRadius: 8, border: '1px solid var(--surface-border)', background: 'var(--surface-soft)', padding: '6px 7px' }}>
                        <div style={{ fontSize: 10.5, color: 'var(--muted)' }}>Chi</div>
                        <div style={{ marginTop: 2, fontSize: 12.2, fontWeight: 800, color: '#f97316' }}>{formatCurrencyVND(insight.totalExpense)}</div>
                    </div>
                </div>

                {/* Highlights */}
                {insight.highlights.length > 0 ? (
                    <div style={{ display: 'grid', gap: 3 }}>
                        <div style={{ fontSize: 10.8, fontWeight: 800, color: 'var(--muted)', marginBottom: 2 }}>Nhận định chính</div>
                        {insight.highlights.map((line, index) => (
                            <div key={`hl-${index}`} style={{ fontSize: 11.2, lineHeight: 1.45 }}>
                                • {line}
                            </div>
                        ))}
                    </div>
                ) : null}

                {/* Strengths */}
                {!isWastefulMode && insight.strengths && insight.strengths.length > 0 ? (
                    <div style={{ display: 'grid', gap: 3 }}>
                        <div style={{ fontSize: 10.8, fontWeight: 800, color: '#16a34a', marginBottom: 2 }}>✅ Ưu điểm</div>
                        {insight.strengths.map((line, index) => (
                            <div key={`str-${index}`} style={{ fontSize: 11.2, lineHeight: 1.45, color: 'var(--foreground)' }}>
                                • {line}
                            </div>
                        ))}
                    </div>
                ) : null}

                {/* Weaknesses */}
                {!isWastefulMode && insight.weaknesses && insight.weaknesses.length > 0 ? (
                    <div style={{ display: 'grid', gap: 3 }}>
                        <div style={{ fontSize: 10.8, fontWeight: 800, color: '#f97316', marginBottom: 2 }}>⚠️ Nhược điểm</div>
                        {insight.weaknesses.map((line, index) => (
                            <div key={`wk-${index}`} style={{ fontSize: 11.2, lineHeight: 1.45, color: 'var(--foreground)' }}>
                                • {line}
                            </div>
                        ))}
                    </div>
                ) : null}

                {/* Improvements */}
                {!isWastefulMode && insight.improvements && insight.improvements.length > 0 ? (
                    <div style={{ display: 'grid', gap: 3 }}>
                        <div style={{ fontSize: 10.8, fontWeight: 800, color: '#6366f1', marginBottom: 2 }}>💡 Cần cải thiện</div>
                        {insight.improvements.map((line, index) => (
                            <div key={`imp-${index}`} style={{ fontSize: 11.2, lineHeight: 1.45, color: 'var(--foreground)' }}>
                                • {line}
                            </div>
                        ))}
                    </div>
                ) : null}

                {/* Top wasteful */}
                {insight.topWasteful.length > 0 ? (
                    <div style={{ display: 'grid', gap: 6 }}>
                        <div style={{ fontSize: 10.8, fontWeight: 800, color: 'var(--muted)' }}>
                            {isWastefulMode ? 'Giao dịch cần xem lại' : 'Đáng chú ý'}
                        </div>
                        {insight.topWasteful.map((item) => (
                            <div
                                key={`${item.transactionId}-${item.timestamp}`}
                                style={{
                                    borderRadius: 8,
                                    border: '1px solid var(--surface-border)',
                                    background: 'var(--surface-soft)',
                                    padding: '7px 8px',
                                    display: 'grid',
                                    gap: 3,
                                }}
                            >
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center' }}>
                                    <div style={{ fontSize: 11.4, fontWeight: 700 }}>
                                        {item.description || item.categoryName}
                                    </div>
                                    <div style={{ fontSize: 11.2, fontWeight: 800, color: '#f97316' }}>
                                        {formatCurrencyVND(item.amount)}
                                    </div>
                                </div>
                                <div style={{ fontSize: 10.6, color: 'var(--muted)', lineHeight: 1.35 }}>
                                    {item.reason}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : null}

                {insight.warnings.length > 0 ? (
                    <div style={{ fontSize: 10.8, color: '#f59e0b', lineHeight: 1.35 }}>
                        {insight.warnings.join(' ')}
                    </div>
                ) : null}
            </div>
        );
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
                                value={editingDraft.amount ? new Intl.NumberFormat('vi-VN').format(Number(editingDraft.amount) || 0) : ''}
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
                            <CustomDatePicker
                                value={formatDateInput(editingDraft.timestamp)}
                                onChange={(val) => {
                                    if (val) {
                                        updateMessageDraft(editingMessageId, (current) => ({
                                            ...current,
                                            timestamp: parseDateInputToTimestamp(val),
                                        }));
                                    }
                                }}
                                zIndex={1400}
                            />
                        </div>
                    </div>

                    <div>
                        <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 5 }}>Ví</div>
                        <CustomSelect
                            value={editingDraft.walletId}
                            onChange={(value) => updateMessageDraft(editingMessageId, (current) => ({ ...current, walletId: value }))}
                            options={walletOptions}
                            dropdownZIndex={1400}
                        />
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
                        <CustomSelect
                            value={editingDraft.categoryId}
                            onChange={(value) => updateMessageDraft(editingMessageId, (current) => ({ ...current, categoryId: value }))}
                            options={categoryOptions}
                            dropdownZIndex={1400}
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

                        {message.monthlyInsight
                            ? renderInsightCard(message.monthlyInsight)
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
                        Trợ lý Pô con đang phân tích...
                    </div>
                ) : null}
            </div>

            {renderEditModal()}

            {recentEditingTransaction
                ? createPortal(
                      <div
                          onClick={(event) => {
                              if (event.target === event.currentTarget && !isSubmittingRecentEdit) {
                                  setRecentEditingTransaction(null);
                              }
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
                                      onClick={() => setRecentEditingTransaction(null)}
                                      disabled={isSubmittingRecentEdit}
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
                                              setRecentEditType(type);
                                              const firstCategory = categories.find((item) => item.type === type)?.id || '';
                                              setRecentEditCategoryId(firstCategory);
                                          }}
                                          style={{
                                              borderRadius: 9,
                                              border: recentEditType === type ? '1.5px solid var(--chip-border)' : '1px solid var(--surface-border)',
                                              background: recentEditType === type ? 'var(--chip-bg)' : 'transparent',
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
                                          value={recentEditAmount ? new Intl.NumberFormat('vi-VN').format(Number(recentEditAmount) || 0) : ''}
                                          onChange={(event) => setRecentEditAmount(event.target.value.replace(/\D/g, ''))}
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
                                          value={recentEditDate}
                                          onChange={(val) => {
                                              if (val) setRecentEditDate(val);
                                          }}
                                          zIndex={1400}
                                      />
                                  </div>
                              </div>

                              <div>
                                  <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 5 }}>Ví</div>
                                  <CustomSelect
                                      value={recentEditWalletId}
                                      onChange={setRecentEditWalletId}
                                      options={walletOptions}
                                      dropdownZIndex={1400}
                                  />
                              </div>

                              <div>
                                  <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 5 }}>Danh mục</div>
                                  <CustomSelect
                                      value={recentEditCategoryId}
                                      onChange={setRecentEditCategoryId}
                                      options={recentCategoryOptions}
                                      dropdownZIndex={1400}
                                  />
                              </div>

                              <div>
                                  <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 5 }}>Ghi chú</div>
                                  <input
                                      value={recentEditDescription}
                                      onChange={(event) => setRecentEditDescription(event.target.value)}
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

                              {recentEditError ? <div style={{ color: '#ef4444', fontSize: 12 }}>{recentEditError}</div> : null}

                              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                                  <button
                                      type="button"
                                      onClick={() => setRecentEditingTransaction(null)}
                                      disabled={isSubmittingRecentEdit}
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
                                  <PrimaryButton onClick={() => void handleSaveRecentEdit()} disabled={isSubmittingRecentEdit}>
                                      {isSubmittingRecentEdit ? <LoaderCircle size={14} className="spin" /> : <Check size={14} />}
                                      {isSubmittingRecentEdit ? 'Đang lưu...' : 'Lưu thay đổi'}
                                  </PrimaryButton>
                              </div>
                          </div>
                      </div>,
                      document.body,
                  )
                : null}

            {recentDeleteTarget
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
                              <div style={{ fontSize: 15, fontWeight: 900 }}>Xác nhận xóa giao dịch</div>
                              <div style={{ marginTop: 4, color: 'var(--muted)', fontSize: 12.5 }}>
                                  Bạn có chắc chắn muốn xóa giao dịch này?
                              </div>

                              <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                  <button
                                      type="button"
                                      onClick={() => setRecentDeleteTarget(null)}
                                      disabled={recentDeletingId === recentDeleteTarget.id}
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
                                      onClick={() => void handleDeleteRecentTransaction()}
                                      disabled={recentDeletingId === recentDeleteTarget.id}
                                      style={{
                                          minHeight: 40,
                                          borderRadius: 12,
                                          border: '1px solid color-mix(in srgb, var(--danger) 45%, var(--border))',
                                          background: 'color-mix(in srgb, var(--danger) 16%, transparent)',
                                          color: 'var(--danger)',
                                          fontWeight: 800,
                                      }}
                                  >
                                      {recentDeletingId === recentDeleteTarget.id ? 'Đang xóa...' : 'Đồng ý'}
                                  </button>
                              </div>
                          </AppCard>
                      </div>,
                      document.body,
                  )
                : null}

            <CategoryOrderModal
                isOpen={isCategoryOrderOpen}
                type={editingDraft?.type || 'expense'}
                categories={categories}
                isSaving={isSavingCategoryOrder}
                onClose={() => setIsCategoryOrderOpen(false)}
                onSave={handleSaveCategoryOrder}
            />

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

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => void handleQuickMonthlyInsight('spending-overview')}
                    style={{
                        borderRadius: 999,
                        border: '1px solid var(--surface-border)',
                        background: 'var(--surface-soft)',
                        color: 'var(--foreground)',
                        padding: '7px 11px',
                        fontSize: 11.3,
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        opacity: isBusy ? 0.7 : 1,
                    }}
                >
                    <BarChart3 size={13} />
                    Phân tích chi tiêu tháng này
                </button>
                <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => void handleQuickMonthlyInsight('wasteful-top')}
                    style={{
                        borderRadius: 999,
                        border: '1px solid var(--surface-border)',
                        background: 'var(--surface-soft)',
                        color: 'var(--foreground)',
                        padding: '7px 11px',
                        fontSize: 11.3,
                        fontWeight: 700,
                        opacity: isBusy ? 0.7 : 1,
                    }}
                >
                    Top giao dịch "bất thường"
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'auto auto 1fr auto', gap: 8, alignItems: 'center' }}>
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

                <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => {
                        if (isVoiceListening) {
                            stopVoiceListening();
                        } else {
                            void startVoiceListening();
                        }
                    }}
                    style={{
                        width: 38,
                        height: 38,
                        borderRadius: 10,
                        border: isVoiceListening ? '1px solid color-mix(in srgb, #ef4444 60%, var(--surface-border))' : '1px solid var(--surface-border)',
                        background: isVoiceListening ? 'color-mix(in srgb, #ef4444 15%, var(--surface-soft))' : 'var(--surface-soft)',
                        color: isVoiceListening ? '#ef4444' : 'var(--foreground)',
                        display: 'grid',
                        placeItems: 'center',
                        opacity: isBusy ? 0.7 : 1,
                    }}
                    title={isVoiceListening ? 'Dừng ghi âm' : 'Voice chat'}
                >
                    {isVoiceListening ? <Square size={14} /> : <Mic size={16} />}
                </button>

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

            {isVoiceListening ? (
                <div
                    style={{
                        borderRadius: 10,
                        border: '1px solid var(--surface-border)',
                        background: 'var(--surface-soft)',
                        padding: '8px 10px',
                        display: 'grid',
                        gap: 6,
                    }}
                >
                    <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                        Đang lắng nghe giọng nói...
                    </div>
                    <div
                        style={{
                            height: 6,
                            borderRadius: 999,
                            background: 'color-mix(in srgb, var(--surface-border) 45%, transparent)',
                            overflow: 'hidden',
                        }}
                    >
                        <div
                            style={{
                                width: `${Math.max(6, Math.round(voiceLevel * 100))}%`,
                                height: '100%',
                                borderRadius: 999,
                                background: 'linear-gradient(90deg, #22c55e, #06b6d4)',
                                transition: 'width 80ms linear',
                            }}
                        />
                    </div>
                </div>
            ) : null}

            <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                Nhớ kiểm tra kỹ trước khi tạo giao dịch nhé, nếu sai sót mong bạn thông cảm.
            </div>

            <div style={{ borderTop: '1px solid var(--surface-border)', paddingTop: 10, display: 'grid', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <div style={{ fontSize: 12.2, fontWeight: 800 }}>5 giao dịch gần đây</div>
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
                            const isDraggingThis = recentDragRef.current?.id === transaction.id;
                            const translateX = isDraggingThis
                                ? recentDragOffsetX
                                : swipedRecentTransactionId === transaction.id
                                    ? -CHAT_SWIPE_SNAP_TO_EDIT
                                    : 0;
                            const showActions =
                                isDraggingThis
                                || swipedRecentTransactionId === transaction.id
                                || translateX < -1;

                            return (
                                <div
                                    key={transaction.id}
                                    style={{
                                        borderRadius: 9,
                                        position: 'relative',
                                        overflow: 'hidden',
                                    }}
                                >
                                    <div
                                        style={{
                                            border: '1px solid var(--surface-border)',
                                            background: 'var(--surface-soft)',
                                            position: 'absolute',
                                            inset: 0,
                                            display: 'flex',
                                            justifyContent: 'flex-end',
                                            alignItems: 'stretch',
                                            gap: CHAT_ACTION_GAP,
                                            padding: CHAT_ACTION_SIDE_PADDING,
                                            opacity: showActions ? 1 : 0,
                                            pointerEvents: showActions ? 'auto' : 'none',
                                            transition: 'opacity 140ms ease',
                                        }}
                                    >
                                        <button
                                            type="button"
                                            onClick={() => openRecentEditModal(transaction)}
                                            style={{
                                                width: CHAT_ACTION_BUTTON_WIDTH,
                                                border: '1px solid rgba(59,130,246,0.35)',
                                                borderRadius: 8,
                                                background: 'rgba(59,130,246,0.14)',
                                                color: '#2563eb',
                                                display: 'grid',
                                                placeItems: 'center',
                                            }}
                                            title="Chỉnh sửa"
                                        >
                                            <Pencil size={14} />
                                        </button>
                                        <button
                                            type="button"
                                            disabled={recentDeletingId === transaction.id}
                                            onClick={() => {
                                                setRecentDeleteTarget(transaction);
                                                setSwipedRecentTransactionId(null);
                                            }}
                                            style={{
                                                width: CHAT_ACTION_BUTTON_WIDTH,
                                                border: '1px solid rgba(239,68,68,0.35)',
                                                borderRadius: 8,
                                                background: 'rgba(239,68,68,0.14)',
                                                color: '#dc2626',
                                                display: 'grid',
                                                placeItems: 'center',
                                                opacity: recentDeletingId === transaction.id ? 0.7 : 1,
                                            }}
                                            title="Xóa"
                                        >
                                            {recentDeletingId === transaction.id ? <LoaderCircle size={14} className="spin" /> : <Trash2 size={14} />}
                                        </button>
                                    </div>

                                    <div
                                        onPointerDown={(event) => handleRecentPointerDown(transaction.id, event)}
                                        onPointerMove={(event) => handleRecentPointerMove(transaction.id, event)}
                                        onPointerUp={() => handleRecentPointerEnd(transaction.id)}
                                        onPointerCancel={() => handleRecentPointerEnd(transaction.id)}
                                        onClick={() => {
                                            if (recentIgnoreNextClickRef.current) {
                                                recentIgnoreNextClickRef.current = false;
                                                return;
                                            }

                                            if (swipedRecentTransactionId === transaction.id) {
                                                setSwipedRecentTransactionId(null);
                                            }
                                        }}
                                        style={{
                                            border: '1px solid var(--surface-border)',
                                            background: 'linear-gradient(135deg, color-mix(in srgb, var(--surface-soft) 92%, white), var(--surface-soft))',
                                            borderRadius: 9,
                                            padding: '8px 9px',
                                            display: 'grid',
                                            gridTemplateColumns: 'auto 1fr auto',
                                            gap: 8,
                                            alignItems: 'center',
                                            position: 'relative',
                                            zIndex: 1,
                                            transform: `translateX(${translateX}px)`,
                                            transition: isDraggingThis ? 'none' : 'transform 180ms ease',
                                            touchAction: 'pan-y',
                                            cursor: isDraggingThis ? 'grabbing' : 'pointer',
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
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </AppCard>
    );
}
