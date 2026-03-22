'use client';

import { useMemo, useState } from 'react';
import { TrendingDown } from 'lucide-react';
import { AppCard } from '@/components/common/app-card';
import { formatCurrencyVND } from '@/lib/formatters';
import { ISpendingTrendData } from '@/types/dashboard';

interface ISpendingTrendCardProps {
    data: ISpendingTrendData | null;
    isLoading?: boolean;
}

const CHART_WIDTH = 700;
const CHART_HEIGHT = 260;
const PADDING_LEFT = 44;
const PADDING_RIGHT = 14;
const PADDING_TOP = 14;
const PADDING_BOTTOM = 32;

const safeFormat = (value: number) => {
    return formatCurrencyVND(Math.max(0, Math.round(value)));
};

export function SpendingTrendCard({ data, isLoading = false }: ISpendingTrendCardProps) {
    const [hoveredDay, setHoveredDay] = useState<number | null>(null);
    const [pinnedDay, setPinnedDay] = useState<number | null>(null);
    const [isAverageHovered, setIsAverageHovered] = useState(false);
    const [isAveragePinned, setIsAveragePinned] = useState(false);

    const visiblePoints = useMemo(() => {
        if (!data) {
            return [] as Array<{ day: number; expense: number; income: number; timestamp: number }>;
        }

        const pointMap = new Map<number, { day: number; expense: number; income: number; timestamp: number }>();

        data.points
            .filter((point) => point.day >= 1 && point.day <= data.lastDay)
            .forEach((point) => {
                pointMap.set(point.day, point);
            });

        const result: Array<{ day: number; expense: number; income: number; timestamp: number }> = [];

        for (let day = 1; day <= data.lastDay; day += 1) {
            const existing = pointMap.get(day);
            if (existing) {
                result.push(existing);
                continue;
            }

            result.push({
                day,
                expense: 0,
                income: 0,
                timestamp: new Date(data.year, data.month - 1, day).getTime(),
            });
        }

        return result;
    }, [data]);

    if (isLoading) {
        return (
            <AppCard strong style={{ padding: 16 }}>
                <div style={{ color: 'var(--muted)', fontSize: 12.5 }}>Đang tải biểu đồ xu hướng chi tiêu...</div>
            </AppCard>
        );
    }

    if (!data || data.points.length === 0) {
        return (
            <AppCard strong style={{ padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <TrendingDown size={16} color="var(--accent)" />
                    <div style={{ fontSize: 15, fontWeight: 800 }}>Xu hướng chi tiêu theo ngày</div>
                </div>
                <div style={{ color: 'var(--muted)', fontSize: 12.5 }}>Chưa có giao dịch tháng này để dựng biểu đồ.</div>
            </AppCard>
        );
    }

    const maxValue = Math.max(data.maxValue || 0, 1);
    const drawWidth = CHART_WIDTH - PADDING_LEFT - PADDING_RIGHT;
    const drawHeight = CHART_HEIGHT - PADDING_TOP - PADDING_BOTTOM;

    const getX = (day: number) => {
        if (data.daysInMonth <= 1) {
            return PADDING_LEFT;
        }
        return PADDING_LEFT + ((day - 1) / (data.daysInMonth - 1)) * drawWidth;
    };

    const getY = (value: number) => {
        const normalized = Math.min(Math.max(value, 0), maxValue) / maxValue;
        return PADDING_TOP + (1 - normalized) * drawHeight;
    };

    const pointsForLine = visiblePoints
        .map((point) => `${getX(point.day)},${getY(point.expense)}`)
        .join(' ');

    const averageY = getY(data.averageDailyBudget);

    const yAxisTicks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => {
        const value = maxValue * ratio;
        return {
            value,
            y: getY(value),
        };
    });

    const xAxisTicks = [1, Math.ceil(data.daysInMonth / 2), data.daysInMonth];

    const latestPoint = visiblePoints
        .sort((a, b) => b.day - a.day)[0];

    const activeDay = pinnedDay ?? hoveredDay;
    const activePoint = activeDay ? visiblePoints.find((point) => point.day === activeDay) : undefined;
    const showAverageTooltip = (isAverageHovered || isAveragePinned) && !activePoint;

    const handlePointerOnChart = (clientX: number, svgElement: SVGSVGElement) => {
        const bounds = svgElement.getBoundingClientRect();
        const relativeX = Math.min(Math.max(clientX - bounds.left, 0), bounds.width);
        const svgX = (relativeX / bounds.width) * CHART_WIDTH;

        const rawDay =
            1 + ((svgX - PADDING_LEFT) / Math.max(drawWidth, 1)) * Math.max(data.daysInMonth - 1, 1);
        const nextDay = Math.min(data.lastDay, Math.max(1, Math.round(rawDay)));

        setHoveredDay(nextDay);
        setIsAverageHovered(false);
    };

    const formatDayLabel = (day: number) => {
        return `${String(day).padStart(2, '0')}/${String(data.month).padStart(2, '0')}/${data.year}`;
    };

    return (
        <AppCard strong style={{ padding: 16, display: 'grid', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <TrendingDown size={16} color="var(--accent)" />
                        <div style={{ fontSize: 15, fontWeight: 800 }}>Xu hướng chi tiêu theo ngày</div>
                    </div>
                    <div style={{ marginTop: 5, color: 'var(--muted)', fontSize: 12.5 }}>
                        Mức chi được tính trung bình cho tổng thu nhập của 1 tháng
                    </div>
                </div>

                <div style={{ display: 'grid', gap: 5, textAlign: 'left' }}>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>Mức chi trung bình/ngày</div>
                    <div style={{ fontWeight: 800, color: 'var(--accent-text)' }}>{safeFormat(data.averageDailyBudget)}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>Ngày hiện tại: {data.lastDay}/{data.daysInMonth}</div>
                </div>
            </div>

            <div
                style={{
                    borderRadius: 14,
                    border: '1px solid var(--surface-border)',
                    background: 'var(--surface-soft)',
                    padding: 10,
                    overflowX: 'auto',
                }}
            >
                <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} width="100%" height={CHART_HEIGHT} role="img" aria-label="Biểu đồ xu hướng chi tiêu">
                    {yAxisTicks.map((tick) => (
                        <g key={`y-${tick.value}`}>
                            <line
                                x1={PADDING_LEFT}
                                x2={CHART_WIDTH - PADDING_RIGHT}
                                y1={tick.y}
                                y2={tick.y}
                                stroke="color-mix(in srgb, var(--surface-border) 70%, transparent)"
                                strokeWidth="1"
                            />
                            <text
                                x={PADDING_LEFT - 8}
                                y={tick.y + 4}
                                textAnchor="end"
                                fontSize="10"
                                fill="var(--muted)"
                            >
                                {Math.round(tick.value / 1000)}k
                            </text>
                        </g>
                    ))}

                    <line
                        x1={PADDING_LEFT}
                        x2={CHART_WIDTH - PADDING_RIGHT}
                        y1={averageY}
                        y2={averageY}
                        stroke="#f59e0b"
                        strokeWidth="2"
                        strokeDasharray="7 6"
                        onMouseEnter={() => setIsAverageHovered(true)}
                        onMouseLeave={() => setIsAverageHovered(false)}
                        onClick={() => {
                            setIsAveragePinned((current) => !current);
                            setPinnedDay(null);
                        }}
                        style={{ cursor: 'pointer' }}
                    />

                    <polyline
                        points={pointsForLine}
                        fill="none"
                        stroke="#22c55e"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />

                    {visiblePoints
                        .map((point) => (
                            <circle
                                key={`pt-${point.day}`}
                                cx={getX(point.day)}
                                cy={getY(point.expense)}
                                r={point.day === latestPoint?.day || point.day === activeDay ? 4.5 : 2.6}
                                fill={point.day === latestPoint?.day || point.day === activeDay ? '#16a34a' : '#22c55e'}
                                onMouseEnter={() => {
                                    setHoveredDay(point.day);
                                    setIsAverageHovered(false);
                                }}
                                onClick={() => {
                                    setPinnedDay((currentDay) => (currentDay === point.day ? null : point.day));
                                    setIsAveragePinned(false);
                                }}
                                style={{ cursor: 'pointer' }}
                            />
                        ))}

                    {activePoint ? (
                        <line
                            x1={getX(activePoint.day)}
                            x2={getX(activePoint.day)}
                            y1={PADDING_TOP}
                            y2={CHART_HEIGHT - PADDING_BOTTOM}
                            stroke="color-mix(in srgb, #22c55e 65%, transparent)"
                            strokeWidth="1"
                            strokeDasharray="4 4"
                        />
                    ) : null}

                    <rect
                        x={PADDING_LEFT}
                        y={PADDING_TOP}
                        width={drawWidth}
                        height={drawHeight}
                        fill="transparent"
                        onMouseMove={(event) => {
                            handlePointerOnChart(event.clientX, event.currentTarget.ownerSVGElement as SVGSVGElement);
                        }}
                        onClick={(event) => {
                            const svgElement = event.currentTarget.ownerSVGElement as SVGSVGElement;
                            const bounds = svgElement.getBoundingClientRect();
                            const relativeX = Math.min(Math.max(event.clientX - bounds.left, 0), bounds.width);
                            const svgX = (relativeX / bounds.width) * CHART_WIDTH;
                            const rawDay =
                                1 + ((svgX - PADDING_LEFT) / Math.max(drawWidth, 1)) * Math.max(data.daysInMonth - 1, 1);
                            const nextDay = Math.min(data.lastDay, Math.max(1, Math.round(rawDay)));

                            setPinnedDay((currentDay) => (currentDay === nextDay ? null : nextDay));
                            setIsAveragePinned(false);
                        }}
                        onMouseLeave={() => setHoveredDay(null)}
                        style={{ cursor: 'crosshair' }}
                    />

                    {activePoint ? (
                        <g>
                            <rect
                                x={Math.min(getX(activePoint.day) + 10, CHART_WIDTH - 190)}
                                y={Math.max(getY(activePoint.expense) - 64, 10)}
                                width="180"
                                height="56"
                                rx="8"
                                ry="8"
                                fill="color-mix(in srgb, var(--surface-strong) 92%, #0f172a)"
                                stroke="color-mix(in srgb, #22c55e 45%, var(--surface-border))"
                            />
                            <text
                                x={Math.min(getX(activePoint.day) + 20, CHART_WIDTH - 180)}
                                y={Math.max(getY(activePoint.expense) - 44, 24)}
                                fontSize="10"
                                fill="var(--muted)"
                            >
                                Ngày {formatDayLabel(activePoint.day)}
                            </text>
                            <text
                                x={Math.min(getX(activePoint.day) + 20, CHART_WIDTH - 180)}
                                y={Math.max(getY(activePoint.expense) - 26, 42)}
                                fontSize="12"
                                fontWeight="700"
                                fill="#22c55e"
                            >
                                Chi tiêu: {safeFormat(activePoint.expense)}
                            </text>
                        </g>
                    ) : null}

                    {showAverageTooltip ? (
                        <g>
                            <rect
                                x={CHART_WIDTH - 240}
                                y={Math.max(averageY - 34, 10)}
                                width="224"
                                height="40"
                                rx="8"
                                ry="8"
                                fill="color-mix(in srgb, var(--surface-strong) 92%, #0f172a)"
                                stroke="color-mix(in srgb, #f59e0b 55%, var(--surface-border))"
                            />
                            <text
                                x={CHART_WIDTH - 228}
                                y={Math.max(averageY - 16, 24)}
                                fontSize="10"
                                fill="var(--muted)"
                            >
                                Mức chi trung bình được phép
                            </text>
                            <text
                                x={CHART_WIDTH - 228}
                                y={Math.max(averageY + 1, 40)}
                                fontSize="12"
                                fontWeight="700"
                                fill="#f59e0b"
                            >
                                {safeFormat(data.averageDailyBudget)} / ngày
                            </text>
                        </g>
                    ) : null}

                    <line
                        x1={PADDING_LEFT}
                        x2={CHART_WIDTH - PADDING_RIGHT}
                        y1={CHART_HEIGHT - PADDING_BOTTOM}
                        y2={CHART_HEIGHT - PADDING_BOTTOM}
                        stroke="var(--surface-border)"
                        strokeWidth="1"
                    />

                    {xAxisTicks.map((tickDay) => (
                        <g key={`x-${tickDay}`}>
                            <line
                                x1={getX(tickDay)}
                                x2={getX(tickDay)}
                                y1={CHART_HEIGHT - PADDING_BOTTOM}
                                y2={CHART_HEIGHT - PADDING_BOTTOM + 4}
                                stroke="var(--surface-border)"
                                strokeWidth="1"
                            />
                            <text
                                x={getX(tickDay)}
                                y={CHART_HEIGHT - 8}
                                textAnchor="middle"
                                fontSize="10"
                                fill="var(--muted)"
                            >
                                {tickDay}
                            </text>
                        </g>
                    ))}
                </svg>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
                <div style={{ borderRadius: 10, border: '1px solid var(--surface-border)', background: 'var(--surface-soft)', padding: '8px 10px' }}>
                    <div style={{ fontSize: 10.5, color: 'var(--muted)' }}>Tổng thu nhập tháng</div>
                    <div style={{ marginTop: 3, fontWeight: 800, fontSize: 12.5 }}>{safeFormat(data.totalIncome)}</div>
                </div>
                <div style={{ borderRadius: 10, border: '1px solid var(--surface-border)', background: 'var(--surface-soft)', padding: '8px 10px' }}>
                    <div style={{ fontSize: 10.5, color: 'var(--muted)' }}>Mục tiêu tiết kiệm</div>
                    <div style={{ marginTop: 3, fontWeight: 800, fontSize: 12.5 }}>{safeFormat(data.savingsGoal)}</div>
                </div>
                <div style={{ borderRadius: 10, border: '1px solid var(--surface-border)', background: 'var(--surface-soft)', padding: '8px 10px' }}>
                    <div style={{ fontSize: 10.5, color: 'var(--muted)' }}>Ngân sách được chi</div>
                    <div style={{ marginTop: 3, fontWeight: 800, fontSize: 12.5 }}>{safeFormat(data.monthlySpendable)}</div>
                </div>
            </div>
        </AppCard>
    );
}
