const CURRENCY_SYMBOL = '₫';

type ICurrencyOptions = {
    compact?: boolean;
    compactThreshold?: number;
    maximumFractionDigits?: number;
};

const COMPACT_UNITS = [
    { value: 1e15, suffix: 'Qa' },
    { value: 1e12, suffix: 'T' },
    { value: 1e9, suffix: 'B' },
    { value: 1e6, suffix: 'M' },
    { value: 1e3, suffix: 'K' },
];

export function formatCompactCurrencyVND(amount: number): string {
    const safeAmount = Number.isFinite(amount) ? amount : 0;
    const absAmount = Math.abs(safeAmount);
    const sign = safeAmount < 0 ? '-' : '';

    for (const unit of COMPACT_UNITS) {
        if (absAmount >= unit.value) {
            const compactValue = absAmount / unit.value;
            const roundedValue =
                compactValue >= 100
                    ? Math.round(compactValue)
                    : Math.round(compactValue * 10) / 10;

            return `${sign}${roundedValue}${unit.suffix} ${CURRENCY_SYMBOL}`;
        }
    }

    return `${sign}${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(absAmount)} ${CURRENCY_SYMBOL}`;
}

export function formatCurrencyVND(amount: number, options: ICurrencyOptions = {}): string {
    const safeAmount = Number.isFinite(amount) ? amount : 0;
    const compactThreshold = options.compactThreshold ?? Number.MAX_SAFE_INTEGER;
    const useCompact = options.compact ?? Math.abs(safeAmount) >= compactThreshold;

    if (useCompact) {
        return formatCompactCurrencyVND(safeAmount);
    }

    return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND',
        maximumFractionDigits: options.maximumFractionDigits ?? 0,
    }).format(safeAmount);
}

export function formatCurrencyVNDSmall(amount: number): string {
    return formatCurrencyVND(amount, { compact: true });
}

export function formatMonthYear(label: string): string {
    return label;
}

export function formatTimeLabel(value: string | number): string {
    return new Intl.DateTimeFormat('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
    }).format(new Date(value));
}

export function formatPercent(value: number): string {
    return `${Math.round(value)}%`;
}

export function formatTransactionTypeLabel(type: 'income' | 'expense'): string {
    return type === 'income' ? 'Thu nhập' : 'Chi tiêu';
}
