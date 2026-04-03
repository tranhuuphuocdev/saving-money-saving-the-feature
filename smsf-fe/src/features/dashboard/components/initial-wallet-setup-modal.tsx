'use client';

import { LoaderCircle, WalletCards } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AppCard } from '@/components/common/app-card';
import { PrimaryButton } from '@/components/common/primary-button';
import { IWalletItem } from '@/types/calendar';

interface IInitialWalletSetupModalProps {
    isOpen: boolean;
    wallets: IWalletItem[];
    isSubmitting: boolean;
    errorMessage: string;
    onSubmit: (payload: { wallets: Array<{ walletId: string; balance: number }> }) => Promise<void>;
}

export function InitialWalletSetupModal({ isOpen, wallets, isSubmitting, errorMessage, onSubmit }: IInitialWalletSetupModalProps) {
    const [balances, setBalances] = useState<Record<string, string>>({});

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        setBalances(
            wallets.reduce<Record<string, string>>((acc, wallet) => {
                acc[wallet.id] = String(Math.max(0, wallet.balance || 0));
                return acc;
            }, {}),
        );
    }, [isOpen, wallets]);

    const formattedTotal = useMemo(() => {
        const total = wallets.reduce((sum, wallet) => sum + Number(balances[wallet.id] || 0), 0);
        return new Intl.NumberFormat('vi-VN').format(total);
    }, [balances, wallets]);

    if (!isOpen) {
        return null;
    }

    async function handleSubmit() {
        await onSubmit({
            wallets: wallets.map((wallet) => ({
                walletId: wallet.id,
                balance: Number(balances[wallet.id] || 0),
            })),
        });
    }

    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 90,
                background: 'rgba(2, 6, 23, 0.74)',
                backdropFilter: 'blur(8px)',
                display: 'grid',
                placeItems: 'center',
                padding: 16,
            }}
        >
            <AppCard strong style={{ width: 'min(100%, 520px)', padding: 20, display: 'grid', gap: 16 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <div
                        style={{
                            width: 44,
                            height: 44,
                            borderRadius: 14,
                            display: 'grid',
                            placeItems: 'center',
                            background: 'var(--chip-bg)',
                            border: '1px solid var(--chip-border)',
                            color: 'var(--accent)',
                            flexShrink: 0,
                        }}
                    >
                        <WalletCards size={20} />
                    </div>
                    <div>
                        <div style={{ fontSize: 20, fontWeight: 900 }}>Thiết lập số dư khởi tạo</div>
                        <div style={{ marginTop: 6, color: 'var(--muted)', fontSize: 13.5, lineHeight: 1.6 }}>
                            Trước khi vào ứng dụng, hãy nhập số tiền ban đầu cho từng ví. Bạn có thể nhập 0 nếu ví hiện chưa có tiền.
                        </div>
                    </div>
                </div>

                <div style={{ borderRadius: 14, padding: '12px 14px', background: 'var(--surface-soft)', border: '1px solid var(--surface-border)', display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                    <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>Tổng số dư khởi tạo</span>
                    <span style={{ fontSize: 18, fontWeight: 900 }}>{formattedTotal} VND</span>
                </div>

                <div style={{ display: 'grid', gap: 10 }}>
                    {wallets.map((wallet) => (
                        <div key={wallet.id} style={{ borderRadius: 14, border: '1px solid var(--surface-border)', background: 'var(--surface-soft)', padding: '12px 14px', display: 'grid', gap: 8 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                                <div>
                                    <div style={{ fontWeight: 800 }}>{wallet.name}</div>
                                    <div style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase' }}>{wallet.type}</div>
                                </div>
                                <span style={{ fontSize: 11.5, color: 'var(--accent-text)', fontWeight: 700 }}>Bắt buộc</span>
                            </div>
                            <input
                                type="text"
                                inputMode="numeric"
                                value={balances[wallet.id] ? new Intl.NumberFormat('vi-VN').format(Number(balances[wallet.id] || 0)) : ''}
                                onChange={(event) => {
                                    const nextValue = event.target.value.replace(/\D/g, '');
                                    setBalances((current) => ({
                                        ...current,
                                        [wallet.id]: nextValue,
                                    }));
                                }}
                                placeholder="Nhập số dư ban đầu"
                                style={{
                                    width: '100%',
                                    borderRadius: 12,
                                    border: '1px solid var(--surface-border)',
                                    background: 'var(--surface-strong)',
                                    color: 'var(--foreground)',
                                    minHeight: 44,
                                    padding: '0 12px',
                                    fontSize: 14,
                                }}
                            />
                        </div>
                    ))}
                </div>

                {errorMessage ? <div style={{ color: '#ef4444', fontSize: 12.5 }}>{errorMessage}</div> : null}

                <PrimaryButton onClick={() => void handleSubmit()} disabled={isSubmitting} style={{ justifyContent: 'center' }}>
                    {isSubmitting ? <LoaderCircle size={16} className="spin" /> : null}
                    {isSubmitting ? 'Đang lưu số dư khởi tạo...' : 'Hoàn tất thiết lập ví'}
                </PrimaryButton>
            </AppCard>
        </div>
    );
}