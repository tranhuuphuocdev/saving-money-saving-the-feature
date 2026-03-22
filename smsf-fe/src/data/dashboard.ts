import { IDashboardMetrics } from '@/types/dashboard';

export const dashboardMetrics: IDashboardMetrics = {
    monthLabel: '03/2026',
    monthlyIncome: 32000000,
    monthlyExpense: 19800000,
    projectedSaving: 12200000,
    savingRate: 38,
    categories: [
        { id: 'cate-eat', label: 'Ăn uống', amount: 5544000, percentage: 28, color: '#38bdf8' },
        { id: 'cate-move', label: 'Di chuyển', amount: 3366000, percentage: 17, color: '#2563eb' },
        { id: 'cate-bill', label: 'Hoá đơn', amount: 4356000, percentage: 22, color: '#0ea5e9' },
        { id: 'cate-entertain', label: 'Giải trí', amount: 2772000, percentage: 14, color: '#60a5fa' },
        { id: 'cate-other', label: 'Khác', amount: 3762000, percentage: 19, color: '#93c5fd' },
    ],
    transactions: [
        { id: 'txn-1', amount: 185000, category: 'Ăn uống', transactionType: 'expense', timestamp: '2026-03-17T07:25:00.000Z' },
        { id: 'txn-2', amount: 450000, category: 'Hoá đơn', transactionType: 'expense', timestamp: '2026-03-17T05:10:00.000Z' },
        { id: 'txn-3', amount: 2500000, category: 'Lương freelance', transactionType: 'income', timestamp: '2026-03-16T14:45:00.000Z' },
        { id: 'txn-4', amount: 120000, category: 'Di chuyển', transactionType: 'expense', timestamp: '2026-03-16T09:20:00.000Z' },
        { id: 'txn-5', amount: 320000, category: 'Giải trí', transactionType: 'expense', timestamp: '2026-03-15T12:12:00.000Z' },
    ],
};
