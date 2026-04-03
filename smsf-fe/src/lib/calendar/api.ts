import { api } from '@/lib/auth/api';
import {
    ICalendarTransaction,
    ICategoryItem,
    IInitialWalletSetupPayload,
    ICreateTransactionPayload,
    ICreateWalletPayload,
    ITransactionQueryParams,
    ITransactionQueryResult,
    IUpdateTransactionPayload,
    IWalletItem,
    IWalletSummary,
} from '@/types/calendar';
import {
    IAiMonthlyInsightResult,
    TypeAiInsightPeriod,
    IAiTransactionSuggestion,
    TypeAiMonthlyAnalysis,
} from '@/types/ai';
import {
    IBudgetJarItem,
    IBudgetJarPreset,
    ISavingGoalData,
    ISavingsRateData,
    ISpendingTrendData,
} from '@/types/dashboard';

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
    icon?: string;
    type: 'income' | 'expense';
    orderIndex?: number;
    isDefault: boolean;
}

interface IAiAnalyzeResponse {
    suggestion: IAiTransactionSuggestion;
}

interface IAiMonthlyInsightResponse {
    insight: IAiMonthlyInsightResult;
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

export async function createWalletRequest(
    payload: ICreateWalletPayload,
): Promise<IWalletItem> {
    const response = await api.post<IApiResponse<IWalletItem>>('/wallets', payload);
    return response.data.data;
}

export async function initializeWalletSetupRequest(
    payload: IInitialWalletSetupPayload,
): Promise<IWalletSummary> {
    const response = await api.post<IApiResponse<IWalletSummary>>('/wallets/initial-setup', payload);
    return response.data.data;
}

export async function updateWalletActiveRequest(
    walletId: string,
    isActive: boolean,
): Promise<IWalletItem> {
    const response = await api.patch<IApiResponse<IWalletItem>>(`/wallets/${walletId}`, { isActive });
    return response.data.data;
}

export async function reorderWalletRequest(
    walletId: string,
    orderIndex: number,
): Promise<void> {
    await api.patch(`/wallets/${walletId}/reorder`, { orderIndex });
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
    const requestParams: Record<string, unknown> = {
        page: params.page,
        limit: params.limit,
        description: params.description,
        startTime: params.startTime,
        endTime: params.endTime,
    };

    if (params.categoryIds && params.categoryIds.length > 0) {
        requestParams.categories = params.categoryIds.join(',');
    } else if (params.categoryId) {
        requestParams.category = params.categoryId;
    }

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
        icon: item.icon,
        type: item.type,
        orderIndex: Number(item.orderIndex || 0),
        isDefault: item.isDefault,
    }));
}

export async function updateCategoryOrderRequest(payload: {
    type: 'income' | 'expense';
    categoryIds: string[];
}): Promise<ICategoryItem[]> {
    const response = await api.put<IApiResponse<ICategoryApiItem[]>>('/categories/order', payload);

    return response.data.data.map((item) => ({
        id: item.id,
        name: item.name,
        icon: item.icon,
        type: item.type,
        orderIndex: Number(item.orderIndex || 0),
        isDefault: item.isDefault,
    }));
}

export async function createCategoryRequest(payload: {
    name: string;
    type: 'income' | 'expense';
    icon?: string;
}): Promise<ICategoryItem> {
    const response = await api.post<IApiResponse<ICategoryApiItem>>('/categories', payload);
    const item = response.data.data;

    return {
        id: item.id,
        name: item.name,
        icon: item.icon,
        type: item.type,
        orderIndex: Number(item.orderIndex || 0),
        isDefault: item.isDefault,
    };
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

export async function getBudgetJarsRequest(params: {
    month: number;
    year: number;
}): Promise<{ month: number; year: number; jars: IBudgetJarItem[] }> {
    const response = await api.get<IApiResponse<{ month: number; year: number; jars: IBudgetJarItem[] }>>(
        '/budgets/jars',
        { params },
    );

    return response.data.data;
}

export async function getBudgetJarSuggestionsRequest(params?: {
    incomeAmount?: number;
}): Promise<IBudgetJarPreset[]> {
    const response = await api.get<IApiResponse<IBudgetJarPreset[]>>(
        '/budgets/jar-suggestions',
        { params },
    );

    return response.data.data;
}

export async function setupBudgetJarsRequest(payload: {
    month: number;
    year: number;
    incomeAmount?: number;
    jars: Array<{
        name: string;
        targetAmount?: number;
        targetPercent?: number;
        categoryIds: string[];
    }>;
}): Promise<{ month: number; year: number; jars: IBudgetJarItem[] }> {
    const response = await api.put<IApiResponse<{ month: number; year: number; jars: IBudgetJarItem[] }>>(
        '/budgets/jars/setup',
        payload,
    );

    return response.data.data;
}

export async function analyzeSmartTextRequest(payload: {
    text: string;
    walletId?: string;
    fallbackTimestamp?: number;
}): Promise<IAiTransactionSuggestion> {
    const response = await api.post<IApiResponse<IAiAnalyzeResponse>>(
        '/ai/parse-text',
        payload,
    );

    return response.data.data.suggestion;
}

export async function analyzeSmartTextMultiRequest(payload: {
    text: string;
    walletId?: string;
    fallbackTimestamp?: number;
}): Promise<IAiTransactionSuggestion[]> {
    const response = await api.post<IApiResponse<{ suggestions: IAiTransactionSuggestion[] }>>(
        '/ai/parse-text-multi',
        payload,
    );

    return response.data.data.suggestions;
}

export async function analyzeSmartReceiptRequest(payload: {
    imageBase64: string;
    mimeType: string;
    walletId?: string;
    fallbackTimestamp?: number;
}): Promise<IAiTransactionSuggestion> {
    const response = await api.post<IApiResponse<IAiAnalyzeResponse>>(
        '/ai/analyze-receipt',
        payload,
    );

    return response.data.data.suggestion;
}

export async function analyzeMonthlyInsightsRequest(payload: {
    analysisType: TypeAiMonthlyAnalysis;
    periodType?: TypeAiInsightPeriod;
    referenceTimestamp?: number;
    userQuery?: string;
    month?: number;
    year?: number;
}): Promise<IAiMonthlyInsightResult> {
    const response = await api.post<IApiResponse<IAiMonthlyInsightResponse>>(
        '/ai/monthly-insights',
        payload,
    );

    return response.data.data.insight;
}

export interface IWalletLogItem {
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
    items: IWalletLogItem[];
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
}

export async function getWalletLogsRequest(
    walletId: string,
    page = 1,
    limit = 20,
    startTime?: number,
    endTime?: number,
): Promise<IWalletLogPage> {
    const response = await api.get<IApiResponse<IWalletLogPage>>(
        `/wallets/${walletId}/logs`,
        { params: { page, limit, ...(startTime ? { startTime } : {}), ...(endTime ? { endTime } : {}) } },
    );
    return response.data.data;
}
