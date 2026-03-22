import { api } from '@/lib/auth/api';
import {
    ICalendarTransaction,
    ICategoryItem,
    ICreateTransactionPayload,
    ITransactionQueryParams,
    ITransactionQueryResult,
    IUpdateTransactionPayload,
    IWalletItem,
    IWalletSummary,
} from '@/types/calendar';
import { ISavingGoalData, ISavingsRateData, ISpendingTrendData } from '@/types/dashboard';

interface IApiResponse<T> {
    success: boolean;
    message?: string;
    data: T;
}

interface ITransactionMutationResponse {
    transaction?: ICalendarTransaction;
    deletedTransactionId?: string;
    transactions?: ICalendarTransaction[];
    wallets: IWalletItem[];
    totalAmount: number;
}

interface ITransactionQueryResponse {
    items: Omit<ICalendarTransaction, 'date'>[];
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
}

interface ICategoryApiItem {
    id: string;
    name: string;
    type: 'income' | 'expense';
    isDefault: boolean;
}

const toCalendarTransaction = (
    transaction: Omit<ICalendarTransaction, 'date'>,
): ICalendarTransaction => {
    return {
        ...transaction,
        date: new Date(transaction.timestamp).getDate(),
    };
};

export async function getWalletsRequest(): Promise<IWalletSummary> {
    const response = await api.get<IApiResponse<IWalletSummary>>('/wallets');
    return response.data.data;
}

export async function getTransactionsByMonthRequest(
    month: number,
    year: number,
): Promise<ICalendarTransaction[]> {
    const response = await api.get<IApiResponse<Omit<ICalendarTransaction, 'date'>[]>>(
        '/transactions',
        {
            params: { month, year },
        },
    );

    return response.data.data.map((transaction) =>
        toCalendarTransaction(transaction),
    );
}

export async function queryTransactionsRequest(
    params: ITransactionQueryParams,
): Promise<ITransactionQueryResult> {
    const requestParams = {
        ...params,
        category: params.categoryId,
    };

    const response = await api.get<IApiResponse<ITransactionQueryResponse>>(
        '/transactions/query',
        { params: requestParams },
    );

    return {
        ...response.data.data,
        items: response.data.data.items.map((transaction) =>
            toCalendarTransaction(transaction),
        ),
    };
}

export async function getCategoriesRequest(
    type?: 'income' | 'expense',
): Promise<ICategoryItem[]> {
    const response = await api.get<IApiResponse<ICategoryApiItem[]>>('/categories', {
        params: {
            type,
        },
    });

    return response.data.data.map((item) => ({
        id: item.id,
        name: item.name,
        type: item.type,
        isDefault: item.isDefault,
    }));
}

export async function getRecentTransactionsRequest(
    limit = 5,
): Promise<ICalendarTransaction[]> {
    const result = await queryTransactionsRequest({ page: 1, limit });
    return result.items;
}

export async function createTransactionRequest(
    payload: ICreateTransactionPayload,
): Promise<ITransactionMutationResponse> {
    const response = await api.post<IApiResponse<ITransactionMutationResponse>>(
        '/transactions',
        payload,
    );

    const data = response.data.data;

    return {
        ...data,
        transaction: data.transaction
            ? toCalendarTransaction(data.transaction)
            : undefined,
    };
}

export async function updateTransactionRequest(
    transactionId: string,
    payload: IUpdateTransactionPayload,
): Promise<ITransactionMutationResponse> {
    const response = await api.put<IApiResponse<ITransactionMutationResponse>>(
        `/transactions/${transactionId}`,
        payload,
    );

    const data = response.data.data;

    return {
        ...data,
        transaction: data.transaction
            ? toCalendarTransaction(data.transaction)
            : undefined,
    };
}

export async function deleteTransactionRequest(
    transactionId: string,
): Promise<ITransactionMutationResponse> {
    const response = await api.delete<IApiResponse<ITransactionMutationResponse>>(
        `/transactions/${transactionId}`,
    );

    return response.data.data;
}

export async function getSavingsRateRequest(params: {
    month?: number;
    year?: number;
    savingsGoal?: number;
}): Promise<ISavingsRateData> {
    const response = await api.get<IApiResponse<ISavingsRateData>>(
        '/transactions/savings-rate',
        { params },
    );

    return response.data.data;
}

export async function getSavingGoalRequest(params: {
    month?: number;
    year?: number;
}): Promise<ISavingGoalData> {
    const response = await api.get<IApiResponse<ISavingGoalData>>(
        '/budgets/saving-goal',
        { params },
    );

    return response.data.data;
}

export async function getSpendingTrendRequest(params: {
    month?: number;
    year?: number;
}): Promise<ISpendingTrendData> {
    const response = await api.get<IApiResponse<ISpendingTrendData>>(
        '/transactions/spending-trend',
        { params },
    );

    return response.data.data;
}

export async function upsertSavingGoalRequest(payload: {
    amount: number;
    month: number;
    year: number;
}): Promise<ISavingGoalData> {
    const response = await api.put<IApiResponse<ISavingGoalData>>(
        '/budgets/saving-goal',
        payload,
    );

    return response.data.data;
}
