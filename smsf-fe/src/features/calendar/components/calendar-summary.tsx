'use client';

import { useEffect, useMemo, useState } from 'react';
import { formatCurrencyVND } from '@/lib/formatters';
import { PrimaryButton } from '@/components/common/primary-button';

interface ICalendarSummaryProps {
    monthLabel: string;
    totalIncome: number;
    totalExpense: number;
    savingsGoal: number;
    avgDailyAllowance: number;
    avgDailyExpense: number;
    daysRemaining: number;
    isSavingGoalSubmitting: boolean;
    onSaveSavingGoal: (amount: number) => Promise<void>;
}

export function CalendarSummary({
    monthLabel,
    totalIncome,
    totalExpense,
    savingsGoal,
    avgDailyAllowance,
    avgDailyExpense,
    daysRemaining,
    isSavingGoalSubmitting,
    onSaveSavingGoal,
}: ICalendarSummaryProps) {
    const netAmount = totalIncome - totalExpense;
    const [isEditingGoal, setIsEditingGoal] = useState(false);
    const [goalInput, setGoalInput] = useState('');

    useEffect(() => {
        setGoalInput(savingsGoal ? String(Math.round(savingsGoal)) : '');
    }, [savingsGoal]);

    const normalizedGoalAmount = useMemo(() => {
        const digits = goalInput.replace(/\D/g, '');
        return digits ? parseInt(digits, 10) : 0;
    }, [goalInput]);

    const motivationalText =
        savingsGoal > 0
            ? avgDailyExpense <= avgDailyAllowance
                ? 'Bạn đang giữ nhịp khá ổn đó, cuối tháng ví sẽ cảm ơn bạn'
                : 'Bóp nhẹ vài khoản nhỏ thôi là mục tiêu tháng này lại trong tầm tay'
            : 'Set mục tiêu tiết kiệm tháng này để biến “để dành sau” thành “để dành thật”';

    return (
        <div
            style={{
                display: 'grid',
                gap: 10,
                padding: 12,
                borderRadius: 14,
                background: 'var(--chip-bg)',
                border: '1px solid var(--surface-border)',
                marginBottom: 14,
            }}
        >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: 'clamp(10px, 1.8vw, 11px)', color: 'var(--muted)', marginBottom: 4 }}>Tổng thu</div>
                    <div style={{ fontSize: 'clamp(10px, 1.8vw, 11px)', fontWeight: 700, color: '#10b981', lineHeight: 1 }}>
                        +{formatCurrencyVND(totalIncome)}
                    </div>
                </div>

                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 'clamp(10px, 1.8vw, 11px)', color: 'var(--muted)', marginBottom: 4 }}>Lệch</div>
                    <div style={{ fontSize: 'clamp(10px, 1.8vw, 11px)', fontWeight: 700, color: netAmount >= 0 ? '#10b981' : '#ef4444', lineHeight: 1 }}>
                        {netAmount >= 0 ? '+' : ''}
                        {formatCurrencyVND(netAmount)}
                    </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 'clamp(10px, 1.8vw, 11px)', color: 'var(--muted)', marginBottom: 4 }}>Tổng chi</div>
                    <div style={{ fontSize: 'clamp(10px, 1.8vw, 11px)', fontWeight: 700, color: '#ef4444', lineHeight: 1 }}>
                        -{formatCurrencyVND(totalExpense)}
                    </div>
                </div>
            </div>

            <div
                style={{
                    borderRadius: 12,
                    background: 'var(--surface-soft)',
                    border: '1px solid var(--surface-border)',
                    padding: 12,
                    display: 'grid',
                    gap: 10,
                }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    <div>
                        <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--foreground)' }}>
                            Mục tiêu tiết kiệm tháng {monthLabel}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4, lineHeight: 1.5 }}>
                            {motivationalText}
                        </div>
                    </div>
                    <div style={{ textAlign: 'left' }}>
                        <div style={{ fontSize: 10.5, color: 'var(--muted)' }}>Mục tiêu:</div>
                        <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--foreground)', marginTop: 2 }}>
                            {formatCurrencyVND(savingsGoal)}
                        </div>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
                    <div style={{ borderRadius: 10, background: 'var(--chip-bg)', padding: '8px 10px', textAlign: 'center' }}>
                        <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>Còn lại</div>
                        <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--foreground)' }}>{daysRemaining} ngày</div>
                    </div>
                    <div style={{ borderRadius: 10, background: 'var(--chip-bg)', padding: '8px 10px', textAlign: 'center' }}>
                        <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>Được chi/ngày</div>
                        <div style={{ fontSize: 12, fontWeight: 800, color: avgDailyAllowance >= 0 ? '#15803d' : '#dc2626' }}>
                            {formatCurrencyVND(avgDailyAllowance)}
                        </div>
                    </div>
                    <div style={{ borderRadius: 10, background: 'var(--chip-bg)', padding: '8px 10px', textAlign: 'center' }}>
                        <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>Đang chi/ngày</div>
                        <div style={{ fontSize: 12, fontWeight: 800, color: avgDailyExpense <= avgDailyAllowance || savingsGoal <= 0 ? '#15803d' : '#dc2626' }}>
                            {formatCurrencyVND(avgDailyExpense)}
                        </div>
                    </div>
                </div>

                {isEditingGoal ? (
                    <div style={{ display: 'grid', gap: 8 }}>
                        <div style={{ position: 'relative' }}>
                            <input
                                type="text"
                                inputMode="numeric"
                                value={goalInput ? new Intl.NumberFormat('vi-VN').format(normalizedGoalAmount) : ''}
                                onChange={(event) => setGoalInput(event.target.value.replace(/\D/g, ''))}
                                placeholder="Nhập mục tiêu tiết kiệm"
                                style={{
                                    width: '100%',
                                    boxSizing: 'border-box',
                                    padding: '10px 12px',
                                    paddingRight: 34,
                                    borderRadius: 10,
                                    border: '1px solid var(--surface-border)',
                                    background: 'var(--background)',
                                    color: 'var(--foreground)',
                                    fontSize: 13,
                                }}
                            />
                            <span
                                style={{
                                    position: 'absolute',
                                    right: 12,
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    fontSize: 12,
                                    color: 'var(--muted)',
                                    pointerEvents: 'none',
                                }}
                            >
                                ₫
                            </span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                            <button
                                type="button"
                                onClick={() => {
                                    setGoalInput(savingsGoal ? String(Math.round(savingsGoal)) : '');
                                    setIsEditingGoal(false);
                                }}
                                style={{
                                    border: '1px solid var(--surface-border)',
                                    background: 'transparent',
                                    color: 'var(--foreground)',
                                    borderRadius: 10,
                                    padding: '10px 12px',
                                    fontWeight: 700,
                                }}
                            >
                                Hủy
                            </button>
                            <PrimaryButton
                                onClick={async () => {
                                    await onSaveSavingGoal(normalizedGoalAmount);
                                    setIsEditingGoal(false);
                                }}
                                disabled={isSavingGoalSubmitting}
                                style={{ opacity: isSavingGoalSubmitting ? 0.7 : 1 }}
                            >
                                {isSavingGoalSubmitting ? 'Đang lưu...' : 'Lưu mục tiêu'}
                            </PrimaryButton>
                        </div>
                    </div>
                ) : (
                    <button
                        type="button"
                        onClick={() => setIsEditingGoal(true)}
                        style={{
                            border: '1px dashed var(--theme-gradient-start)',
                            background: 'transparent',
                            color: 'var(--theme-gradient-start)',
                            borderRadius: 10,
                            padding: '10px 12px',
                            fontWeight: 800,
                            fontSize: 12,
                        }}
                    >
                        {savingsGoal > 0 ? 'Cập nhật mục tiêu tiết kiệm' : 'Thêm mục tiêu tiết kiệm tháng này'}
                    </button>
                )}
            </div>
        </div>
    );
}
