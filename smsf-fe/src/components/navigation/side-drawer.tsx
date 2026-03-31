'use client';

import { Eye, EyeOff, History, LogOut, ShieldCheck, UserRound, WalletCards, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { AppCard } from '@/components/common/app-card';
import { UserAvatar } from '@/components/common/user-avatar';
import { formatCurrencyVND } from '@/lib/formatters';
import { useBalanceVisible } from '@/lib/ui/use-balance-visible';
import { useLockBodyScroll } from '@/lib/ui/use-lock-body-scroll';
import { IUserSession } from '@/types/auth';
import { IWalletItem } from '@/types/calendar';

interface ISideDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    onLogout: () => void;
    onOpenWalletHistory: () => void;
    user: IUserSession | null;
    totalWalletBalance: number;
    wallets: IWalletItem[];
}

export function SideDrawer({ isOpen, onClose, onLogout, onOpenWalletHistory, user, totalWalletBalance }: ISideDrawerProps) {
    const router = useRouter();
    const { isVisible, toggle: toggleBalance } = useBalanceVisible();
    useLockBodyScroll(isOpen);

    return (
        <>
            <div
                onClick={onClose}
                style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(2, 8, 23, 0.55)',
                    backdropFilter: 'blur(4px)',
                    opacity: isOpen ? 1 : 0,
                    pointerEvents: isOpen ? 'auto' : 'none',
                    transition: 'opacity 0.22s ease',
                    zIndex: 40,
                }}
            />
            <aside
                style={{
                    position: 'fixed',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    height: '100dvh',
                    width: 'min(86vw, 360px)',
                    padding: 18,
                    background: 'var(--surface-strong)',
                    borderRight: '1px solid var(--border)',
                    transform: isOpen ? 'translateX(0)' : 'translateX(-104%)',
                    transition: 'transform 0.28s ease',
                    zIndex: 50,
                    boxShadow: '0 24px 80px rgba(0,0,0,0.35)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 16,
                    overflow: 'hidden',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <div style={{ fontSize: 12, color: 'var(--muted)' }}>Thông tin tài khoản</div>
                        <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>SMSF Wallet</div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            width: 40,
                            height: 40,
                            borderRadius: 12,
                            border: '1px solid var(--border)',
                            background: 'var(--surface-soft)',
                            color: 'var(--foreground)',
                        }}
                    >
                        <X size={18} />
                    </button>
                </div>

                <AppCard style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14, flex: 1, minHeight: 0, overflow: 'hidden' }} strong>
                    {/* User info */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <UserAvatar src={user?.avatarUrl} alt={user?.displayName || user?.username || 'User avatar'} size={56} radius={18} onClick={() => {
                            onClose();
                            router.push('/profile');
                        }} />
                        <div>
                            <div style={{ fontSize: 18, fontWeight: 800 }}>{user?.displayName || user?.username || 'Guest'}</div>
                            <div style={{ color: 'var(--muted)', textTransform: 'capitalize', fontSize: 13 }}>{user?.role ?? 'user'}</div>
                        </div>
                    </div>

                    {/* Balance panel */}
                    <div
                        style={{
                            borderRadius: 20,
                            padding: 16,
                            background: 'linear-gradient(135deg, var(--theme-panel-gradient-start), var(--theme-panel-gradient-end))',
                            border: '1px solid var(--chip-border)',
                            display: 'grid',
                            gap: 8,
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#dbeafe' }}>
                                <WalletCards size={18} />
                                <span style={{ fontSize: 12, fontWeight: 700 }}>Tổng số dư ví</span>
                            </div>
                            <button
                                type="button"
                                onClick={toggleBalance}
                                style={{
                                    padding: '3px 8px',
                                    borderRadius: 999,
                                    border: '1px solid rgba(219,234,254,0.25)',
                                    background: 'rgba(219,234,254,0.12)',
                                    color: '#dbeafe',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    fontSize: 11,
                                    fontWeight: 700,
                                }}
                            >
                                {isVisible ? <Eye size={13} /> : <EyeOff size={13} />}
                                {isVisible ? 'Ẩn' : 'Hiện'}
                            </button>
                        </div>
                        <div style={{ fontSize: 'clamp(18px, 6vw, 28px)', lineHeight: 1.1, fontWeight: 900, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: isVisible ? undefined : '0.06em' }}>
                            {isVisible ? formatCurrencyVND(totalWalletBalance) : '•••••••••'}
                        </div>
                        <div style={{ fontSize: 12, color: 'rgba(239,246,255,0.85)' }}>Tiết kiệm là thượng sách để có tất cả</div>
                    </div>

                    {/* Profile link */}
                    <button
                        onClick={() => {
                            onClose();
                            router.push('/profile');
                        }}
                        style={{
                            borderRadius: 16,
                            padding: '12px 14px',
                            background: 'var(--surface-soft)',
                            border: '1px solid var(--border)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 10,
                            color: 'var(--foreground)',
                        }}
                    >
                        <div style={{ textAlign: 'left' }}>
                            <div style={{ fontWeight: 700, fontSize: 14 }}>Thông tin người dùng</div>
                            <div style={{ color: 'var(--muted)', fontSize: 12.5 }}>Xem chi tiết thông tin của bạn, ví,...</div>
                        </div>
                        <UserRound size={18} color="var(--accent)" />
                    </button>

                    <button
                        onClick={() => {
                            onClose();
                            onOpenWalletHistory();
                        }}
                        style={{
                            borderRadius: 16,
                            padding: '12px 14px',
                            background: 'var(--surface-soft)',
                            border: '1px solid var(--border)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 10,
                            color: 'var(--foreground)',
                        }}
                    >
                        <div style={{ textAlign: 'left' }}>
                            <div style={{ fontWeight: 700, fontSize: 14 }}>Lịch sử ví</div>
                            <div style={{ color: 'var(--muted)', fontSize: 12.5 }}>Xem biến động số dư.</div>
                        </div>
                        <History size={18} color="var(--accent)" />
                    </button>

                    {/* Safe session badge */}
                    <div
                        style={{
                            borderRadius: 16,
                            padding: '14px 16px',
                            background: 'var(--surface-soft)',
                            border: '1px solid var(--border)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                        }}
                    >
                        <ShieldCheck size={18} color="var(--accent)" />
                        <div>
                            <div style={{ fontWeight: 700, fontSize: 14 }}>Phiên đăng nhập an toàn</div>
                        </div>
                    </div>

                    {/* Placeholder — space reserved for future features */}
                    <div style={{ flex: 1 }} />

                    {/* Logout — compact, anchored to bottom */}
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <button
                            onClick={() => {
                                onClose();
                                onLogout();
                            }}
                            style={{
                                borderRadius: 999,
                                padding: '10px 28px',
                                background: 'color-mix(in srgb, var(--danger) 14%, var(--surface-soft))',
                                border: '1px solid color-mix(in srgb, var(--danger) 48%, var(--border))',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                color: 'var(--danger)',
                                fontWeight: 800,
                                fontSize: 14,
                            }}
                        >
                            <LogOut size={16} />
                            Đăng xuất
                        </button>
                    </div>
                </AppCard>
            </aside>
        </>
    );
}
