import { AppCard } from '@/components/common/app-card';
import { formatCurrencyVND, formatMonthYear } from '@/lib/formatters';
import { IExpenseCategoryItem } from '@/types/dashboard';
import { useMemo } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';

interface IExpenseDonutCardProps {
    monthLabel: string;
    categories: IExpenseCategoryItem[];
    activeCategoryId: string | null;
    onActiveCategoryChange: (categoryId: string | null) => void;
}

export function ExpenseDonutCard({ monthLabel, categories, activeCategoryId, onActiveCategoryChange }: IExpenseDonutCardProps) {
    const activeCategory = useMemo(() => {
        return (
            categories.find((item) => item.id === activeCategoryId) ||
            categories[0] ||
            null
        );
    }, [activeCategoryId, categories]);

    const totalExpense = useMemo(() => {
        return categories.reduce((sum, item) => sum + item.amount, 0);
    }, [categories]);



    return (
        <AppCard strong style={{ padding: 14, minHeight: 320 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <div>
                    <div style={{ color: 'var(--muted)', fontSize: 11.5 }}>Biểu đồ chi tiêu phân bổ</div>
                    <div style={{ marginTop: 4, fontSize: 12.5, fontWeight: 800 }}>{formatCurrencyVND(totalExpense)}</div>
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--accent-text)', fontWeight: 700 }}>{formatMonthYear(monthLabel)}</div>
            </div>

            <div className="pie-chart-touch-surface" style={{ marginTop: 10, height: 170, position: 'relative' }}>
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                        <Pie
                            data={categories}
                            dataKey="amount"
                            nameKey="label"
                            cx="50%"
                            cy="50%"
                            innerRadius={34}
                            outerRadius={62}
                            paddingAngle={1.5}
                            cornerRadius={6}
                            isAnimationActive={false}
                            onMouseEnter={(payload) => onActiveCategoryChange(payload.id)}
                            onClick={(payload) => onActiveCategoryChange(payload.id)}
                        >
                            {categories.map((entry) => (
                                <Cell
                                    key={entry.id}
                                    fill={entry.color}
                                    stroke={activeCategory?.id === entry.id ? 'rgba(255,255,255,0.95)' : 'rgba(148,163,184,0.35)'}
                                    strokeWidth={activeCategory?.id === entry.id ? 3 : 1}
                                />
                            ))}
                        </Pie>
                    </PieChart>
                </ResponsiveContainer>
                <div
                    style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'grid',
                        placeItems: 'center',
                        pointerEvents: 'none',
                    }}
                >
                    <div style={{ textAlign: 'center', display: 'grid', gap: 1, maxWidth: 54, width: '100%' }}>
                        <div style={{ fontSize: 7.5, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{monthLabel}</div>
                        <div style={{ fontSize: 8.5, fontWeight: 800, color: activeCategory?.color || '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {activeCategory?.label || 'Chưa có dữ liệu'}
                        </div>
                        <div style={{ fontSize: 8, fontWeight: 700, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {activeCategory ? formatCurrencyVND(activeCategory.amount) : '--'}
                        </div>
                        <div style={{ fontSize: 7.5, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {activeCategory ? `${Math.round(activeCategory.percentage)}%` : ''}
                        </div>
                    </div>
                </div>
            </div>

            <div
                style={{
                    marginTop: 10,
                    overflow: 'hidden',
                    borderTop: '1px solid var(--surface-border)',
                    borderBottom: '1px solid var(--surface-border)',
                    padding: '8px 0',
                }}
            >
                <div className="category-marquee-track">
                    {[...categories, ...categories].map((item, index) => (
                        <div key={`${item.id}-${index}`} className="category-marquee-item">
                            <span
                                style={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: 999,
                                    background: item.color,
                                    flexShrink: 0,
                                }}
                            />
                            <span>{item.label}</span>
                        </div>
                    ))}
                </div>
            </div>
        </AppCard>
    );
}
