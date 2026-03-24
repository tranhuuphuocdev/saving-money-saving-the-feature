'use client';

import { CheckCircle2, LoaderCircle, MessageCircle, UserRound, WalletCards } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppCard } from '@/components/common/app-card';
import { PrimaryButton } from '@/components/common/primary-button';
import { formatCurrencyVND } from '@/lib/formatters';
import { useAuth } from '@/providers/auth-provider';

export function ProfileShell() {
    const router = useRouter();
    const { user, wallets, totalWalletBalance, isAuthenticated, isLoading, updateTelegramChatId, refreshProfile, createWallet } = useAuth();

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

    const hasTelegramId = useMemo(() => Boolean((user?.telegramChatId || '').trim()), [user?.telegramChatId]);

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
        <main className="app-shell">
            <div className="page-container" style={{ display: 'grid', gap: 14, paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))' }}>
                <AppCard strong style={{ padding: 16, display: 'grid', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                        <div>
                            <div style={{ color: 'var(--muted)', fontSize: 12 }}>Thông tin người dùng</div>
                            <div style={{ fontSize: 20, fontWeight: 900, marginTop: 4 }}>Hồ sơ tài khoản</div>
                        </div>
                        <button
                            type="button"
                            onClick={() => router.push('/dashboard')}
                            style={{
                                minHeight: 34,
                                padding: '0 12px',
                                borderRadius: 10,
                                border: '1px solid var(--border)',
                                background: 'var(--surface-soft)',
                                color: 'var(--foreground)',
                                fontWeight: 700,
                            }}
                        >
                            Quay lại
                        </button>
                    </div>

                    <div style={{ borderRadius: 14, border: '1px solid var(--surface-border)', background: 'var(--surface-soft)', padding: '12px 14px', display: 'grid', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 18, height: 18, borderRadius: 999, overflow: 'hidden', border: '1px solid var(--chip-border)', flexShrink: 0 }}>
                                <img src="/icon.svg" alt="User avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            </div>
                            <span style={{ fontSize: 12, color: 'var(--muted)' }}>Display name</span>
                            <span style={{ fontWeight: 800 }}>{user?.displayName || user?.username || 'N/A'}</span>
                        </div>
                        <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>Username: <span style={{ color: 'var(--foreground)', fontWeight: 700 }}>{user?.username || 'N/A'}</span></div>
                        <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>Role: <span style={{ color: 'var(--foreground)', fontWeight: 700 }}>{user?.role || 'user'}</span></div>
                    </div>

                    <div style={{ borderRadius: 14, border: '1px solid var(--surface-border)', background: 'var(--surface-soft)', padding: '12px 14px', display: 'grid', gap: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <UserRound size={16} color="var(--accent)" />
                            <span style={{ fontSize: 12, color: 'var(--muted)' }}>Display name</span>
                        </div>

                        <input
                            type="text"
                            value={displayName}
                            onChange={(event) => setDisplayName(event.target.value)}
                            placeholder="Nhập display name"
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
                        <span style={{ fontWeight: 800, color: 'var(--accent-text)', whiteSpace: 'nowrap' }}>{formatCurrencyVND(totalWalletBalance)}</span>
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
                            <select
                                value={walletType}
                                onChange={(event) => setWalletType(event.target.value)}
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
                            >
                                <option value="custom">Tuỳ chọn</option>
                                <option value="cash">Tiền mặt</option>
                                <option value="bank">Ngân hàng</option>
                                <option value="momo">Momo</option>
                            </select>
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
                            {wallets.map((wallet) => (
                                <div
                                    key={wallet.id}
                                    style={{
                                        borderRadius: 12,
                                        border: '1px solid var(--surface-border)',
                                        background: 'var(--surface-soft)',
                                        padding: '10px 12px',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        gap: 10,
                                    }}
                                >
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: 13.5 }}>{wallet.name}</div>
                                        <div style={{ fontSize: 11.5, color: 'var(--muted)', textTransform: 'uppercase' }}>{wallet.type}</div>
                                    </div>
                                    <div style={{ fontWeight: 800, fontSize: 13.5 }}>{formatCurrencyVND(wallet.balance)}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </AppCard>
            </div>
        </main>
    );
}
