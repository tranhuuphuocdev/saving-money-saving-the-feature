export type TypeTransactionKind = "income" | "expense";

export interface IWallet {
    id: string;
    userId: string;
    name: string;
    type: string;
    balance: number;
    createdAt: number;
    updatedAt: number;
}

export interface IWalletSummary {
    wallets: IWallet[];
    totalAmount: number;
}

export interface ITransaction {
    id: string;
    userId: string;
    walletId: string;
    amount: number;
    category: string;
    description?: string;
    type: TypeTransactionKind;
    timestamp: number;
    createdAt: number;
    updatedAt: number;
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
    description?: string;
    startTime?: number;
    endTime?: number;
    page: number;
    limit: number;
}

export interface IPaginatedTransactions {
    items: ITransaction[];
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
}
