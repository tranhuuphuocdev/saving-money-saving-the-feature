'use client';

import { AppCard } from '@/components/common/app-card';
import { formatCurrencyVND, formatMonthYear } from '@/lib/formatters';
import { IExpenseCategoryItem } from '@/types/dashboard';
import { useMemo } from 'react';

interface ISavingsRingCardProps {
    monthLabel: string;
    categories: IExpenseCategoryItem[];
    activeCategoryId: string | null;
    onActiveCategoryChange: (categoryId: string | null) => void;
}

export function SavingsRingCard({ monthLabel, categories, activeCategoryId, onActiveCategoryChange }: ISavingsRingCardProps) {
    const sortedCategories = useMemo(
        () => [...categories].sort((left, right) => right.amount - left.amount),
        [categories],
    );

    const totalExpense = useMemo(
        () => sortedCategories.reduce((sum, item) => sum + item.amount, 0),
        [sortedCategories],
    );

    return (
        <AppCard strong style={{ padding: 14, minHeight: 320, display: 'grid', alignContent: 'start' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <div>
                    <div style={{ color: 'var(--muted)', fontSize: 11.5 }}>Chi tiêu theo danh mục</div>
                    <div style={{ marginTop: 3, fontSize: 12.5, fontWeight: 800 }}>{formatCurrencyVND(totalExpense)}</div>
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--accent-text)', fontWeight: 700 }}>{formatMonthYear(monthLabel)}</div>
            </div>

            <div
                style={{
                    marginTop: 12,
                    display: 'grid',
                    gap: 6,
                    height: 230,
                    overflowY: 'auto',
                    paddingRight: 4,
                }}
            >
                {sortedCategories.length === 0 ? (
                    <div style={{ color: 'var(--muted)', fontSize: 12.5 }}>Chưa có dữ liệu chi tiêu theo danh mục.</div>
                ) : null}

                {sortedCategories.map((item) => (
                    <div
                        key={item.id}
                        onMouseEnter={() => onActiveCategoryChange(item.id)}
                        onFocus={() => onActiveCategoryChange(item.id)}
                        role="button"
                        tabIndex={0}
                        onClick={() => onActiveCategoryChange(item.id)}
                        style={{
                            borderRadius: 8,
                            border: activeCategoryId === item.id ? '1px solid var(--chip-border)' : '1px solid var(--surface-border)',
                            background: activeCategoryId === item.id ? 'var(--chip-bg)' : 'var(--surface-soft)',
                            padding: '4px 8px',
                            display: 'grid',
                            gridTemplateColumns: '1fr auto',
                            gap: 8,
                            alignItems: 'center',
                            minHeight: 28,
                            cursor: 'pointer',
                            transform: activeCategoryId === item.id ? 'translateY(-1px)' : 'translateY(0)',
                            boxShadow: activeCategoryId === item.id ? '0 4px 14px color-mix(in srgb, var(--accent) 16%, transparent)' : 'none',
                            transition: 'transform 140ms ease, box-shadow 140ms ease, background 140ms ease, border-color 140ms ease',
                        }}
                    >
                        <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span
                                style={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: 999,
                                    background: item.color,
                                    flexShrink: 0,
                                }}
                            />
                            <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {item.label}
                            </span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 10.5, fontWeight: 900 }}>{formatCurrencyVND(item.amount)}</div>
                        </div>
                    </div>
                ))}
            </div>
        </AppCard>
    );
}
