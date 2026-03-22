'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

interface ICalendarHeaderProps {
    currentMonth: number;
    currentYear: number;
    onMonthChange: (month: number, year: number) => void;
}

export function CalendarHeader({ currentMonth, currentYear, onMonthChange }: ICalendarHeaderProps) {
    const monthNames = [
        'Tháng 1',
        'Tháng 2',
        'Tháng 3',
        'Tháng 4',
        'Tháng 5',
        'Tháng 6',
        'Tháng 7',
        'Tháng 8',
        'Tháng 9',
        'Tháng 10',
        'Tháng 11',
        'Tháng 12',
    ];

    function handlePrevMonth() {
        if (currentMonth === 1) {
            onMonthChange(12, currentYear - 1);
        } else {
            onMonthChange(currentMonth - 1, currentYear);
        }
    }

    function handleNextMonth() {
        if (currentMonth === 12) {
            onMonthChange(1, currentYear + 1);
        } else {
            onMonthChange(currentMonth + 1, currentYear);
        }
    }

    function handleToday() {
        const today = new Date();
        onMonthChange(today.getMonth() + 1, today.getFullYear());
    }

    return (
        <div
            style={{
                padding: '16px 14px',
                background: 'var(--surface-soft)',
                borderRadius: 16,
                marginBottom: 16,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
            }}
        >
            <button
                onClick={handlePrevMonth}
                style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    border: '1px solid var(--surface-border)',
                    background: 'var(--surface-base)',
                    color: 'var(--foreground)',
                    display: 'grid',
                    placeItems: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = 'var(--chip-bg)';
                }}
                onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = 'var(--surface-base)';
                }}
            >
                <ChevronLeft size={20} />
            </button>

            <div
                style={{
                    flex: 1,
                    textAlign: 'center',
                    display: 'grid',
                    gap: 4,
                }}
            >
                <div style={{ fontSize: 16, fontWeight: 700 }}>
                    {monthNames[currentMonth - 1]} {currentYear}
                </div>
                <button
                    onClick={handleToday}
                    style={{
                        fontSize: 12,
                        color: 'var(--theme-gradient-start)',
                        fontWeight: 600,
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        padding: 0,
                    }}
                >
                    Hôm nay
                </button>
            </div>

            <button
                onClick={handleNextMonth}
                style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    border: '1px solid var(--surface-border)',
                    background: 'var(--surface-base)',
                    color: 'var(--foreground)',
                    display: 'grid',
                    placeItems: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = 'var(--chip-bg)';
                }}
                onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = 'var(--surface-base)';
                }}
            >
                <ChevronRight size={20} />
            </button>
        </div>
    );
}
