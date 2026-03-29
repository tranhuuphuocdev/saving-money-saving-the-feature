'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, X } from 'lucide-react';
import { CustomSelect } from '@/components/common/custom-select';
import { PrimaryButton } from '@/components/common/primary-button';
import { formatCurrencyVND } from '@/lib/formatters';
import {
    createCategoryRequest,
    createTransactionRequest,
    getCategoriesRequest,
    getWalletsRequest,
} from '@/lib/calendar/api';
import { ICategoryItem, IWalletItem } from '@/types/calendar';

const CATEGORY_ICON_OPTIONS = [
    '🍜', '🛵', '🛒', '🏠', '💡', '🎓', '💊', '🎬', '🛍️', '💘', '📦', '💼', '💰', '📈', '🎁', '🧾',
];

const OTHER_CATEGORY_ID = '__other__';

const MONTH_LABELS = [
    'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5',
    'Tháng 6', 'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12',
];

export function FloatingTransactionBubble() {
    const [isMounted, setIsMounted] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [isClosing, setIsClosing] = useState(false);

    // --- Drag state ---
    // Use right/bottom instead of left/top so the bubble stays anchored to the
    // bottom-right viewport corner regardless of URL-bar show/hide on mobile.
    const [pos, setPos] = useState<{ right: number; bottom: number } | null>(null);
    const isDragging = useRef(false);
    const hasMoved = useRef(false);
    // Stores the offset between pointer position and the bubble's right/bottom edge at drag start
    const dragOffset = useRef({ right: 0, bottom: 0 });
    const pointerDownPos = useRef({ x: 0, y: 0 });
    const dragTargetRef = useRef<HTMLDivElement | null>(null);
    const dragPointerIdRef = useRef<number | null>(null);
    // Tracks when modal was opened to debounce ghost clicks on mobile (300ms delay)
    const openedAtRef = useRef<number>(0);

    // --- Date state ---
    const [day, setDay] = useState(1);
    const [month, setMonth] = useState(1);
    const [year, setYear] = useState(2026);

    // --- Transaction form state ---
    const [type, setType] = useState<'income' | 'expense'>('expense');
    const [amount, setAmount] = useState('');
    const [walletId, setWalletId] = useState('');
    const [categoryId, setCategoryId] = useState('');
    const [description, setDescription] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // --- Data ---
    const [wallets, setWallets] = useState<IWalletItem[]>([]);
    const [localCategories, setLocalCategories] = useState<ICategoryItem[]>([]);

    // --- Create category sub-modal ---
    const [isCreateCatOpen, setIsCreateCatOpen] = useState(false);
    const [newCatName, setNewCatName] = useState('');
    const [newCatIcon, setNewCatIcon] = useState(CATEGORY_ICON_OPTIONS[0]);
    const [isCreatingCat, setIsCreatingCat] = useState(false);

    useEffect(() => {
        setIsMounted(true);
        // Anchor to bottom-right: 18px from right, 98px from bottom (center of 40px bubble)
        setPos({ right: 18, bottom: 98 });

        const now = new Date();
        setDay(now.getDate());
        setMonth(now.getMonth() + 1);
        setYear(now.getFullYear());
    }, []);

    // Load wallets + categories when modal opens
    useEffect(() => {
        if (!isOpen) return;

        let ignore = false;
        Promise.all([getWalletsRequest(), getCategoriesRequest()]).then(([walletSummary, fetchedCats]) => {
            if (ignore) return;
            const fetchedWallets = walletSummary.wallets;
            setWallets(fetchedWallets);
            setLocalCategories(fetchedCats);

            if (fetchedWallets.length > 0) {
                const richest = fetchedWallets.reduce((a: IWalletItem, b: IWalletItem) => (b.balance > a.balance ? b : a));
                setWalletId(richest.id);
            }
            const defaultCat = fetchedCats.find((c) => c.type === 'expense') ?? fetchedCats[0];
            if (defaultCat) setCategoryId(defaultCat.id);
        });

        return () => { ignore = true; };
    }, [isOpen]);

    // Reset form when opening
    const openModal = useCallback(() => {
        const now = new Date();
        setDay(now.getDate());
        setMonth(now.getMonth() + 1);
        setYear(now.getFullYear());
        setType('expense');
        setAmount('');
        setDescription('');
        setErrorMessage('');
        openedAtRef.current = Date.now();
        setIsOpen(true);
    }, []);

    const closeModal = useCallback(() => {
        setIsClosing(true);
        setTimeout(() => {
            setIsOpen(false);
            setIsClosing(false);
        }, 280);
    }, []);

    // Days in selected month (for select options)
    const daysInMonth = useMemo(() => new Date(year, month, 0).getDate(), [month, year]);

    useEffect(() => {
        if (day > daysInMonth) setDay(daysInMonth);
    }, [day, daysInMonth]);

    // Year options: 3 years back to 1 year ahead
    const yearOptions = useMemo(() => {
        const cur = new Date().getFullYear();
        return [cur - 2, cur - 1, cur, cur + 1];
    }, []);

    const daySelectOptions = useMemo(
        () => Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => ({
            value: String(d),
            label: String(d).padStart(2, '0'),
        })),
        [daysInMonth],
    );

    const monthSelectOptions = useMemo(
        () => MONTH_LABELS.map((label, i) => ({ value: String(i + 1), label })),
        [],
    );

    const yearSelectOptions = useMemo(
        () => yearOptions.map((y) => ({ value: String(y), label: String(y) })),
        [yearOptions],
    );

    // Formatted amount with VN thousand separators
    const formattedAmount = useMemo(() => {
        const n = parseInt(amount, 10);
        if (!amount || isNaN(n)) return '';
        return new Intl.NumberFormat('vi-VN').format(n);
    }, [amount]);

    // Category options filtered by type + "create new" entry
    const categoryOptions = useMemo(() => {
        const filtered = localCategories.filter((c) => c.type === type);
        const list = filtered.length > 0 ? filtered : localCategories;
        return [...list, { id: OTHER_CATEGORY_ID, name: 'Tạo mới +', icon: '✏️', type: type as 'income' | 'expense', isDefault: false }];
    }, [localCategories, type]);

    // --- Drag handlers ---
    // NOTE: We defer setPointerCapture until the user has moved past the drag threshold
    // (6 px). This prevents a light tap or page-scroll gesture that starts on the bubble
    // from capturing all pointer events and moving the bubble unintentionally on mobile.
    const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        isDragging.current = true;
        hasMoved.current = false;
        dragTargetRef.current = e.currentTarget;
        dragPointerIdRef.current = e.pointerId;
        pointerDownPos.current = { x: e.clientX, y: e.clientY };
        // Store the offset as distance from pointer to the right/bottom edges of the viewport
        dragOffset.current = {
            right: window.innerWidth - e.clientX - (pos?.right ?? 18),
            bottom: window.innerHeight - e.clientY - (pos?.bottom ?? 98),
        };
    }, [pos]);

    const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        if (!isDragging.current) return;
        const movedX = Math.abs(e.clientX - pointerDownPos.current.x);
        const movedY = Math.abs(e.clientY - pointerDownPos.current.y);

        if (!hasMoved.current && (movedX > 6 || movedY > 6)) {
            hasMoved.current = true;
            // Only capture pointer AFTER confirming it's a real drag, not a scroll/tap
            if (dragTargetRef.current && dragPointerIdRef.current !== null) {
                try { dragTargetRef.current.setPointerCapture(dragPointerIdRef.current); } catch {}
            }
        }

        if (!hasMoved.current) return;

        // Recompute right/bottom so bubble stays under the pointer
        const newRight = Math.max(0, Math.min(
            window.innerWidth - 28,
            window.innerWidth - e.clientX - dragOffset.current.right,
        ));
        const newBottom = Math.max(0, Math.min(
            window.innerHeight - 28,
            window.innerHeight - e.clientY - dragOffset.current.bottom,
        ));
        setPos({ right: newRight, bottom: newBottom });
    }, []);

    const handlePointerUp = useCallback(() => {
        isDragging.current = false;
        dragTargetRef.current = null;
        dragPointerIdRef.current = null;
        if (!hasMoved.current) openModal();
    }, [openModal]);
    // --- Submit transaction ---
    const handleSubmit = useCallback(async () => {
        const digits = amount.replace(/\D/g, '');
        const amountValue = parseInt(digits, 10);

        if (!amountValue || amountValue <= 0) {
            setErrorMessage('Vui lòng nhập số tiền hợp lệ.');
            return;
        }
        if (!walletId) {
            setErrorMessage('Vui lòng chọn ví.');
            return;
        }
        if (!categoryId || categoryId === OTHER_CATEGORY_ID) {
            setErrorMessage('Vui lòng chọn danh mục.');
            return;
        }

        setIsSubmitting(true);
        setErrorMessage('');

        try {
            const timestamp = new Date(year, month - 1, day, 12, 0, 0).getTime();
            await createTransactionRequest({ walletId, amount: amountValue, category: categoryId, description: description.trim() || undefined, type, timestamp });
            window.dispatchEvent(new CustomEvent('transaction:changed'));
            closeModal();
        } catch (err) {
            setErrorMessage(
                (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Có lỗi xảy ra, vui lòng thử lại.',
            );
        } finally {
            setIsSubmitting(false);
        }
    }, [amount, walletId, categoryId, year, month, day, description, type, closeModal]);

    // --- Submit create category ---
    const handleCreateCategory = useCallback(async () => {
        const safeName = newCatName.trim();
        if (!safeName) {
            setErrorMessage('Tên danh mục không được để trống.');
            return;
        }
        setIsCreatingCat(true);
        try {
            const created = await createCategoryRequest({ name: safeName, type, icon: newCatIcon });
            setLocalCategories((prev) => prev.find((c) => c.id === created.id) ? prev : [created, ...prev]);
            setCategoryId(created.id);
            setIsCreateCatOpen(false);
            setNewCatName('');
            setErrorMessage('');
        } catch (err) {
            setErrorMessage(
                (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Tạo danh mục thất bại.',
            );
        } finally {
            setIsCreatingCat(false);
        }
    }, [newCatName, type, newCatIcon]);

    if (!isMounted || !pos) return null;

    return createPortal(
        <>
            {/* ── Floating Bubble ── */}
            {!isOpen && (
                <div
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    style={{
                        position: 'fixed',
                        right: pos.right,
                        bottom: pos.bottom,
                        zIndex: 50,
                        cursor: 'grab',
                        userSelect: 'none',
                        // Allow vertical scroll to pass through when not dragging
                        touchAction: 'none',
                    }}
                >
                    <div className="bubble-float" style={{ width: 40, height: 40, position: 'relative' }}>
                        {/* Ping ripple ring */}
                        <div
                            className="bubble-ping"
                            style={{
                                position: 'absolute',
                                inset: 0,
                                borderRadius: '50%',
                                background: 'var(--accent)',
                                opacity: 0.35,
                                pointerEvents: 'none',
                            }}
                        />
                        {/* Main bubble */}
                        <div
                            style={{
                                width: 40,
                                height: 40,
                                borderRadius: '50%',
                                background: 'linear-gradient(135deg, var(--theme-gradient-start), var(--theme-gradient-end))',
                                boxShadow: '0 6px 24px rgba(0,0,0,0.35), 0 0 0 5px color-mix(in srgb, var(--accent) 22%, transparent)',
                                display: 'grid',
                                placeItems: 'center',
                                color: '#fff',
                                position: 'relative',
                            }}
                        >
                            <Plus size={17} strokeWidth={2.8} />
                        </div>
                    </div>
                </div>
            )}

            {/* ── Transaction Modal ── */}
            {isOpen && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 900,
                        background: 'rgba(2, 8, 23, 0.55)',
                        backdropFilter: 'blur(3px)',
                        display: 'flex',
                        alignItems: 'flex-end',
                        justifyContent: 'center',
                    }}
                    className={isClosing ? 'modal-backdrop-out' : 'modal-backdrop-in'}
                    onClick={(e) => {
                        if (e.target !== e.currentTarget) return;
                        // Guard against ghost clicks on mobile (300ms synthetic click after touch)
                        if (Date.now() - openedAtRef.current < 400) return;
                        closeModal();
                    }}
                    onTouchEnd={(e) => {
                        if (e.target !== e.currentTarget) return;
                        if (Date.now() - openedAtRef.current < 400) return;
                        closeModal();
                    }}>
                    <div
                        className={isClosing ? 'modal-slide-down' : 'modal-slide-up'}
                        onClick={(e) => e.stopPropagation()}
                        onTouchEnd={(e) => e.stopPropagation()}
                        style={{
                            width: 'min(100%, 520px)',
                            maxHeight: '94dvh',
                            borderRadius: '20px 20px 0 0',
                            background: 'var(--surface-base)',
                            border: '1px solid var(--surface-border)',
                            borderBottom: 'none',
                            display: 'flex',
                            flexDirection: 'column',
                            overflow: 'hidden',
                        }}
                    >
                        {/* Header */}
                        <div style={{
                            padding: '12px 14px',
                            borderBottom: '1px solid var(--surface-border)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexShrink: 0,
                        }}>
                            <div>
                                <div style={{ fontWeight: 900, fontSize: 15 }}>Nhập giao dịch nhanh</div>
                                <div style={{ color: 'var(--muted)', fontSize: 11, marginTop: 2 }}>Ghi lại thu chi bất kỳ lúc nào</div>
                            </div>
                            <button
                                onClick={() => closeModal()}
                                style={{
                                    width: 32, height: 32, borderRadius: 10,
                                    border: '1px solid var(--surface-border)',
                                    background: 'var(--surface-soft)',
                                    color: 'var(--foreground)',
                                    display: 'grid', placeItems: 'center',
                                }}
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* Scrollable form body */}
                        <div style={{ overflowY: 'auto', padding: '14px 14px 8px', display: 'grid', gap: 14, flex: 1 }}>

                            {/* ── Date selector ── */}
                            <div>
                                <div style={{ fontSize: 11.5, color: 'var(--muted)', fontWeight: 700, marginBottom: 6 }}>Ngày giao dịch</div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr 1fr', gap: 8 }}>
                                    {/* Day */}
                                    <div style={{ display: 'grid', gap: 3 }}>
                                        <div style={{ fontSize: 10, color: 'var(--muted)', textAlign: 'center' }}>Ngày</div>
                                        <CustomSelect
                                            value={String(day)}
                                            onChange={(value) => setDay(Number(value))}
                                            options={daySelectOptions}
                                        />
                                    </div>
                                    {/* Month */}
                                    <div style={{ display: 'grid', gap: 3 }}>
                                        <div style={{ fontSize: 10, color: 'var(--muted)', textAlign: 'center' }}>Tháng</div>
                                        <CustomSelect
                                            value={String(month)}
                                            onChange={(value) => setMonth(Number(value))}
                                            options={monthSelectOptions}
                                        />
                                    </div>
                                    {/* Year */}
                                    <div style={{ display: 'grid', gap: 3 }}>
                                        <div style={{ fontSize: 10, color: 'var(--muted)', textAlign: 'center' }}>Năm</div>
                                        <CustomSelect
                                            value={String(year)}
                                            onChange={(value) => setYear(Number(value))}
                                            options={yearSelectOptions}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* ── Type toggle ── */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                {(['expense', 'income'] as const).map((t) => (
                                    <button
                                        key={t}
                                        type="button"
                                        onClick={() => {
                                            setType(t);
                                            const defaultCat = localCategories.find((c) => c.type === t);
                                            if (defaultCat) setCategoryId(defaultCat.id);
                                        }}
                                        style={{
                                            borderRadius: 10,
                                            border: type === t
                                                ? '1.5px solid var(--chip-border)'
                                                : '1px solid var(--surface-border)',
                                            background: type === t ? 'var(--chip-bg)' : 'transparent',
                                            color: 'var(--foreground)',
                                            padding: '10px 0',
                                            fontWeight: 800,
                                            fontSize: 13,
                                        }}
                                    >
                                        {t === 'expense' ? '💸 Chi tiêu' : '💰 Thu nhập'}
                                    </button>
                                ))}
                            </div>

                            {/* ── Amount ── */}
                            <div>
                                <div style={{ fontSize: 11.5, color: 'var(--muted)', fontWeight: 700, marginBottom: 6 }}>Số tiền</div>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    value={formattedAmount}
                                    onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
                                    placeholder="0 ₫"
                                    style={{
                                        width: '100%',
                                        borderRadius: 10,
                                        border: '1px solid var(--surface-border)',
                                        background: 'var(--surface-soft)',
                                        color: 'var(--foreground)',
                                        padding: '11px 12px',
                                        fontSize: 16,
                                        fontWeight: 900,
                                        textAlign: 'right',
                                        boxSizing: 'border-box',
                                    }}
                                />
                            </div>

                            {/* ── Wallet ── */}
                            {wallets.length > 0 && (
                                <div>
                                    <div style={{ fontSize: 11.5, color: 'var(--muted)', fontWeight: 700, marginBottom: 6 }}>Ví thanh toán</div>
                                    <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                                        {wallets.map((w) => (
                                            <button
                                                key={w.id}
                                                type="button"
                                                onClick={() => setWalletId(w.id)}
                                                style={{
                                                    borderRadius: 10,
                                                    border: walletId === w.id ? '1.5px solid var(--chip-border)' : '1px solid var(--surface-border)',
                                                    background: walletId === w.id ? 'var(--chip-bg)' : 'var(--surface-soft)',
                                                    color: 'var(--foreground)',
                                                    padding: '7px 11px',
                                                    fontSize: 12,
                                                    fontWeight: walletId === w.id ? 800 : 600,
                                                    textAlign: 'center',
                                                }}
                                            >
                                                <div>{w.name}</div>
                                                <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{formatCurrencyVND(w.balance)}</div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* ── Category grid ── */}
                            <div>
                                <div style={{ fontSize: 11.5, color: 'var(--muted)', fontWeight: 700, marginBottom: 6 }}>Danh mục</div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 7 }}>
                                    {categoryOptions.map((cat) => {
                                        const isOther = cat.id === OTHER_CATEGORY_ID;
                                        const selected = categoryId === cat.id;
                                        return (
                                            <button
                                                key={cat.id}
                                                type="button"
                                                onClick={() => {
                                                    if (isOther) {
                                                        setNewCatName('');
                                                        setNewCatIcon(CATEGORY_ICON_OPTIONS[0]);
                                                        setIsCreateCatOpen(true);
                                                        return;
                                                    }
                                                    setCategoryId(cat.id);
                                                }}
                                                style={{
                                                    borderRadius: 10,
                                                    border: selected
                                                        ? '1.5px solid var(--chip-border)'
                                                        : '1px solid var(--surface-border)',
                                                    background: selected ? 'var(--chip-bg)' : 'var(--surface-soft)',
                                                    color: 'var(--foreground)',
                                                    padding: '9px 4px',
                                                    fontSize: 11,
                                                    fontWeight: selected ? 800 : 600,
                                                    display: 'grid',
                                                    gap: 4,
                                                    placeItems: 'center',
                                                    textAlign: 'center',
                                                    lineHeight: 1.25,
                                                    wordBreak: 'break-word',
                                                }}
                                            >
                                                {!isOther && (
                                                    <span style={{ fontSize: 15, lineHeight: 1 }}>{cat.icon || '🧩'}</span>
                                                )}
                                                <span>{cat.name}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* ── Description ── */}
                            <div>
                                <div style={{ fontSize: 11.5, color: 'var(--muted)', fontWeight: 700, marginBottom: 6 }}>Ghi chú (tùy chọn)</div>
                                <input
                                    type="text"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Mô tả ngắn..."
                                    maxLength={200}
                                    style={{
                                        width: '100%',
                                        borderRadius: 10,
                                        border: '1px solid var(--surface-border)',
                                        background: 'var(--surface-soft)',
                                        color: 'var(--foreground)',
                                        padding: '9px 12px',
                                        fontSize: 13,
                                        boxSizing: 'border-box',
                                    }}
                                />
                            </div>

                            {/* ── Error ── */}
                            {errorMessage && (
                                <div style={{
                                    borderRadius: 10,
                                    padding: '9px 12px',
                                    background: 'rgba(239,68,68,0.12)',
                                    border: '1px solid rgba(239,68,68,0.38)',
                                    color: '#f87171',
                                    fontSize: 12,
                                    fontWeight: 600,
                                }}>
                                    {errorMessage}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div style={{
                            padding: '10px 14px calc(12px + env(safe-area-inset-bottom, 0px))',
                            borderTop: '1px solid var(--surface-border)',
                            display: 'grid',
                            gridTemplateColumns: 'auto 1fr',
                            gap: 8,
                            flexShrink: 0,
                        }}>
                            <button
                                onClick={() => closeModal()}
                                style={{
                                    borderRadius: 12,
                                    border: '1px solid var(--surface-border)',
                                    background: 'transparent',
                                    color: 'var(--foreground)',
                                    fontWeight: 700,
                                    padding: '11px 18px',
                                    fontSize: 13,
                                }}
                            >
                                Hủy
                            </button>
                            <PrimaryButton
                                onClick={() => void handleSubmit()}
                                disabled={isSubmitting}
                                style={{ opacity: isSubmitting ? 0.7 : 1 }}
                            >
                                {isSubmitting ? 'Đang lưu...' : 'Lưu giao dịch'}
                            </PrimaryButton>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Create category sub-modal ── */}
            {isCreateCatOpen && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 920,
                    background: 'rgba(2, 8, 23, 0.5)',
                    backdropFilter: 'blur(2px)',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    padding: 12,
                }}>
                    <div style={{
                        width: 'min(calc(100% - 24px), 480px)',
                        maxHeight: 'calc(100dvh - 24px)',
                        borderRadius: 18,
                        background: 'var(--surface-base)',
                        border: '1px solid var(--surface-border)',
                        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                    }}>
                        {/* sub-header */}
                        <div style={{
                            padding: '12px 14px',
                            borderBottom: '1px solid var(--surface-border)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                        }}>
                            <div style={{ fontWeight: 800, fontSize: 14 }}>Tạo danh mục mới</div>
                            <button
                                onClick={() => setIsCreateCatOpen(false)}
                                style={{
                                    width: 30, height: 30, borderRadius: 8,
                                    border: 'none', background: 'var(--chip-bg)',
                                    color: 'var(--foreground)', display: 'grid', placeItems: 'center',
                                }}
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <div style={{ padding: '12px 14px', display: 'grid', gap: 10, overflowY: 'auto' }}>
                            <input
                                type="text"
                                value={newCatName}
                                onChange={(e) => setNewCatName(e.target.value)}
                                placeholder="Tên danh mục (VD: Cà phê sáng)"
                                style={{
                                    padding: '10px 12px', borderRadius: 10,
                                    border: '1px solid var(--surface-border)',
                                    background: 'var(--surface-soft)', color: 'var(--foreground)', fontSize: 13,
                                }}
                            />
                            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>Chọn icon</div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                                {CATEGORY_ICON_OPTIONS.map((icon) => (
                                    <button
                                        key={icon}
                                        type="button"
                                        onClick={() => setNewCatIcon(icon)}
                                        style={{
                                            borderRadius: 10,
                                            border: icon === newCatIcon
                                                ? '1.5px solid var(--theme-gradient-start)'
                                                : '1px solid var(--surface-border)',
                                            background: icon === newCatIcon ? 'var(--chip-bg)' : 'var(--surface-soft)',
                                            color: 'var(--foreground)',
                                            aspectRatio: '1 / 1',
                                            display: 'grid', placeItems: 'center', fontSize: 20,
                                        }}
                                    >
                                        {icon}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div style={{
                            padding: '12px 14px',
                            borderTop: '1px solid var(--surface-border)',
                            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
                        }}>
                            <button
                                onClick={() => setIsCreateCatOpen(false)}
                                style={{
                                    border: '1px solid var(--surface-border)', background: 'transparent',
                                    color: 'var(--foreground)', borderRadius: 10, padding: '10px 12px', fontWeight: 700,
                                }}
                            >
                                Hủy
                            </button>
                            <PrimaryButton
                                onClick={() => void handleCreateCategory()}
                                disabled={isCreatingCat}
                                style={{ padding: '10px 12px', opacity: isCreatingCat ? 0.7 : 1 }}
                            >
                                {isCreatingCat ? 'Đang tạo...' : 'Tạo danh mục'}
                            </PrimaryButton>
                        </div>
                    </div>
                </div>
            )}
        </>,
        document.body,
    );
}
