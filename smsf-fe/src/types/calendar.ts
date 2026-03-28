export type TypeTransactionKind = 'income' | 'expense';

export interface ICalendarDay {
    date: number;
    month: number;
    year: number;
    isCurrentMonth: boolean;
    isToday: boolean;
    totalIncome: number;
    totalExpense: number;
}

export interface ITransaction {
    id: string;
    walletId: string;
    amount: number;
    category: string;
    cateName?: string;
    description?: string;
    type: TypeTransactionKind;
    timestamp: number;
    createdAt?: number;
    updatedAt?: number;
}

export interface ICalendarTransaction extends ITransaction {
    date: number;
}

export interface IWalletItem {
    id: string;
    name: string;
    type: string;
    balance: number;
    createdAt: number;
    updatedAt: number;
}

export interface IWalletSummary {
    wallets: IWalletItem[];
    totalAmount: number;
}

export interface ICreateWalletPayload {
    name: string;
    type?: string;
    balance?: number;
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

export type TypeCategoryKind = 'income' | 'expense';

export interface ICategoryItem {
    id: string;
    name: string;
    icon?: string;
    type: TypeCategoryKind;
    isDefault: boolean;
}

export interface ITransactionQueryParams {
    page?: number;
    limit?: number;
    categoryId?: string;
    description?: string;
    startTime?: number;
    endTime?: number;
}

export interface ITransactionQueryResult {
    items: ICalendarTransaction[];
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
}
