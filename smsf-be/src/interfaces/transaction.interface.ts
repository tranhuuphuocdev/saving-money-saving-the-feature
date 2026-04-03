export type TypeTransactionKind = "income" | "expense";

export interface IWallet {
    id: string;
    userId: string;
    name: string;
    type: string;
    balance: number;
    createdAt: number;
    updatedAt: number;
    isActive: boolean;
}

export interface IWalletSummary {
    wallets: IWallet[];
    totalAmount: number;
    requiresInitialSetup: boolean;
}

export interface ITransaction {
    id: string;
    userId: string;
    userDisplayName?: string;
    walletId: string;
    amount: number;
    category: string;
    categoryName?: string;
    budgetName?: string;
    description?: string;
    type: TypeTransactionKind;
    timestamp: number;
    createdAt: number;
    updatedAt: number;
    balanceBefore?: number;
    balanceAfter?: number;
}

export interface ICreateTransactionPayload {
    walletId: string;
    amount: number;
    category: string;
    description?: string;
    type: TypeTransactionKind;
    timestamp: number;
}

export interface IUpdateTransactionPayload {
    walletId?: string;
    amount?: number;
    category?: string;
    description?: string;
    type?: TypeTransactionKind;
    timestamp?: number;
}

export interface ITransactionQueryParams {
    category?: string;
    categories?: string[];
    description?: string;
    startTime?: number;
    endTime?: number;
    page: number;
    limit: number;
}

export interface IWalletLog {
    id: string;
    walletId: string;
    transactionId?: string;
    actorDisplayName?: string;
    actorUsername?: string;
    action: string;
    amount: number;
    balanceBefore: number;
    balanceAfter: number;
    description?: string;
    createdAt: number;
}

export interface IWalletLogPage {
    items: IWalletLog[];
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
}

export interface IPaginatedTransactions {
    items: ITransaction[];
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
}

export interface ISpendingTrendPoint {
    day: number;
    timestamp: number;
    expense: number;
    income: number;
}

export interface ISpendingTrendSummary {
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
