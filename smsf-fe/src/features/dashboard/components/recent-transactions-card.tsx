import { AppCard } from '@/components/common/app-card';
import { formatCurrencyVND, formatTimeLabel, formatTransactionTypeLabel } from '@/lib/formatters';
import { IRecentTransaction } from '@/types/dashboard';

interface IRecentTransactionsCardProps {
    transactions: IRecentTransaction[];
}

export function RecentTransactionsCard({ transactions }: IRecentTransactionsCardProps) {
    return (
        <AppCard style={{ padding: 14 }} strong>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
                <div>
                    <div style={{ color: 'var(--muted)', fontSize: 11 }}>Danh sách mới nhất</div>
                    <div style={{ fontSize: 15.5, fontWeight: 800, marginTop: 3 }}>5 giao dịch gần đây</div>
                </div>
            </div>

            <div style={{ display: 'grid', gap: 8 }}>
                {transactions.length === 0 ? (
                    <div style={{ color: 'var(--muted)', fontSize: 13 }}>
                        Chưa có giao dịch gần đây.
                    </div>
                ) : null}
                {transactions.map((transaction) => {
                    const isExpense = transaction.transactionType === 'expense';
                    const typeLabel = formatTransactionTypeLabel(transaction.transactionType);

                    return (
                        <div
                            key={transaction.id}
                            style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr auto',
                                gap: 10,
                                padding: '11px 12px',
                                borderRadius: 14,
                                background: 'var(--surface-soft)',
                                border: '1px solid var(--surface-border)',
                                alignItems: 'start',
                            }}
                        >
                            <div style={{ minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                    <span style={{ fontWeight: 800, fontSize: 12.5 }}>{transaction.category}</span>
                                    <span
                                        style={{
                                            padding: '3px 7px',
                                            borderRadius: 999,
                                            fontSize: 10,
                                            fontWeight: 800,
                                            color: isExpense ? '#b91c1c' : '#166534',
                                            background: isExpense ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.12)',
                                        }}
                                    >
                                        {typeLabel}
                                    </span>
                                </div>
                                {transaction.description ? (
                                    <div style={{ marginTop: 3, fontSize: 11, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {transaction.description}
                                    </div>
                                ) : null}
                                <div style={{ marginTop: 4, color: 'var(--muted)', fontSize: 11 }}>{formatTimeLabel(transaction.timestamp)}</div>
                            </div>
                            <div style={{ textAlign: 'right', paddingTop: 2 }}>
                                <div style={{ fontWeight: 900, color: isExpense ? '#dc2626' : '#15803d', fontSize: 12.5 }}>
                                    {isExpense ? '- ' : '+ '}
                                    {formatCurrencyVND(transaction.amount)}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </AppCard>
    );
}
