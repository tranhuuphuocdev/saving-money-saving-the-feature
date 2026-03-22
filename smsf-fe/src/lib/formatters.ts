export function formatCurrencyVND(amount: number): string {
    return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND',
        maximumFractionDigits: 0,
    }).format(amount);
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
