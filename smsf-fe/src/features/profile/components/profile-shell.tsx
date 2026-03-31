'use client';

import { Camera, CheckCircle2, ChevronDown, ChevronUp, Eye, EyeOff, GripVertical, History, ImageUp, LoaderCircle, MessageCircle, UserRound, WalletCards } from 'lucide-react';
import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { AppCard } from '@/components/common/app-card';
import { CustomSelect } from '@/components/common/custom-select';
import { PrimaryButton } from '@/components/common/primary-button';
import { BottomNav } from '@/components/navigation/bottom-nav';
import { UserAvatar } from '@/components/common/user-avatar';
import { AvatarCropModal } from '@/features/profile/components/avatar-crop-modal';
import { AvatarPreviewModal } from '@/features/profile/components/avatar-preview-modal';
import { formatCurrencyVND } from '@/lib/formatters';
import { getWalletLogsRequest, IWalletLogItem, IWalletLogPage } from '@/lib/calendar/api';
import { useBalanceVisible } from '@/lib/ui/use-balance-visible';
import { useAuth } from '@/providers/auth-provider';
import { TypeDashboardTab } from '@/types/dashboard';

export function ProfileShell() {
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const { user, wallets, totalWalletBalance, isAuthenticated, isLoading, updateTelegramChatId, refreshProfile, createWallet, updateWalletActive, dragReorderWallets, uploadAvatar } = useAuth();

    const [displayName, setDisplayName] = useState('');
    const [telegramChatId, setTelegramChatId] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [walletName, setWalletName] = useState('');
    const [walletType, setWalletType] = useState('custom');
    const [walletBalance, setWalletBalance] = useState('');
    const [walletErrorMessage, setWalletErrorMessage] = useState('');
    const [walletSuccessMessage, setWalletSuccessMessage] = useState('');
    const [isCreatingWallet, setIsCreatingWallet] = useState(false);
    const [isAvatarPreviewOpen, setIsAvatarPreviewOpen] = useState(false);
    const [cropImageUrl, setCropImageUrl] = useState('');
    const [isAvatarUploading, setIsAvatarUploading] = useState(false);

    const [togglingWalletId, setTogglingWalletId] = useState<string | null>(null);
        const [draggingWalletIndex, setDraggingWalletIndex] = useState<number | null>(null);
        const [dragOverWalletIndex, setDragOverWalletIndex] = useState<number | null>(null);
    const { isVisible: isBalanceVisible, toggle: toggleBalance } = useBalanceVisible();

    const [expandedWalletId, setExpandedWalletId] = useState<string | null>(null);
    const [walletLogsMap, setWalletLogsMap] = useState<Record<string, IWalletLogPage>>({});
    const [isLoadingLogsFor, setIsLoadingLogsFor] = useState<string | null>(null);
    const [hoveredWalletId, setHoveredWalletId] = useState<string | null>(null);

    const handleLoadWalletLogs = useCallback(async (walletId: string) => {
        setIsLoadingLogsFor(walletId);
        try {
            const data = await getWalletLogsRequest(walletId, 1, 5);
            setWalletLogsMap((prev) => ({ ...prev, [walletId]: data }));
        } catch {
            // ignore
        } finally {
            setIsLoadingLogsFor(null);
        }
    }, []);

    const handleToggleWalletHistory = useCallback((walletId: string) => {
        if (expandedWalletId === walletId) {
            setExpandedWalletId(null);
            return;
        }
        setExpandedWalletId(walletId);
        void handleLoadWalletLogs(walletId);
    }, [expandedWalletId, handleLoadWalletLogs]);

    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            router.replace('/login');
        }
    }, [isAuthenticated, isLoading, router]);

    useEffect(() => {
        setDisplayName(user?.displayName || '');
    }, [user?.displayName]);

    useEffect(() => {
        setTelegramChatId(user?.telegramChatId || '');
    }, [user?.telegramChatId]);

    useEffect(() => {
        return () => {
            if (cropImageUrl.startsWith('blob:')) {
                URL.revokeObjectURL(cropImageUrl);
            }
        };
    }, [cropImageUrl]);

    const hasTelegramId = useMemo(() => Boolean((user?.telegramChatId || '').trim()), [user?.telegramChatId]);

    const handleToggleWalletActive = useCallback(async (walletId: string, current: boolean) => {
        setTogglingWalletId(walletId);
        try {
            await updateWalletActive(walletId, !current);
        } finally {
            setTogglingWalletId(null);
        }
    }, [updateWalletActive]);

    const handleWalletDragStart = useCallback((walletIndex: number) => {
        setDraggingWalletIndex(walletIndex);
    }, []);

    const handleWalletDragOver = useCallback((walletIndex: number) => {
        setDragOverWalletIndex(walletIndex);
    }, []);

    const handleWalletDrop = useCallback(async (targetIndex: number) => {
        if (draggingWalletIndex === null || draggingWalletIndex === targetIndex) {
            setDraggingWalletIndex(null);
            setDragOverWalletIndex(null);
            return;
        }

        await dragReorderWallets(draggingWalletIndex, targetIndex);
        setDraggingWalletIndex(null);
        setDragOverWalletIndex(null);
    }, [dragReorderWallets, draggingWalletIndex]);

    const handleWalletDragEnd = useCallback(() => {
        setDraggingWalletIndex(null);
        setDragOverWalletIndex(null);
    }, []);

    const openAvatarPicker = useCallback(() => {
        fileInputRef.current?.click();
    }, []);

    const closeCropModal = useCallback(() => {
        if (isAvatarUploading) {
            return;
        }

        setCropImageUrl((currentUrl) => {
            if (currentUrl.startsWith('blob:')) {
                URL.revokeObjectURL(currentUrl);
            }

            return '';
        });
    }, [isAvatarUploading]);

    const handleAvatarFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = '';

        if (!file) {
            return;
        }

        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
            setErrorMessage('Chỉ hỗ trợ JPG, PNG hoặc WebP cho avatar.');
            setSuccessMessage('');
            return;
        }

        if (file.size > 10 * 1024 * 1024) {
            setErrorMessage('Ảnh avatar tối đa 10MB.');
            setSuccessMessage('');
            return;
        }

        const nextObjectUrl = URL.createObjectURL(file);

        setCropImageUrl((currentUrl) => {
            if (currentUrl.startsWith('blob:')) {
                URL.revokeObjectURL(currentUrl);
            }

            return nextObjectUrl;
        });

        setErrorMessage('');
        setSuccessMessage('');
        setIsAvatarPreviewOpen(false);
    }, []);

    const handleAvatarUpload = useCallback(async (file: File) => {
        setIsAvatarUploading(true);
        setErrorMessage('');
        setSuccessMessage('');

        try {
            await uploadAvatar(file);
            await refreshProfile();
            closeCropModal();
            setSuccessMessage('Avatar đã được cập nhật.');
        } catch (error) {
            const responseMessage =
                (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
                'Tải avatar thất bại.';
            setErrorMessage(responseMessage);
        } finally {
            setIsAvatarUploading(false);
        }
    }, [closeCropModal, refreshProfile, uploadAvatar]);

    const handleSaveProfile = async () => {
        const nextDisplayName = displayName.trim();

        if (nextDisplayName.length > 60) {
            setErrorMessage('Display name tối đa 60 ký tự.');
            setSuccessMessage('');
            return;
        }

        setIsSubmitting(true);
        setErrorMessage('');
        setSuccessMessage('');

        try {
            await updateTelegramChatId(telegramChatId.trim() || undefined, nextDisplayName || undefined);
            await refreshProfile();
            setSuccessMessage('Đã cập nhật hồ sơ thành công.');
        } catch (error) {
            const responseMessage =
                (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
                'Cập nhật hồ sơ thất bại.';
            setErrorMessage(responseMessage);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCreateWallet = async () => {
        const trimmedName = walletName.trim();
        const initialBalance = Number(walletBalance.replace(/\D/g, '') || 0);

        setWalletErrorMessage('');
        setWalletSuccessMessage('');

        if (!trimmedName) {
            setWalletErrorMessage('Vui lòng nhập tên ví.');
            return;
        }

        if (trimmedName.length > 40) {
            setWalletErrorMessage('Tên ví tối đa 40 ký tự.');
            return;
        }

        setIsCreatingWallet(true);

        try {
            await createWallet({
                name: trimmedName,
                type: walletType,
                balance: initialBalance,
            });

            setWalletName('');
            setWalletType('custom');
            setWalletBalance('');
            setWalletSuccessMessage('Đã thêm ví mới thành công.');
        } catch (error) {
            const responseMessage =
                (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
                'Tạo ví thất bại.';
            setWalletErrorMessage(responseMessage);
        } finally {
            setIsCreatingWallet(false);
        }
    };

    const handleNavSelect = useCallback((tab: TypeDashboardTab) => {
        if (tab === 'menu' || tab === 'dashboard') {
            router.push('/dashboard');
            return;
        }

        router.push(`/dashboard?tab=${tab}`);
    }, [router]);

    if (isLoading) {
        return (
            <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#dbeafe', fontSize: 14 }}>
                    <LoaderCircle size={20} className="spin" /> Đang tải thông tin người dùng...
                </div>
            </div>
        );
    }

    return (
        <>
        <main className="app-shell">
            <div className="page-container" style={{ display: 'grid', gap: 14, paddingBottom: 'calc(96px + env(safe-area-inset-bottom, 0px))' }}>
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleAvatarFileChange} style={{ display: 'none' }} />
                <AvatarPreviewModal
                    isOpen={isAvatarPreviewOpen}
                    imageSrc={user?.avatarUrl}
                    displayName={user?.displayName || user?.username || 'Người dùng'}
                    onClose={() => setIsAvatarPreviewOpen(false)}
                    onPickNewImage={openAvatarPicker}
                />
                <AvatarCropModal
                    isOpen={Boolean(cropImageUrl)}
                    imageSrc={cropImageUrl}
                    onClose={closeCropModal}
                    onConfirm={handleAvatarUpload}
                    isSubmitting={isAvatarUploading}
                />
                <AppCard strong style={{ padding: 16, display: 'grid', gap: 12 }}>
                    <div>
                        <div style={{ color: 'var(--muted)', fontSize: 12 }}>Thông tin người dùng</div>
                        <div style={{ fontSize: 20, fontWeight: 900, marginTop: 4 }}>Hồ sơ tài khoản</div>
                    </div>

                    <div style={{ borderRadius: 20, border: '1px solid var(--surface-border)', background: 'linear-gradient(135deg, color-mix(in srgb, var(--theme-gradient-start) 18%, var(--surface-soft)), var(--surface-soft))', padding: 14, display: 'grid', gap: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                            <div style={{ position: 'relative' }}>
                                <UserAvatar src={user?.avatarUrl} alt={user?.displayName || user?.username || 'User avatar'} size={88} radius={28} onClick={() => setIsAvatarPreviewOpen(true)} />
                                <button
                                    type="button"
                                    onClick={openAvatarPicker}
                                    style={{
                                        position: 'absolute',
                                        right: -4,
                                        bottom: -4,
                                        width: 34,
                                        height: 34,
                                        borderRadius: 12,
                                        border: '1px solid color-mix(in srgb, var(--theme-gradient-start) 56%, var(--border))',
                                        background: 'linear-gradient(135deg, var(--theme-gradient-start), var(--theme-gradient-end))',
                                        color: '#eff6ff',
                                        display: 'grid',
                                        placeItems: 'center',
                                        boxShadow: '0 10px 30px rgba(2, 8, 23, 0.25)',
                                    }}
                                >
                                    <Camera size={16} />
                                </button>
                            </div>
                            <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Ảnh đại diện</div>
                                <div style={{ fontSize: 20, fontWeight: 900, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.displayName || user?.username || 'N/A'}</div>
                                <div style={{ marginTop: 6, color: 'var(--muted)', fontSize: 12.5, lineHeight: 1.5 }}>Nhấn vào ảnh để xem chi tiết hoặc đổi ảnh mới nhé!</div>
                            </div>
                        </div>
                        <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>Tài khoản: <span style={{ color: 'var(--foreground)', fontWeight: 700 }}>{user?.username || 'N/A'}</span></div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                            <button
                                type="button"
                                onClick={() => setIsAvatarPreviewOpen(true)}
                                style={{
                                    minHeight: 42,
                                    borderRadius: 14,
                                    border: '1px solid var(--border)',
                                    background: 'var(--surface-strong)',
                                    color: 'var(--foreground)',
                                    fontWeight: 700,
                                }}
                            >
                                Xem ảnh
                            </button>
                            <button
                                type="button"
                                onClick={openAvatarPicker}
                                style={{
                                    minHeight: 42,
                                    borderRadius: 14,
                                    border: '1px solid var(--chip-border)',
                                    background: 'var(--chip-bg)',
                                    color: 'var(--foreground)',
                                    fontWeight: 800,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 8,
                                }}
                            >
                                <ImageUp size={16} />
                                Đổi ảnh đại diện
                            </button>
                        </div>
                    </div>

                    <div style={{ borderRadius: 14, border: '1px solid var(--surface-border)', background: 'var(--surface-soft)', padding: '12px 14px', display: 'grid', gap: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <UserRound size={16} color="var(--accent)" />
                            <span style={{ fontSize: 12, color: 'var(--muted)' }}>Tên hiển thị</span>
                        </div>

                        <input
                            type="text"
                            value={displayName}
                            onChange={(event) => setDisplayName(event.target.value)}
                            placeholder="Nhập tên hiển thị"
                            style={{
                                width: '100%',
                                borderRadius: 10,
                                border: '1px solid var(--surface-border)',
                                background: 'var(--surface-strong)',
                                color: 'var(--foreground)',
                                minHeight: 42,
                                padding: '0 12px',
                                fontSize: 14,
                            }}
                        />
                    </div>

                    <div style={{ borderRadius: 14, border: '1px solid var(--surface-border)', background: 'var(--surface-soft)', padding: '12px 14px', display: 'grid', gap: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <MessageCircle size={16} color="var(--accent)" />
                            <span style={{ fontSize: 12, color: 'var(--muted)' }}>Telegram chat id</span>
                            {hasTelegramId ? <CheckCircle2 size={14} color="#16a34a" /> : null}
                        </div>

                        <input
                            type="text"
                            value={telegramChatId}
                            onChange={(event) => setTelegramChatId(event.target.value)}
                            placeholder="Nhập telegram chat id"
                            style={{
                                width: '100%',
                                borderRadius: 10,
                                border: '1px solid var(--surface-border)',
                                background: 'var(--surface-strong)',
                                color: 'var(--foreground)',
                                minHeight: 42,
                                padding: '0 12px',
                                fontSize: 14,
                            }}
                        />

                        {errorMessage ? (
                            <div style={{ color: '#ef4444', fontSize: 12 }}>{errorMessage}</div>
                        ) : null}
                        {successMessage ? (
                            <div style={{ color: '#16a34a', fontSize: 12 }}>{successMessage}</div>
                        ) : null}

                        <PrimaryButton onClick={handleSaveProfile} disabled={isSubmitting} style={{ justifyContent: 'center' }}>
                            {isSubmitting ? <LoaderCircle size={16} className="spin" /> : <CheckCircle2 size={16} />}
                            {isSubmitting ? 'Đang lưu...' : 'Lưu hồ sơ'}
                        </PrimaryButton>
                    </div>
                </AppCard>

                <AppCard strong style={{ padding: 16, display: 'grid', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <WalletCards size={17} color="var(--accent)" />
                            <span style={{ fontWeight: 800 }}>Ví của bạn</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontWeight: 800, color: 'var(--accent-text)', whiteSpace: 'nowrap', letterSpacing: isBalanceVisible ? undefined : '0.06em' }}>
                                {isBalanceVisible ? formatCurrencyVND(totalWalletBalance) : '•••••••••'}
                            </span>
                            <button
                                type="button"
                                onClick={toggleBalance}
                                style={{
                                    width: 30,
                                    height: 30,
                                    borderRadius: 8,
                                    border: '1px solid var(--surface-border)',
                                    background: 'var(--surface-soft)',
                                    color: 'var(--muted)',
                                    display: 'grid',
                                    placeItems: 'center',
                                    flexShrink: 0,
                                }}
                            >
                                {isBalanceVisible ? <Eye size={14} /> : <EyeOff size={14} />}
                            </button>
                        </div>
                    </div>

                    <div style={{ borderRadius: 12, border: '1px solid var(--surface-border)', background: 'var(--surface-soft)', padding: '10px 12px', display: 'grid', gap: 8 }}>
                        <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>Thêm ví mới</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 8 }}>
                            <input
                                type="text"
                                value={walletName}
                                onChange={(event) => setWalletName(event.target.value)}
                                placeholder="Tên ví"
                                style={{
                                    width: '100%',
                                    borderRadius: 10,
                                    border: '1px solid var(--surface-border)',
                                    background: 'var(--surface-strong)',
                                    color: 'var(--foreground)',
                                    minHeight: 40,
                                    padding: '0 10px',
                                    fontSize: 13.5,
                                }}
                            />
                            <CustomSelect
                                value={walletType}
                                onChange={setWalletType}
                                options={[
                                    { value: 'custom', label: 'Tuỳ chọn' },
                                    { value: 'cash', label: 'Tiền mặt' },
                                    { value: 'bank', label: 'Ngân hàng' },
                                    { value: 'momo', label: 'Momo' },
                                ]}
                                placeholder="Loại ví"
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 8 }}>
                            <input
                                type="text"
                                inputMode="numeric"
                                value={walletBalance ? new Intl.NumberFormat('vi-VN').format(Number(walletBalance.replace(/\D/g, '') || 0)) : ''}
                                onChange={(event) => setWalletBalance(event.target.value.replace(/\D/g, ''))}
                                placeholder="Số dư ban đầu"
                                style={{
                                    width: '100%',
                                    borderRadius: 10,
                                    border: '1px solid var(--surface-border)',
                                    background: 'var(--surface-strong)',
                                    color: 'var(--foreground)',
                                    minHeight: 40,
                                    padding: '0 10px',
                                    fontSize: 13.5,
                                }}
                            />
                            <PrimaryButton onClick={handleCreateWallet} disabled={isCreatingWallet} style={{ justifyContent: 'center' }}>
                                {isCreatingWallet ? 'Đang thêm...' : 'Thêm ví'}
                            </PrimaryButton>
                        </div>

                        {walletErrorMessage ? (
                            <div style={{ color: '#ef4444', fontSize: 12 }}>{walletErrorMessage}</div>
                        ) : null}
                        {walletSuccessMessage ? (
                            <div style={{ color: '#16a34a', fontSize: 12 }}>{walletSuccessMessage}</div>
                        ) : null}
                    </div>

                    {wallets.length === 0 ? (
                        <div style={{ color: 'var(--muted)', fontSize: 12.5 }}>Chưa có ví nào.</div>
                    ) : (
                        <div style={{ display: 'grid', gap: 8 }}>
                            {wallets.map((wallet, walletIndex) => {
                                const isExpanded = expandedWalletId === wallet.id;
                                const logs = walletLogsMap[wallet.id];
                                const isLoadingLogs = isLoadingLogsFor === wallet.id;
                                const isHovered = hoveredWalletId === wallet.id;
                                const isDragOver = dragOverWalletIndex === walletIndex;
                                const isDragging = draggingWalletIndex === walletIndex;
                                return (
                                <div
                                    key={wallet.id}
                                    draggable
                                    onDragStart={() => handleWalletDragStart(walletIndex)}
                                    onDragOver={(event) => {
                                        event.preventDefault();
                                        handleWalletDragOver(walletIndex);
                                    }}
                                    onDrop={(event) => {
                                        event.preventDefault();
                                        void handleWalletDrop(walletIndex);
                                    }}
                                    onDragEnd={handleWalletDragEnd}
                                    onMouseEnter={() => setHoveredWalletId(wallet.id)}
                                    onMouseLeave={() => setHoveredWalletId((currentId) => (currentId === wallet.id ? null : currentId))}
                                    style={{
                                        borderRadius: 12,
                                        border: isDragOver
                                            ? '1px dashed var(--accent)'
                                            : (isExpanded || isHovered ? '1px solid var(--chip-border)' : '1px solid var(--surface-border)'),
                                        background: 'var(--surface-soft)',
                                        overflow: 'hidden',
                                        opacity: wallet.isActive === false ? 0.55 : 1,
                                        boxShadow: isExpanded || isHovered ? '0 10px 24px rgba(15, 23, 42, 0.08)' : 'none',
                                        transition: 'border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease',
                                        transform: isDragging
                                            ? 'scale(0.99)'
                                            : (isHovered && !isExpanded ? 'translateY(-1px)' : 'translateY(0)'),
                                    }}
                                >
                                    <div
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => handleToggleWalletHistory(wallet.id)}
                                        onKeyDown={(event) => {
                                            if (event.key === 'Enter' || event.key === ' ') {
                                                event.preventDefault();
                                                handleToggleWalletHistory(wallet.id);
                                            }
                                        }}
                                        style={{
                                            padding: '10px 12px',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            gap: 10,
                                            cursor: 'pointer',
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <span
                                                title="Kéo để sắp xếp"
                                                onClick={(event) => event.stopPropagation()}
                                                style={{
                                                    width: 24,
                                                    height: 24,
                                                    borderRadius: 6,
                                                    border: '1px solid var(--surface-border)',
                                                    color: 'var(--muted)',
                                                    display: 'grid',
                                                    placeItems: 'center',
                                                    cursor: 'grab',
                                                    flexShrink: 0,
                                                }}
                                            >
                                                <GripVertical size={13} />
                                            </span>
                                            <div>
                                                <div style={{ fontWeight: 700, fontSize: 13.5 }}>{wallet.name}</div>
                                                <div style={{ fontSize: 11.5, color: 'var(--muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    {wallet.type}
                                                    {wallet.isActive === false && (
                                                        <span style={{ color: '#ef4444', fontWeight: 700, textTransform: 'none' }}>· Không dùng</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <div style={{ fontWeight: 800, fontSize: 13.5, letterSpacing: isBalanceVisible ? undefined : '0.06em' }}>{isBalanceVisible ? formatCurrencyVND(wallet.balance) : '•••••••'}</div>
                                            <button
                                                type="button"
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    handleToggleWalletHistory(wallet.id);
                                                }}
                                                title="Lịch sử ví"
                                                style={{
                                                    width: 30,
                                                    height: 30,
                                                    borderRadius: 8,
                                                    border: isExpanded ? '1px solid var(--chip-border)' : '1px solid var(--surface-border)',
                                                    background: isExpanded ? 'var(--chip-bg)' : 'transparent',
                                                    color: isExpanded ? 'var(--accent)' : 'var(--muted)',
                                                    display: 'grid',
                                                    placeItems: 'center',
                                                }}
                                            >
                                                {isExpanded ? <ChevronUp size={14} /> : <History size={14} />}
                                            </button>
                                            <button
                                                type="button"
                                                disabled={togglingWalletId === wallet.id}
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    void handleToggleWalletActive(wallet.id, wallet.isActive !== false);
                                                }}
                                                title={wallet.isActive === false ? 'Bật sử dụng ví' : 'Tắt sử dụng ví'}
                                                style={{
                                                    width: 44,
                                                    height: 26,
                                                    borderRadius: 999,
                                                    border: wallet.isActive === false
                                                        ? '1px solid var(--surface-border)'
                                                        : '1px solid color-mix(in srgb, var(--theme-gradient-start) 65%, var(--surface-border))',
                                                    background: wallet.isActive === false
                                                        ? 'var(--surface-strong)'
                                                        : 'color-mix(in srgb, var(--theme-gradient-start) 32%, var(--surface-soft))',
                                                    padding: 2,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: wallet.isActive === false ? 'flex-start' : 'flex-end',
                                                    transition: 'all 180ms ease',
                                                    opacity: togglingWalletId === wallet.id ? 0.6 : 1,
                                                }}
                                            >
                                                <span
                                                    style={{
                                                        width: 20,
                                                        height: 20,
                                                        borderRadius: 999,
                                                        background: wallet.isActive === false ? 'var(--muted)' : 'var(--theme-gradient-start)',
                                                        boxShadow: wallet.isActive === false
                                                            ? 'none'
                                                            : '0 0 0 2px color-mix(in srgb, var(--theme-gradient-start) 18%, transparent)',
                                                        transition: 'all 180ms ease',
                                                    }}
                                                />
                                            </button>
                                        </div>
                                    </div>

                                    {isExpanded ? (
                                        <div
                                            style={{
                                                borderTop: '1px solid var(--surface-border)',
                                                padding: '10px 12px',
                                                display: 'grid',
                                                gap: 8,
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--muted)', fontWeight: 700 }}>
                                                <History size={12} />
                                                Lịch sử biến động số dư
                                            </div>

                                            {isLoadingLogs ? (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--muted)', fontSize: 12 }}>
                                                    <LoaderCircle size={12} className="spin" /> Đang tải...
                                                </div>
                                            ) : null}

                                            {!isLoadingLogs && logs && logs.items.length === 0 ? (
                                                <div style={{ color: 'var(--muted)', fontSize: 12 }}>Chưa có lịch sử biến động.</div>
                                            ) : null}

                                            {logs && logs.items.length > 0 ? (
                                                <div style={{ display: 'grid', gap: 6 }}>
                                                    {logs.items.map((log: IWalletLogItem) => {
                                                        const isCredit = log.action === 'credit';
                                                        const actionLabel =
                                                            log.action === 'credit' ? '+ Thu vào'
                                                            : log.action === 'debit' ? '- Chi ra'
                                                            : log.action === 'create' ? 'Khởi tạo'
                                                            : log.action;
                                                        return (
                                                            <div
                                                                key={log.id}
                                                                style={{
                                                                    borderRadius: 9,
                                                                    border: '1px solid var(--surface-border)',
                                                                    background: 'var(--surface-base)',
                                                                    padding: '8px 10px',
                                                                    display: 'grid',
                                                                    gap: 3,
                                                                }}
                                                            >
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                                                                    <span style={{ fontSize: 12, fontWeight: 700, color: isCredit ? '#16a34a' : '#f97316' }}>
                                                                        {actionLabel} {isBalanceVisible ? formatCurrencyVND(log.amount) : '•••••'}
                                                                    </span>
                                                                    <span style={{ fontSize: 10.5, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                                                                        {new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(log.createdAt))}
                                                                    </span>
                                                                </div>
                                                                <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                                                                    {isBalanceVisible
                                                                        ? `${formatCurrencyVND(log.balanceBefore)} → ${formatCurrencyVND(log.balanceAfter)}`
                                                                        : '••••• → •••••'}
                                                                    {log.description ? <span> · {log.description}</span> : null}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            ) : null}

                                            {logs && logs.total > logs.items.length ? (
                                                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                                    <button
                                                        type="button"
                                                        onClick={() => router.push(`/dashboard?tab=wallets&view=drawer&walletId=${encodeURIComponent(wallet.id)}`)}
                                                        style={{
                                                            border: 'none',
                                                            background: 'transparent',
                                                            color: 'var(--accent)',
                                                            fontSize: 11.5,
                                                            fontWeight: 800,
                                                            padding: 0,
                                                            cursor: 'pointer',
                                                        }}
                                                    >
                                                        Xem thêm -&gt;
                                                    </button>
                                                </div>
                                            ) : null}
                                        </div>
                                    ) : null}
                                </div>
                                );
                            })}
                        </div>
                    )}
                </AppCard>
            </div>
        </main>
        <BottomNav activeTab="menu" onSelect={handleNavSelect} />
    </>
    );
}
