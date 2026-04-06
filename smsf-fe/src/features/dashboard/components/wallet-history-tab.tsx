'use client';

import { History, LoaderCircle, RotateCw, WalletCards } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppCard } from '@/components/common/app-card';
import { CustomDatePicker } from '@/components/common/custom-date-picker';
import { CustomSelect } from '@/components/common/custom-select';
import { getWalletLogsRequest, IWalletLogItem, IWalletLogPage } from '@/lib/calendar/api';
import { formatCurrencyVND } from '@/lib/formatters';
import { getWalletLogLabel, isWalletLogCredit } from '@/lib/wallet-log-label';
import { useBalanceVisible } from '@/lib/ui/use-balance-visible';
import { IWalletItem } from '@/types/calendar';

interface IWalletHistoryTabProps {
    wallets: IWalletItem[];
    preferredWalletId?: string;
}

const WALLET_LOG_PAGE_SIZE = 10;

const getLogAccent = (action: string): string => {
    if (action === 'create' || action === 'initial-setup') {
        return '#2563eb';
    }

    if (isWalletLogCredit(action)) {
        return '#16a34a';
    }

    return '#f97316';
};

export function WalletHistoryTab({ wallets, preferredWalletId }: IWalletHistoryTabProps) {
    const { isVisible: isBalanceVisible } = useBalanceVisible();
    const [selectedWalletId, setSelectedWalletId] = useState('');
    const [walletLogs, setWalletLogs] = useState<IWalletLogPage | null>(null);
    const [isLoadingLogs, setIsLoadingLogs] = useState(false);
    const [logsError, setLogsError] = useState('');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');

    const sortedWallets = useMemo(
        () => wallets.filter((wallet) => wallet.type !== 'shared-fund'),
        [wallets],
    );

    const selectedWallet = useMemo(
        () => sortedWallets.find((wallet) => wallet.id === selectedWalletId) || null,
        [selectedWalletId, sortedWallets],
    );

    const loadWalletLogs = useCallback(async (walletId: string, page = 1, append = false, fromTimestamp?: number, toTimestamp?: number) => {
        setIsLoadingLogs(true);
        setLogsError('');

        try {
            const data = await getWalletLogsRequest(walletId, page, WALLET_LOG_PAGE_SIZE, fromTimestamp, toTimestamp);
            setWalletLogs((previous) => {
                if (append && previous) {
                    return {
                        ...data,
                        items: [...previous.items, ...data.items],
                    };
                }

                return data;
            });
        } catch {
            setLogsError('Không tải được lịch sử ví. Thử lại sau.');
        } finally {
            setIsLoadingLogs(false);
        }
    }, []);

    useEffect(() => {
        if (preferredWalletId && sortedWallets.some((wallet) => wallet.id === preferredWalletId)) {
            setSelectedWalletId(preferredWalletId);
            return;
        }

        setSelectedWalletId((currentWalletId) => {
            if (currentWalletId && sortedWallets.some((wallet) => wallet.id === currentWalletId)) {
                return currentWalletId;
            }

            return sortedWallets[0]?.id || '';
        });
    }, [preferredWalletId, sortedWallets]);

    const fromTimestamp = fromDate ? new Date(`${fromDate}T00:00:00`).getTime() : undefined;
    const toTimestamp = toDate ? new Date(`${toDate}T23:59:59`).getTime() : undefined;

    useEffect(() => {
        if (!selectedWalletId) {
            setWalletLogs(null);
            return;
        }

        void loadWalletLogs(selectedWalletId, 1, false, fromTimestamp, toTimestamp);
    }, [loadWalletLogs, selectedWalletId, fromDate, toDate]); // eslint-disable-line react-hooks/exhaustive-deps

    if (sortedWallets.length === 0) {
        return (
            <AppCard strong style={{ padding: 16, display: 'grid', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <History size={16} color="var(--accent)" />
                    <span style={{ fontWeight: 800 }}>Lịch sử ví</span>
                </div>
                <div style={{ color: 'var(--muted)', fontSize: 13 }}>Chưa có ví nào để xem lịch sử.</div>
            </AppCard>
        );
    }

    return (
        <AppCard strong style={{ padding: 16, display: 'grid', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <History size={16} color="var(--accent)" />
                        <span style={{ fontSize: 16, fontWeight: 800 }}>Lịch sử ví</span>
                    </div>
                    <div style={{ marginTop: 6, color: 'var(--muted)', lineHeight: 1.65, fontSize: 13 }}>
                        Chọn ví để xem lịch sử.
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                        type="button"
                        disabled={isLoadingLogs || !selectedWalletId}
                        onClick={() => void loadWalletLogs(selectedWalletId, 1, false, fromTimestamp, toTimestamp)}
                        title="Tải lại"
                        style={{
                            width: 36,
                            height: 36,
                            borderRadius: 10,
                            border: '1px solid var(--surface-border)',
                            background: 'transparent',
                            color: 'var(--muted)',
                            display: 'grid',
                            placeItems: 'center',
                            cursor: isLoadingLogs || !selectedWalletId ? 'not-allowed' : 'pointer',
                            opacity: isLoadingLogs || !selectedWalletId ? 0.5 : 1,
                        }}
                    >
                        <RotateCw size={15} />
                    </button>
                    <div style={{ width: 42, height: 42, borderRadius: 14, display: 'grid', placeItems: 'center', background: 'var(--theme-icon-surface)', border: '1px solid var(--theme-icon-border)' }}>
                        <WalletCards size={18} color="var(--accent)" />
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gap: 8 }}>
                <div style={{ fontSize: 11.5, color: 'var(--muted)', fontWeight: 700 }}>
                    Chọn ví
                </div>
                <CustomSelect
                    value={selectedWalletId}
                    onChange={setSelectedWalletId}
                    options={sortedWallets.map((wallet) => ({
                        value: wallet.id,
                        label: `${wallet.name} (${wallet.type})`,
                    }))}
                    placeholder="Chọn ví"
                />
            </div>

            <div style={{ display: 'grid', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: 11.5, color: 'var(--muted)', fontWeight: 700 }}>Lọc theo ngày</div>
                    {(fromDate || toDate) ? (
                        <button
                            type="button"
                            onClick={() => { setFromDate(''); setToDate(''); }}
                            style={{ fontSize: 11.5, color: 'var(--accent)', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                        >
                            Xóa lọc
                        </button>
                    ) : null}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <CustomDatePicker value={fromDate} onChange={setFromDate} placeholder="Từ ngày" zIndex={200} />
                    <CustomDatePicker value={toDate} onChange={setToDate} placeholder="Đến ngày" zIndex={200} />
                </div>
            </div>

            {selectedWallet ? (
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                        borderRadius: 14,
                        padding: '12px 14px',
                        background: 'var(--surface-soft)',
                        border: '1px solid var(--surface-border)',
                    }}
                >
                    <div>
                        <div style={{ fontSize: 14, fontWeight: 800 }}>{selectedWallet.name}</div>
                        <div style={{ color: 'var(--muted)', fontSize: 11.5, textTransform: 'uppercase' }}>{selectedWallet.type}</div>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 900, letterSpacing: isBalanceVisible ? undefined : '0.06em' }}>
                        {isBalanceVisible ? formatCurrencyVND(selectedWallet.balance) : '••••••••'}
                    </div>
                </div>
            ) : null}

            {logsError ? (
                <div style={{ color: '#ef4444', fontSize: 12.5 }}>{logsError}</div>
            ) : null}

            {isLoadingLogs && !walletLogs ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--muted)', fontSize: 13 }}>
                    <LoaderCircle size={16} className="spin" /> Đang tải lịch sử ví...
                </div>
            ) : null}

            {!isLoadingLogs && walletLogs && walletLogs.items.length === 0 ? (
                <div style={{ color: 'var(--muted)', fontSize: 13 }}>Ví này chưa có lịch sử biến động.</div>
            ) : null}

            {walletLogs && walletLogs.items.length > 0 ? (
                <div style={{ display: 'grid', gap: 8 }}>
                    {walletLogs.items.map((log: IWalletLogItem) => (
                        <div
                            key={log.id}
                            style={{
                                borderRadius: 14,
                                border: '1px solid var(--surface-border)',
                                background: 'var(--surface-soft)',
                                padding: '12px 14px',
                                display: 'grid',
                                gap: 6,
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span
                                        style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: 6,
                                            borderRadius: 999,
                                            padding: '4px 8px',
                                            background: 'var(--surface-base)',
                                            border: '1px solid var(--surface-border)',
                                            color: getLogAccent(log.action),
                                            fontSize: 11,
                                            fontWeight: 800,
                                        }}
                                    >
                                        {getWalletLogLabel(log.action)}
                                    </span>
                                    <span style={{ fontSize: 13.5, fontWeight: 800, color: getLogAccent(log.action), letterSpacing: isBalanceVisible ? undefined : '0.06em' }}>
                                        {isBalanceVisible ? formatCurrencyVND(log.amount) : '••••••'}
                                    </span>
                                </div>
                                <span style={{ fontSize: 11.5, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                                    {new Intl.DateTimeFormat('vi-VN', {
                                        day: '2-digit',
                                        month: '2-digit',
                                        year: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                    }).format(new Date(log.createdAt))}
                                </span>
                            </div>

                            <div style={{ fontSize: 13, color: 'var(--foreground)', lineHeight: 1.5 }}>
                                {log.description || 'Không có mô tả.'}
                            </div>

                            <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                                {isBalanceVisible
                                    ? `${formatCurrencyVND(log.balanceBefore)} → ${formatCurrencyVND(log.balanceAfter)}`
                                    : '•••••• → ••••••'}
                            </div>
                        </div>
                    ))}
                </div>
            ) : null}

            {walletLogs?.hasMore ? (
                <button
                    type="button"
                    disabled={isLoadingLogs || !selectedWalletId}
                    onClick={() => void loadWalletLogs(selectedWalletId, (walletLogs.page || 1) + 1, true, fromTimestamp, toTimestamp)}
                    style={{
                        minHeight: 40,
                        borderRadius: 12,
                        border: '1px solid var(--surface-border)',
                        background: 'transparent',
                        color: 'var(--foreground)',
                        fontWeight: 700,
                        fontSize: 13,
                        opacity: isLoadingLogs ? 0.65 : 1,
                    }}
                >
                    {isLoadingLogs ? 'Đang tải...' : 'Xem thêm'}
                </button>
            ) : null}
        </AppCard>
    );
}