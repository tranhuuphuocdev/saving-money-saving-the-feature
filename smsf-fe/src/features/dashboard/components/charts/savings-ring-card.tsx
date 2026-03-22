'use client';

import { useEffect, useMemo, useState } from 'react';
import { AppCard } from '@/components/common/app-card';
import { formatCurrencyVND, formatPercent } from '@/lib/formatters';

interface ISavingsRingCardProps {
    savingRate: number;
    projectedSaving: number;
    /** Số tiền trung bình mỗi ngày được phép chi để đạt mục tiêu tiết kiệm */
    avgDailyAllowance: number;
    /** Trung bình chi tiêu thực tế mỗi ngày tính đến hiện tại */
    avgDailyExpense: number;
}

export function SavingsRingCard({ savingRate, projectedSaving, avgDailyAllowance, avgDailyExpense }: ISavingsRingCardProps) {
    const [animatedRate, setAnimatedRate] = useState(0);
    const radius = 46;
    const circumference = 2 * Math.PI * radius;
    const isGood = savingRate >= 25;

    useEffect(() => {
        const timer = window.setTimeout(() => setAnimatedRate(savingRate), 120);
        return () => window.clearTimeout(timer);
    }, [savingRate]);

    const dashOffset = useMemo(() => circumference - (animatedRate / 100) * circumference, [animatedRate, circumference]);

    return (
        <AppCard strong style={{ padding: 14, minHeight: 248, display: 'grid', alignContent: 'start' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <div>
                    <div style={{ color: 'var(--muted)', fontSize: 11.5 }}>Tỷ lệ tiết kiệm</div>
                    {/* <div style={{ fontSize: 15, fontWeight: 800, marginTop: 3 }}>Sức khỏe tiết kiệm</div> */}
                </div>
                <div
                    style={{
                        padding: '5px 9px',
                        borderRadius: 999,
                        fontSize: 10.5,
                        fontWeight: 800,
                        color: isGood ? '#166534' : '#b91c1c',
                        background: isGood ? 'rgba(34,197,94,0.14)' : 'rgba(239,68,68,0.16)',
                        border: `1px solid ${isGood ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
                    }}
                >
                    {isGood ? 'Tốt' : 'Cần tối ưu'}
                </div>
            </div>

            <div style={{ display: 'grid', placeItems: 'center', gap: 10, marginTop: 12 }}>
                <div style={{ position: 'relative', width: 118, height: 118 }}>
                    <svg width="118" height="118" viewBox="0 0 132 132">
                        <defs>
                            <linearGradient id="savingsGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor={isGood ? '#22c55e' : '#ef4444'} />
                                <stop offset="100%" stopColor={isGood ? '#38bdf8' : '#f97316'} />
                            </linearGradient>
                        </defs>
                        <g transform="translate(66 66) rotate(-90)">
                            <circle r={radius} fill="transparent" stroke="rgba(148,163,184,0.14)" strokeWidth="12" />
                            <circle
                                r={radius}
                                fill="transparent"
                                stroke="url(#savingsGradient)"
                                strokeWidth="12"
                                strokeLinecap="round"
                                strokeDasharray={circumference}
                                strokeDashoffset={dashOffset}
                                style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.22, 1, 0.36, 1)' }}
                            />
                        </g>
                    </svg>
                    <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
                        <div>
                            <div style={{ fontSize: 23, fontWeight: 900, color: isGood ? '#15803d' : '#dc2626' }}>{formatPercent(animatedRate)}</div>
                            <div style={{ fontSize: 10.5, color: 'var(--muted)' }}>Tỷ lệ</div>
                        </div>
                    </div>
                </div>

                <div style={{ textAlign: 'center', display: 'grid', gap: 6 }}>
                    <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.5, fontStyle: 'italic' }}>
                        Ghi chú: nếu duy trì nhịp chi tiêu này, số tiền tiết kiệm cuối tháng ước tính là:
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: isGood ? '#15803d' : '#dc2626' }}>{formatCurrencyVND(projectedSaving)}</div>
                </div>

                <div style={{ width: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 4 }}>
                    <div style={{ borderRadius: 10, background: 'var(--surface-soft)', border: '1px solid var(--surface-border)', padding: '8px 10px', textAlign: 'center' }}>
                        <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 3 }}>Hạn mức/ngày</div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--foreground)' }}>{formatCurrencyVND(avgDailyAllowance)}</div>
                    </div>
                    <div style={{ borderRadius: 10, background: 'var(--surface-soft)', border: '1px solid var(--surface-border)', padding: '8px 10px', textAlign: 'center' }}>
                        <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 3 }}>Thực chi/ngày</div>
                        <div style={{
                            fontSize: 13,
                            fontWeight: 800,
                            color: avgDailyExpense <= avgDailyAllowance || avgDailyAllowance === 0 ? '#15803d' : '#dc2626',
                        }}>{formatCurrencyVND(avgDailyExpense)}</div>
                    </div>
                </div>
            </div>
        </AppCard>
    );
}
