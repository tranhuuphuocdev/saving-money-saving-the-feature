'use client';

import { formatCurrencyVND } from '@/lib/formatters';
import { ICalendarDay } from '@/types/calendar';

interface IDayCellProps {
    day: ICalendarDay;
    onClick?: () => void;
}

export function DayCell({ day, onClick }: IDayCellProps) {
    const hasTransactions = day.totalIncome > 0 || day.totalExpense > 0;
    const netAmount = day.totalIncome - day.totalExpense;

    return (
        <button
            onClick={onClick}
            style={{
                aspectRatio: '1',
                padding: '4px',
                borderRadius: 10,
                border: '1px solid var(--surface-border)',
                background: day.isCurrentMonth ? 'var(--surface-soft)' : 'var(--surface-softest)',
                color: 'var(--foreground)',
                opacity: day.isCurrentMonth ? 1 : 0.5,
                display: 'grid',
                gridTemplateRows: 'auto 1fr auto',
                gap: '1px',
                textAlign: 'left',
                cursor: 'pointer',
                position: 'relative',
                transition: 'all 0.2s ease',
                minWidth: 0,
                overflow: 'hidden',
            }}
            onMouseEnter={(e) => {
                if (day.isCurrentMonth) {
                    (e.currentTarget as HTMLElement).style.background = 'var(--chip-bg)';
                    (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
                }
            }}
            onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = day.isCurrentMonth ? 'var(--surface-soft)' : 'var(--surface-softest)';
                (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
            }}
        >
            {day.isToday && (
                <div
                    style={{
                        position: 'absolute',
                        top: 3,
                        right: 3,
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: 'var(--theme-gradient-start)',
                    }}
                />
            )}

            <div style={{ fontSize: 'clamp(9px, 2.2vw, 12px)', fontWeight: 700, color: day.isToday ? 'var(--theme-gradient-start)' : 'var(--foreground)', lineHeight: 1 }}>
                {day.date}
            </div>

            <div />

            {day.totalIncome > 0 && (
                <div style={{ fontSize: 'clamp(6px, 1.2vw, 8px)', color: '#10b981', fontWeight: 600, lineHeight: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>+{formatCurrencyVND(day.totalIncome)}</div>
            )}

            {day.totalExpense > 0 && (
                <div style={{ fontSize: 'clamp(6px, 1.2vw, 8px)', color: '#ef4444', fontWeight: 600, lineHeight: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>-{formatCurrencyVND(day.totalExpense)}</div>
            )}
        </button>
    );
}
