'use client';

import { MoonStar, Palette, ShieldCheck, SunMedium, UserRound, WalletCards, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { AppCard } from '@/components/common/app-card';
import { formatCurrencyVND } from '@/lib/formatters';
import { useLockBodyScroll } from '@/lib/ui/use-lock-body-scroll';
import { useTheme } from '@/providers/theme-provider';
import { IUserSession } from '@/types/auth';
import { IWalletItem } from '@/types/calendar';

interface ISideDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    user: IUserSession | null;
    totalWalletBalance: number;
    wallets: IWalletItem[];
}

export function SideDrawer({ isOpen, onClose, user, totalWalletBalance, wallets }: ISideDrawerProps) {
    const router = useRouter();
    const { theme, toggleTheme } = useTheme();
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

                <AppCard style={{ padding: 18, display: 'grid', gap: 14, overflowY: 'auto' }} strong>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div
                            style={{
                                width: 56,
                                height: 56,
                                borderRadius: 18,
                                display: 'grid',
                                placeItems: 'center',
                                background: 'linear-gradient(135deg, var(--chip-bg), rgba(255,255,255,0.08))',
                            }}
                        >
                            <UserRound size={26} color="var(--accent-text)" />
                        </div>
                        <div>
                            <div style={{ fontSize: 18, fontWeight: 800 }}>{user?.username ?? 'Guest'}</div>
                            <div style={{ color: 'var(--muted)', textTransform: 'capitalize', fontSize: 13 }}>{user?.role ?? 'user'}</div>
                        </div>
                    </div>

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
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#dbeafe' }}>
                            <WalletCards size={18} />
                            <span style={{ fontSize: 12, fontWeight: 700 }}>Tổng số dư ví</span>
                        </div>
                        <div style={{ fontSize: 28, lineHeight: 1.1, fontWeight: 900 }}>{formatCurrencyVND(totalWalletBalance)}</div>
                        <div style={{ fontSize: 12, color: 'rgba(239,246,255,0.85)' }}>Tiết kiệm là thượng sách để có tất cả</div>
                    </div>

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
                            <div style={{ fontWeight: 700, fontSize: 14 }}>Thông tin user</div>
                            <div style={{ color: 'var(--muted)', fontSize: 12.5 }}>Xem chi tiết thông tin của bạn, ví,...</div>
                        </div>
                        <UserRound size={18} color="var(--accent)" />
                    </button>

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
                            <div style={{ color: 'var(--muted)', fontSize: 12.5 }}></div>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gap: 10 }}>
                        <div style={{ fontWeight: 700, fontSize: 13.5 }}>Các ví hiện có</div>
                        {wallets.length === 0 ? (
                            <div style={{ color: 'var(--muted)', fontSize: 12.5 }}>Chưa có ví nào để hiển thị.</div>
                        ) : (
                            wallets.map((wallet) => (
                                <div
                                    key={wallet.id}
                                    style={{
                                        borderRadius: 14,
                                        padding: '12px 14px',
                                        background: 'var(--surface-soft)',
                                        border: '1px solid var(--border)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        gap: 10,
                                    }}
                                >
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: 13.5 }}>{wallet.name}</div>
                                        <div style={{ color: 'var(--muted)', fontSize: 11.5, textTransform: 'uppercase' }}>{wallet.type}</div>
                                    </div>
                                    <div style={{ fontWeight: 800, fontSize: 13.5 }}>{formatCurrencyVND(wallet.balance)}</div>
                                </div>
                            ))
                        )}
                    </div>

                    <button
                        onClick={toggleTheme}
                        style={{
                            borderRadius: 16,
                            padding: '14px 16px',
                            background: 'var(--surface-soft)',
                            border: '1px solid var(--border)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 12,
                            color: 'var(--foreground)',
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <Palette size={18} color="var(--accent)" />
                            <div style={{ textAlign: 'left' }}>
                                <div style={{ fontWeight: 700, fontSize: 14 }}>Đổi giao diện</div>
                                <div style={{ color: 'var(--muted)', fontSize: 12.5 }}>
                                    {theme === 'dark' ? 'Chuyển sang light pastel hồng' : 'Chuyển sang dark công nghệ'}
                                </div>
                            </div>
                        </div>
                        {theme === 'dark' ? <SunMedium size={18} color="var(--accent-text)" /> : <MoonStar size={18} color="var(--accent-text)" />}
                    </button>
                </AppCard>
            </aside>
        </>
    );
}
