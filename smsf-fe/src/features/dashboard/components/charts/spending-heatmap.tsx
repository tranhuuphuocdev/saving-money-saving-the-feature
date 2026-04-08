'use client';

import { useMemo, useState } from 'react';
import { CalendarDays, Dot } from 'lucide-react';
import { AppCard } from '@/components/common/app-card';
import { formatCurrencyVND } from '@/lib/formatters';
import { ICalendarTransaction } from '@/types/calendar';

type TypeIntensityLevel = 0 | 1 | 2 | 3 | 4;

interface IMoodEntry {
    mood: string;
    emoji?: string;
}

interface IMonthData {
    month: number;
    year: number;
    transactions: ICalendarTransaction[];
}

interface ISpendingHeatmapProps {
    monthsData: IMonthData[];
    moodByDate?: Record<string, IMoodEntry | undefined>;
    isLoading?: boolean;
    title?: 'Financial Pulse Map' | 'Monthly Spending Rhythm' | 'Nhịp độ chi tiêu';
}

interface ICalendarCell {
    date: Date;
    dateKey: string;
    dayNumber: number;
    weekIndex: number;
    weekdayIndex: number;
}

interface IDailyExpenseMeta {
    amount: number;
    intensityLevel: TypeIntensityLevel;
}

interface ISingleMonthHeatmapProps {
    month: number;
    year: number;
    transactions: ICalendarTransaction[];
    moodByDate?: Record<string, IMoodEntry | undefined>;
    activeDateKey: string | null;
    onActiveDateKeyChange: (key: string | null) => void;
}

const WEEKDAY_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

function toDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getWeekdayIndexMondayFirst(date: Date): number {
    return (date.getDay() + 6) % 7;
}

function buildMonthCalendarCells(month: number, year: number): {
    cells: ICalendarCell[];
    totalWeeks: number;
} {
    const firstDate = new Date(year, month - 1, 1);
    const daysInMonth = new Date(year, month, 0).getDate();
    const firstOffset = getWeekdayIndexMondayFirst(firstDate);
    const totalWeeks = Math.ceil((firstOffset + daysInMonth) / 7);

    const cells: ICalendarCell[] = [];

    for (let day = 1; day <= daysInMonth; day += 1) {
        const date = new Date(year, month - 1, day);
        const matrixIndex = firstOffset + (day - 1);

        cells.push({
            date,
            dateKey: toDateKey(date),
            dayNumber: day,
            weekIndex: Math.floor(matrixIndex / 7),
            weekdayIndex: matrixIndex % 7,
        });
    }

    return { cells, totalWeeks };
}

function getIntensityLevel(amount: number, maxAmount: number): TypeIntensityLevel {
    if (amount <= 0 || maxAmount <= 0) {
        return 0;
    }

    const ratio = amount / maxAmount;

    if (ratio < 0.25) {
        return 1;
    }

    if (ratio < 0.5) {
        return 2;
    }

    if (ratio < 0.75) {
        return 3;
    }

    return 4;
}

function getIntensityColor(level: TypeIntensityLevel): string {
    if (level === 0) {
        return 'rgba(148, 163, 184, 0.18)';
    }

    if (level === 1) {
        return 'rgba(251, 191, 36, 0.28)';
    }

    if (level === 2) {
        return 'rgba(251, 146, 60, 0.42)';
    }

    if (level === 3) {
        return 'rgba(249, 115, 22, 0.62)';
    }

    return 'rgba(239, 68, 68, 0.88)';
}

function formatDateLabel(date: Date): string {
    return new Intl.DateTimeFormat('vi-VN', {
        weekday: 'short',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    }).format(date);
}

function formatMonthLabel(month: number, year: number): string {
    const monthStr = String(month).padStart(2, '0');
    return `${monthStr}/${year}`;
}

function SingleMonthHeatmap({
    month,
    year,
    transactions,
    moodByDate,
    activeDateKey,
    onActiveDateKeyChange,
}: ISingleMonthHeatmapProps) {
    const { cells, totalWeeks } = useMemo(() => {
        return buildMonthCalendarCells(month, year);
    }, [month, year]);

    const dailyMetaMap = useMemo(() => {
        const expenseByDate = transactions.reduce<Record<string, number>>((acc, transaction) => {
            if (transaction.type !== 'expense') {
                return acc;
            }

            const dateKey = toDateKey(new Date(transaction.timestamp));
            acc[dateKey] = (acc[dateKey] || 0) + transaction.amount;
            return acc;
        }, {});

        const maxAmount = Math.max(0, ...Object.values(expenseByDate));

        return cells.reduce<Record<string, IDailyExpenseMeta>>((acc, cell) => {
            const amount = expenseByDate[cell.dateKey] || 0;

            acc[cell.dateKey] = {
                amount,
                intensityLevel: getIntensityLevel(amount, maxAmount),
            };

            return acc;
        }, {});
    }, [cells, transactions]);

    const totalExpense = useMemo(() => {
        return transactions
            .filter((item) => item.type === 'expense')
            .reduce((sum, item) => sum + item.amount, 0);
    }, [transactions]);

    return (
        <div style={{ display: 'grid', gap: 8 }}>
            <div style={{ textAlign: 'left', height: 42 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--foreground)', marginBottom: 2 }}>
                    {formatMonthLabel(month, year)}
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-text)' }}>
                    = {formatCurrencyVND(totalExpense)}
                </div>
            </div>

            <div
                style={{
                    border: '0px solid var(--surface-border)',
                    borderRadius: 8,
                    background: 'color-mix(in srgb, var(--surface-softest) 86%, transparent)',
                    padding: 8,
                    display: 'inline-block',
                }}
            >
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(7, 12px)',
                        gridTemplateRows: `auto repeat(${totalWeeks}, 12px)`,
                        columnGap: 3,
                        rowGap: 3,
                        alignItems: 'center',
                        position: 'relative',
                    }}
                >
                    {WEEKDAY_LABELS.map((label, weekdayIndex) => (
                        <div
                            key={`${month}-${year}-weekday-${label}`}
                            style={{
                                gridColumn: weekdayIndex + 1,
                                gridRow: 1,
                                fontSize: 8,
                                color: 'var(--muted)',
                                textAlign: 'center',
                                lineHeight: '12px',
                                fontWeight: 500,
                            }}
                        >
                            {label}
                        </div>
                    ))}

                    {cells.map((cell) => {
                        const meta = dailyMetaMap[cell.dateKey];
                        const mood = moodByDate?.[cell.dateKey];
                        const isActive = activeDateKey === cell.dateKey;

                        return (
                            <button
                                key={cell.dateKey}
                                type="button"
                                onMouseEnter={() => onActiveDateKeyChange(cell.dateKey)}
                                onFocus={() => onActiveDateKeyChange(cell.dateKey)}
                                onMouseLeave={() => {
                                    if (activeDateKey === cell.dateKey) {
                                        onActiveDateKeyChange(null);
                                    }
                                }}
                                onBlur={() => {
                                    if (activeDateKey === cell.dateKey) {
                                        onActiveDateKeyChange(null);
                                    }
                                }}
                                onClick={() => {
                                    if (activeDateKey === cell.dateKey) {
                                        onActiveDateKeyChange(null);
                                    } else {
                                        onActiveDateKeyChange(cell.dateKey);
                                    }
                                }}
                                aria-label={`${formatDateLabel(cell.date)}. Tổng chi tiêu ${formatCurrencyVND(meta.amount)}. Cảm xúc ${mood?.mood || 'Chưa có'}`}
                                style={{
                                    gridColumn: cell.weekdayIndex + 1,
                                    gridRow: cell.weekIndex + 2,
                                    width: 12,
                                    height: 12,
                                    borderRadius: 3,
                                    border: isActive
                                        ? '1px solid color-mix(in srgb, var(--accent) 75%, #ffffff)'
                                        : '1px solid color-mix(in srgb, var(--surface-border) 75%, transparent)',
                                    background: getIntensityColor(meta.intensityLevel),
                                    position: 'relative',
                                    transition: 'background-color 180ms ease, border-color 180ms ease, box-shadow 180ms ease, opacity 180ms ease',
                                    boxShadow: isActive
                                        ? '0 0 0 2px color-mix(in srgb, var(--accent) 25%, transparent)'
                                        : 'none',
                                    opacity: isActive ? 1 : 0.92,
                                    padding: 0,
                                    cursor: 'pointer',
                                    willChange: 'background-color, border-color, box-shadow',
                                }}
                            >
                                <span
                                    style={{
                                        position: 'absolute',
                                        top: -4,
                                        right: -3,
                                        fontSize: 8,
                                        lineHeight: 1,
                                        color: 'var(--foreground)',
                                        opacity: mood ? 0.95 : 0,
                                        transform: 'translate3d(0, 0, 0)',
                                    }}
                                >
                                    {mood?.emoji || <Dot size={8} strokeWidth={3} />}
                                </span>
                                <span className="sr-only">Ngày {cell.dayNumber}</span>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

export function SpendingHeatmap({
    monthsData,
    moodByDate,
    isLoading = false,
    title = 'Nhịp độ chi tiêu',
}: ISpendingHeatmapProps) {
    const [activeDateKey, setActiveDateKey] = useState<string | null>(null);

    const activeCell = useMemo(() => {
        if (!activeDateKey) return null;

        for (const monthData of monthsData) {
            const { cells } = buildMonthCalendarCells(monthData.month, monthData.year);
            const found = cells.find((cell) => cell.dateKey === activeDateKey);
            if (found) return found;
        }

        return null;
    }, [activeDateKey, monthsData]);

    const activeMeta = useMemo(() => {
        if (!activeDateKey) return null;

        for (const monthData of monthsData) {
            const expenseByDate = monthData.transactions.reduce<Record<string, number>>((acc, transaction) => {
                if (transaction.type !== 'expense') return acc;
                const dateKey = toDateKey(new Date(transaction.timestamp));
                acc[dateKey] = (acc[dateKey] || 0) + transaction.amount;
                return acc;
            }, {});

            if (activeDateKey in expenseByDate) {
                const amount = expenseByDate[activeDateKey];
                const maxAmount = Math.max(0, ...Object.values(expenseByDate));
                return {
                    amount,
                    intensityLevel: getIntensityLevel(amount, maxAmount),
                };
            }
        }

        return null;
    }, [activeDateKey, monthsData]);

    const activeMood = activeDateKey ? moodByDate?.[activeDateKey] : undefined;

    const totalExpenseAllMonths = useMemo(() => {
        return monthsData.reduce((sum, monthData) => {
            const monthTotal = monthData.transactions
                .filter((item) => item.type === 'expense')
                .reduce((s, item) => s + item.amount, 0);
            return sum + monthTotal;
        }, 0);
    }, [monthsData]);

    if (isLoading) {
        return (
            <AppCard strong style={{ padding: 16 }}>
                <div style={{ color: 'var(--muted)', fontSize: 12.5 }}>Đang dựng biểu đồ nhịp độ chi tiêu...</div>
            </AppCard>
        );
    }

    return (
        <AppCard
            strong
            style={{
                padding: 16,
                display: 'grid',
                gap: 12,
                background: 'linear-gradient(160deg, color-mix(in srgb, var(--card-strong) 92%, var(--surface-strong)), var(--card-strong))',
            }}
        >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <CalendarDays size={16} color="var(--accent)" />
                        <div style={{ fontSize: 15, fontWeight: 800 }}>{title}</div>
                    </div>
                    <div style={{ marginTop: 4, color: 'var(--muted)', fontSize: 12.5 }}>
                        Biểu đồ nhịp độ chi tiêu 3 tháng gần đây.
                    </div>
                </div>

                {/* <div style={{ display: 'grid', gap: 3, textAlign: 'left' }}>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>Cộng cả 3 tháng</div>
                    <div style={{ fontWeight: 800, color: 'var(--accent-text)', fontSize: 13 }}>
                        {formatCurrencyVND(totalExpenseAllMonths)}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>Tổng chi tiêu</div>
                </div> */}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 0 }}>
                {monthsData.map((monthData, idx) => (
                    <div
                        key={`${monthData.month}-${monthData.year}`}
                        style={{
                            paddingLeft: idx === 0 ? 0 : 16,
                            paddingRight: idx === monthsData.length - 1 ? 0 : 16,
                            borderRight: idx === monthsData.length - 1 ? 'none' : '1px solid var(--surface-border)',
                        }}
                    >
                        <SingleMonthHeatmap
                            month={monthData.month}
                            year={monthData.year}
                            transactions={monthData.transactions}
                            moodByDate={moodByDate}
                            activeDateKey={activeDateKey}
                            onActiveDateKeyChange={setActiveDateKey}
                        />
                    </div>
                ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', color: 'var(--muted)', fontSize: 11.5 }}>
                <span>Ít</span>
                {[0, 1, 2, 3, 4].map((level) => (
                    <span
                        key={`legend-${level}`}
                        style={{
                            width: 14,
                            height: 14,
                            borderRadius: 4,
                            border: '1px solid color-mix(in srgb, var(--surface-border) 70%, transparent)',
                            background: getIntensityColor(level as TypeIntensityLevel),
                        }}
                    />
                ))}
                <span>Nhiều</span>
            </div>

            <div
                role="status"
                aria-live="polite"
                style={{
                    borderRadius: 12,
                    border: '1px solid color-mix(in srgb, var(--surface-border) 75%, transparent)',
                    background: 'color-mix(in srgb, var(--surface-strong) 88%, transparent)',
                    padding: '8px 10px',
                    display: 'grid',
                    gap: 3,
                    fontSize: 12,
                    minHeight: 48,
                    transition: 'opacity 180ms ease, color 180ms ease',
                    opacity: activeCell ? 1 : 0.6,
                }}
            >
                <div style={{ color: activeCell ? 'var(--foreground)' : 'var(--muted)' }}>
                    Ngày: {activeCell ? formatDateLabel(activeCell.date) : '---'}
                </div>
                <div style={{ color: activeCell ? 'var(--accent-text)' : 'var(--muted)', fontWeight: 700 }}>
                    Tổng tiền: {activeMeta ? formatCurrencyVND(activeMeta.amount) : formatCurrencyVND(0)}
                </div>
            </div>
        </AppCard>
    );
}
