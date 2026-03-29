export type TypeDashboardTab = 'menu' | 'transactions' | 'dashboard' | 'calendar' | 'wallets' | 'chat';
export type TypeTransactionKind = 'income' | 'expense';

export interface IExpenseCategoryItem {
    id: string;
    label: string;
    amount: number;
    percentage: number;
    color: string;
}

export interface IRecentTransaction {
    id: string;
    amount: number;
    category: string;
    description?: string;
    transactionType: TypeTransactionKind;
    timestamp: string | number;
}

export interface IDashboardMetrics {
    monthLabel: string;
    monthlyIncome: number;
    monthlyExpense: number;
    projectedSaving: number;
    savingRate: number;
    categories: IExpenseCategoryItem[];
    transactions: IRecentTransaction[];
}

export interface ISavingsRateData {
    daysInMonth: number;
    daysPassed: number;
    daysRemaining: number;
    savingsGoal: number;
    totalIncome: number;
    totalExpense: number;
    /** Số tiền trung bình mỗi ngày được phép chi để đạt mục tiêu tiết kiệm */
    avgDailyAllowance: number;
    /** Trung bình chi tiêu thực tế mỗi ngày tính đến hiện tại */
    avgDailyExpense: number;
    /** Tiết kiệm dự phóng cuối tháng nếu duy trì nhịp chi tiêu hiện tại */
    projectedSaving: number;
    /** Tỷ lệ % khả năng giữ được 100% mục tiêu tiết kiệm (0–100) */
    savingsRate: number;
}

export interface ISavingGoalData {
    amount: number;
    month: number;
    year: number;
    categoryId?: string;
}

export interface ISpendingTrendPoint {
    day: number;
    timestamp: number;
    expense: number;
    income: number;
}

export interface ISpendingTrendData {
    month: number;
    year: number;
    daysInMonth: number;
    lastDay: number;
    totalIncome: number;
    savingsGoal: number;
    monthlySpendable: number;
    averageDailyBudget: number;
    maxValue: number;
    points: ISpendingTrendPoint[];
}

export interface IBudgetJarItem {
    id: string;
    name: string;
    month: number;
    year: number;
    targetAmount: number;
    spentAmount: number;
    progressPercent: number;
    remainingAmount: number;
    categoryIds: string[];
    categoryNames: string[];
}

export interface IBudgetJarPresetItem {
    name: string;
    targetPercent: number;
    targetAmount?: number;
    categoryNames: string[];
}

export interface IBudgetJarPreset {
    code: string;
    label: string;
    incomeHint: string;
    items: IBudgetJarPresetItem[];
}
