import {
    ICreateTransactionPayload,
    IPaginatedTransactions,
    ISpendingTrendSummary,
    ITransaction,
    ITransactionQueryParams,
    IUpdateTransactionPayload,
} from "../interfaces/transaction.interface";
import {
    createTransaction,
    createTransactionsBulk,
    deleteTransaction,
    getTransactionById,
    getTransactionsByUserAndMonth,
    getSpendingTrendAggregationByMonth,
    queryTransactionsByUser,
    updateTransaction,
} from "../repositories/transaction.repository";
import {
    applyTransactionEffectToWallet,
    findWalletById,
} from "./wallet.service";
import { getCategoryById } from "./category.service";
import { getSavingBudgetByUser, getSavingGoalByUser } from "./budget.service";
import { computeSavingsRate, ISavingsRateResult } from "../util/savings-calc";

interface ITransactionMetaPayload {
    userDisplayName: string;
    categoryName: string;
    budgetName: string;
}

const resolveTransactionMeta = async (
    userId: string,
    actorUsername: string | undefined,
    categoryId: string,
    timestamp: number,
): Promise<ITransactionMetaPayload> => {
    const date = new Date(timestamp);
    const month = date.getMonth() + 1;
    const year = date.getFullYear();

    const [category, savingBudget] = await Promise.all([
        getCategoryById(userId, categoryId),
        getSavingBudgetByUser(userId, month, year),
    ]);

    return {
        userDisplayName: String(actorUsername || userId).trim() || userId,
        categoryName: category?.name || categoryId,
        budgetName: savingBudget?.name || "",
    };
};

const listTransactionsByMonth = (
    userId: string,
    month: number,
    year: number,
): Promise<ITransaction[]> => {
    return getTransactionsByUserAndMonth(userId, month, year);
};

const listTransactionsByQuery = (
    userId: string,
    queryParams: ITransactionQueryParams,
): Promise<IPaginatedTransactions> => {
    return queryTransactionsByUser(userId, queryParams);
};

const createTransactionForUser = (
    userId: string,
    payload: ICreateTransactionPayload,
    actorUsername?: string,
): Promise<{ transaction: ITransaction; updatedWalletBalance: number }> => {
    return findWalletById(userId, payload.walletId).then(async (wallet) => {
        if (!wallet) {
            const error = new Error("Wallet not found.");
            (error as Error & { statusCode?: number }).statusCode = 404;
            throw error;
        }

        const updatedWallet = await applyTransactionEffectToWallet(
            wallet,
            payload.type,
            payload.amount,
            "apply",
        );

        const meta = await resolveTransactionMeta(
            userId,
            actorUsername,
            payload.category,
            payload.timestamp,
        );

        const transaction = await createTransaction(userId, payload, meta);

        return {
            transaction,
            updatedWalletBalance: updatedWallet.balance,
        };
    });
};

const createTransactionsBulkForUser = async (
    userId: string,
    payloads: ICreateTransactionPayload[],
    actorUsername?: string,
): Promise<{ transactions: ITransaction[] }> => {
    for (const payload of payloads) {
        const wallet = await findWalletById(userId, payload.walletId);
        if (!wallet) {
            const error = new Error(`Wallet not found: ${payload.walletId}`);
            (error as Error & { statusCode?: number }).statusCode = 404;
            throw error;
        }

        await applyTransactionEffectToWallet(
            wallet,
            payload.type,
            payload.amount,
            "apply",
        );
    }

    const metadataItems = await Promise.all(
        payloads.map((payload) =>
            resolveTransactionMeta(
                userId,
                actorUsername,
                payload.category,
                payload.timestamp,
            ),
        ),
    );

    const transactions = await createTransactionsBulk(userId, payloads, metadataItems);

    return { transactions };
};

const updateTransactionForUser = (
    userId: string,
    transactionId: string,
    payload: IUpdateTransactionPayload,
    actorUsername?: string,
): Promise<{ transaction: ITransaction; affectedWalletIds: string[] }> => {
    return getTransactionById(userId, transactionId).then(async (existing) => {
        if (!existing) {
            const error = new Error("Transaction not found.");
            (error as Error & { statusCode?: number }).statusCode = 404;
            throw error;
        }

        const currentWallet = await findWalletById(userId, existing.walletId);
        if (!currentWallet) {
            const error = new Error("Current wallet not found.");
            (error as Error & { statusCode?: number }).statusCode = 404;
            throw error;
        }

        const nextWalletId = payload.walletId ?? existing.walletId;
        const nextType = payload.type ?? existing.type;
        const nextAmount = payload.amount ?? existing.amount;

        const nextWallet = await findWalletById(userId, nextWalletId);
        if (!nextWallet) {
            const error = new Error("Target wallet not found.");
            (error as Error & { statusCode?: number }).statusCode = 404;
            throw error;
        }

        const revertedWallet = await applyTransactionEffectToWallet(
            currentWallet,
            existing.type,
            existing.amount,
            "revert",
        );

        // If the wallet hasn't changed, use the reverted wallet (with its updated balance)
        // to avoid applying the new amount against a stale pre-revert balance.
        const walletToApply =
            existing.walletId === nextWalletId ? revertedWallet : nextWallet;

        try {
            await applyTransactionEffectToWallet(
                walletToApply,
                nextType,
                nextAmount,
                "apply",
            );
        } catch (error) {
            await applyTransactionEffectToWallet(
                currentWallet,
                existing.type,
                existing.amount,
                "apply",
            );
            throw error;
        }

        const resolvedCategory = payload.category ?? existing.category;
        const resolvedTimestamp = payload.timestamp ?? existing.timestamp;
        const meta = await resolveTransactionMeta(
            userId,
            actorUsername,
            resolvedCategory,
            resolvedTimestamp,
        );

        const updated = await updateTransaction(userId, transactionId, payload, meta);

        if (!updated) {
            const error = new Error("Transaction update failed.");
            (error as Error & { statusCode?: number }).statusCode = 500;
            throw error;
        }

        return {
            transaction: updated,
            affectedWalletIds:
                existing.walletId === nextWalletId
                    ? [existing.walletId]
                    : [existing.walletId, nextWalletId],
        };
    });
};

const deleteTransactionForUser = (
    userId: string,
    transactionId: string,
): Promise<{
    deletedTransactionId: string;
    updatedWalletBalance: number;
    walletId: string;
}> => {
    return getTransactionById(userId, transactionId).then(async (existing) => {
        if (!existing) {
            const error = new Error("Transaction not found.");
            (error as Error & { statusCode?: number }).statusCode = 404;
            throw error;
        }

        const wallet = await findWalletById(userId, existing.walletId);
        if (!wallet) {
            const error = new Error("Wallet not found.");
            (error as Error & { statusCode?: number }).statusCode = 404;
            throw error;
        }

        const removed = await deleteTransaction(userId, transactionId);

        if (!removed) {
            const error = new Error("Transaction delete failed.");
            (error as Error & { statusCode?: number }).statusCode = 500;
            throw error;
        }

        const updatedWallet = await applyTransactionEffectToWallet(
            wallet,
            existing.type,
            existing.amount,
            "revert",
        );

        return {
            deletedTransactionId: transactionId,
            walletId: wallet.id,
            updatedWalletBalance: updatedWallet.balance,
        };
    });
};

/**
 * Tính tỷ lệ tiết kiệm của user trong tháng hiện tại.
 * Logic tính toán nằm trong util/savings-calc.ts.
 */
const getSavingsRateForUser = async (
    userId: string,
    month: number,
    year: number,
    savingsGoal: number,
): Promise<ISavingsRateResult> => {
    const transactions = await getTransactionsByUserAndMonth(userId, month, year);

    const totalIncome = transactions
        .filter((t) => t.type === "income")
        .reduce((sum, t) => sum + t.amount, 0);

    const totalExpense = transactions
        .filter((t) => t.type === "expense")
        .reduce((sum, t) => sum + t.amount, 0);

    // Dùng ngày hiện tại làm referenceDate để daysPassed / daysRemaining luôn đúng
    const referenceDate = new Date();

    return computeSavingsRate({
        totalIncome,
        totalExpense,
        savingsGoal,
        targetMonth: month,
        targetYear: year,
        referenceDate,
    });
};

const getMonthlySpendingTrendForUser = async (
    userId: string,
    month: number,
    year: number,
): Promise<ISpendingTrendSummary> => {
    const [{ points, totalIncome }, savingsGoalSummary] = await Promise.all([
        getSpendingTrendAggregationByMonth(userId, month, year),
        getSavingGoalByUser(userId, month, year),
    ]);

    const daysInMonth = new Date(year, month, 0).getDate();
    const now = new Date();
    const isCurrentMonth = now.getMonth() + 1 === month && now.getFullYear() === year;
    const lastDay = isCurrentMonth ? now.getDate() : daysInMonth;

    const normalizedPoints = points
        .filter((point) => point.day >= 1 && point.day <= daysInMonth)
        .map((point) => ({ ...point }))
        .sort((left, right) => left.day - right.day);

    const savingsGoal = savingsGoalSummary.amount || 0;
    const monthlySpendable = Math.max(totalIncome - savingsGoal, 0);
    const averageDailyBudget = monthlySpendable / daysInMonth;

    const maxDailyExpense = normalizedPoints.reduce(
        (maxValue, point) => Math.max(maxValue, point.expense),
        0,
    );
    const maxValue = Math.max(
        100000,
        Math.ceil(Math.max(maxDailyExpense, averageDailyBudget) * 1.18),
    );

    return {
        month,
        year,
        daysInMonth,
        lastDay,
        totalIncome,
        savingsGoal,
        monthlySpendable,
        averageDailyBudget,
        maxValue,
        points: normalizedPoints,
    };
};

export {
    listTransactionsByMonth,
    listTransactionsByQuery,
    createTransactionForUser,
    createTransactionsBulkForUser,
    updateTransactionForUser,
    deleteTransactionForUser,
    getSavingsRateForUser,
    getMonthlySpendingTrendForUser,
};
