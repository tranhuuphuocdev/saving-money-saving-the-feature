'use client';

import { ICalendarDay } from '@/types/calendar';
import { DayCell } from './day-cell';

interface ICalendarGridProps {
    days: ICalendarDay[];
    onDaySelect: (day: ICalendarDay) => void;
}

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

export function CalendarGrid({ days, onDaySelect }: ICalendarGridProps) {
    return (
        <div style={{ display: 'grid', gap: 10 }}>
            {/* Weekday Header */}
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(7, 1fr)',
                    gap: '6px',
                    paddingBottom: 6,
                    borderBottom: '1px solid var(--surface-border)',
                }}
            >
                {WEEKDAYS.map((day) => (
                    <div
                        key={day}
                        style={{
                            textAlign: 'center',
                            fontSize: 'clamp(11px, 2vw, 12px)',
                            fontWeight: 700,
                            color: 'var(--muted)',
                        }}
                    >
                        {day}
                    </div>
                ))}
            </div>

            {/* Days Grid */}
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(7, 1fr)',
                    gap: '6px',
                    width: '100%',
                }}
            >
                {days.map((day) => (
                    <DayCell
                        key={`${day.year}-${day.month}-${day.date}`}
                        day={day}
                        onClick={() => onDaySelect(day)}
                    />
                ))}
            </div>
        </div>
    );
}
