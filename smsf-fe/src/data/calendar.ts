import { ICalendarTransaction } from '@/types/calendar';

// Mock transactions data cho calendar
export const mockCalendarTransactions: ICalendarTransaction[] = [
    {
        id: '1',
        amount: 2500000,
        category: 'Lương',
        description: 'Lương tháng 3',
        type: 'income',
        walletId: 'wallet-bank-1',
        timestamp: new Date('2026-03-01T09:00:00Z').getTime(),
        date: 1,
    },
    {
        id: '2',
        amount: 850000,
        category: 'Ăn uống',
        description: 'Cơm trưa',
        type: 'expense',
        walletId: 'wallet-cash-1',
        timestamp: new Date('2026-03-01T12:30:00Z').getTime(),
        date: 1,
    },
    {
        id: '3',
        amount: 450000,
        category: 'Giao thông',
        description: 'Xăng xe',
        type: 'expense',
        walletId: 'wallet-cash-1',
        timestamp: new Date('2026-03-02T08:00:00Z').getTime(),
        date: 2,
    },
    {
        id: '4',
        amount: 1200000,
        category: 'Ăn uống',
        description: 'Ăn tối',
        type: 'expense',
        walletId: 'wallet-cash-1',
        timestamp: new Date('2026-03-03T19:00:00Z').getTime(),
        date: 3,
    },
    {
        id: '5',
        amount: 150000,
        category: 'Giáo dục',
        description: 'Khóa học online',
        type: 'expense',
        walletId: 'wallet-cash-1',
        timestamp: new Date('2026-03-03T20:00:00Z').getTime(),
        date: 3,
    },
    {
        id: '6',
        amount: 3200000,
        category: 'Nhà cửa',
        description: 'Tiền nhà tháng 3',
        type: 'expense',
        walletId: 'wallet-bank-1',
        timestamp: new Date('2026-03-05T10:00:00Z').getTime(),
        date: 5,
    },
    {
        id: '7',
        amount: 800000,
        category: 'Ăn uống',
        description: 'Cơm trưa với bạn',
        type: 'expense',
        walletId: 'wallet-cash-1',
        timestamp: new Date('2026-03-07T12:00:00Z').getTime(),
        date: 7,
    },
    {
        id: '8',
        amount: 500000,
        category: 'Giải trí',
        description: 'Vé xem phim',
        type: 'expense',
        walletId: 'wallet-cash-1',
        timestamp: new Date('2026-03-10T18:00:00Z').getTime(),
        date: 10,
    },
    {
        id: '9',
        amount: 1500000,
        category: 'Ăn uống',
        description: 'Nhà hàng cuối tuần',
        type: 'expense',
        walletId: 'wallet-cash-1',
        timestamp: new Date('2026-03-15T19:30:00Z').getTime(),
        date: 15,
    },
    {
        id: '10',
        amount: 2000000,
        category: 'Freelance',
        description: 'Project hoàn thành',
        type: 'income',
        walletId: 'wallet-bank-1',
        timestamp: new Date('2026-03-18T16:00:00Z').getTime(),
        date: 18,
    },
    {
        id: '11',
        amount: 650000,
        category: 'Ăn uống',
        description: 'Cơm trưa',
        type: 'expense',
        walletId: 'wallet-cash-1',
        timestamp: new Date('2026-03-18T12:30:00Z').getTime(),
        date: 18,
    },
];

export function getTransactionsForDate(
    transactions: ICalendarTransaction[],
    date: number,
    month: number,
    year: number,
): ICalendarTransaction[] {
    return transactions.filter((transaction) => {
        const txnDate = new Date(transaction.timestamp);
        return (
            txnDate.getDate() === date &&
            txnDate.getMonth() + 1 === month &&
            txnDate.getFullYear() === year
        );
    });
}

export function getMonthDaySummary(
    transactions: ICalendarTransaction[],
    month: number,
    year: number,
): Record<number, { income: number; expense: number }> {
    const summary: Record<number, { income: number; expense: number }> = {};

    transactions.forEach((t) => {
        const hasMonth = new Date(t.timestamp).getMonth() === month - 1;
        const hasYear = new Date(t.timestamp).getFullYear() === year;

        if (!hasMonth || !hasYear) return;

        if (!summary[t.date]) {
            const day = new Date(t.timestamp).getDate();
            summary[day] = { income: 0, expense: 0 };
        }

        if (t.type === 'income') {
            const day = new Date(t.timestamp).getDate();
            summary[day].income += t.amount;
        } else {
            const day = new Date(t.timestamp).getDate();
            summary[day].expense += t.amount;
        }
    });

    return summary;
}
