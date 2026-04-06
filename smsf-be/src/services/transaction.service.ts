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
import { DbExecutor, withTransaction } from "../lib/prisma";
import {
    applyTransactionEffectToWallet,
    findWalletById,
} from "./wallet.service";
import { getCategoryById } from "./category.service";
import {
    getSavingBudgetByUser,
    getSavingGoalByUser,
    syncBudgetJarsByTimestamp,
} from "./budget.service";
import { computeSavingsRate, ISavingsRateResult } from "../util/savings-calc";

interface ITransactionMetaPayload {
    userDisplayName: string;
    categoryName: string;
    budgetName: string;
}

type TypeWalletLogEvent = "create" | "update-apply" | "update-revert" | "delete";

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

const getFallbackTransactionDescription = (
    type: "income" | "expense",
): string => {
    return type === "income" ? "Giao dịch thu nhập" : "Giao dịch chi tiêu";
};

const buildWalletLogDescription = (
    event: TypeWalletLogEvent,
    type: "income" | "expense",
    description?: string,
    categoryName?: string,
): string => {
    const note = String(description || "").trim();
    const categoryLabel = String(categoryName || "").trim();
    const baseDescription = note
        ? (categoryLabel ? `${categoryLabel}: ${note}` : note)
        : categoryLabel || getFallbackTransactionDescription(type);

    if (event === "create") {
        return baseDescription;
    }

    if (event === "update-apply") {
        return `Cập nhật giao dịch: ${baseDescription}`;
    }

    if (event === "update-revert") {
        return `Hoàn tác để cập nhật giao dịch: ${baseDescription}`;
    }

    return `Xóa giao dịch: ${baseDescription}`;
};

const createTransactionForUser = async (
    userId: string,
    payload: ICreateTransactionPayload,
    actorUsername?: string,
    actorUserId?: string,
    executor?: DbExecutor,
): Promise<{ transaction: ITransaction; updatedWalletBalance: number }> => {
    const run = async (txExecutor: DbExecutor) => {
        const wallet = await findWalletById(userId, payload.walletId, txExecutor);
        if (!wallet) {
            const error = new Error("Wallet not found.");
            (error as Error & { statusCode?: number }).statusCode = 404;
            throw error;
        }

        const meta = await resolveTransactionMeta(
            userId,
            actorUsername,
            payload.category,
            payload.timestamp,
        );

        const transaction = await createTransaction(userId, payload, meta, txExecutor);
        const updatedWallet = await applyTransactionEffectToWallet(
            wallet,
            payload.type,
            payload.amount,
            "apply",
            txExecutor,
            {
                transactionId: transaction.id,
                createdBy: actorUserId || userId,
                description: buildWalletLogDescription("create", payload.type, transaction.description ?? payload.description, meta.categoryName),
            },
        );
        await syncBudgetJarsByTimestamp(userId, payload.timestamp, txExecutor);

        return {
            transaction,
            updatedWalletBalance: updatedWallet.balance,
        };
    };

    if (executor) {
        return run(executor);
    }

    return withTransaction(run);
};

const createTransactionsBulkForUser = async (
    userId: string,
    payloads: ICreateTransactionPayload[],
    actorUsername?: string,
    actorUserId?: string,
): Promise<{ transactions: ITransaction[] }> => {
    return withTransaction(async (executor) => {
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

        const transactions = await createTransactionsBulk(
            userId,
            payloads,
            metadataItems,
            executor,
        );

        for (const transaction of transactions) {
            const wallet = await findWalletById(userId, transaction.walletId, executor);
            if (!wallet) {
                const error = new Error(`Wallet not found: ${transaction.walletId}`);
                (error as Error & { statusCode?: number }).statusCode = 404;
                throw error;
            }

            await applyTransactionEffectToWallet(
                wallet,
                transaction.type,
                transaction.amount,
                "apply",
                executor,
                {
                    transactionId: transaction.id,
                    createdBy: actorUserId || userId,
                    description: buildWalletLogDescription("create", transaction.type, transaction.description, transaction.categoryName),
                },
            );
        }

        const monthKeys = Array.from(
            new Set(
                payloads.map((payload) => {
                    const date = new Date(payload.timestamp);
                    return `${date.getFullYear()}-${date.getMonth() + 1}`;
                }),
            ),
        );

        for (const key of monthKeys) {
            const [yearRaw, monthRaw] = key.split("-");
            const timestamp = new Date(Number(yearRaw), Number(monthRaw) - 1, 1).getTime();
            await syncBudgetJarsByTimestamp(userId, timestamp, executor);
        }

        return { transactions };
    });
};

const updateTransactionForUser = async (
    userId: string,
    transactionId: string,
    payload: IUpdateTransactionPayload,
    actorUsername?: string,
    actorUserId?: string,
): Promise<{ transaction: ITransaction; affectedWalletIds: string[] }> => {
    return withTransaction(async (executor) => {
        const existing = await getTransactionById(userId, transactionId, executor);
        if (!existing) {
            const error = new Error("Transaction not found.");
            (error as Error & { statusCode?: number }).statusCode = 404;
            throw error;
        }

        const currentWallet = await findWalletById(userId, existing.walletId, executor);
        if (!currentWallet) {
            const error = new Error("Current wallet not found.");
            (error as Error & { statusCode?: number }).statusCode = 404;
            throw error;
        }

        const nextWalletId = payload.walletId ?? existing.walletId;
        const nextType = payload.type ?? existing.type;
        const nextAmount = payload.amount ?? existing.amount;

        const nextWallet = await findWalletById(userId, nextWalletId, executor);
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
            executor,
            {
                transactionId: existing.id,
                createdBy: actorUserId || userId,
                description: buildWalletLogDescription("update-revert", existing.type, existing.description, existing.categoryName),
            },
        );

        // If the wallet hasn't changed, use the reverted wallet (with its updated balance)
        // to avoid applying the new amount against a stale pre-revert balance.
        const walletToApply =
            existing.walletId === nextWalletId ? revertedWallet : nextWallet;

        const resolvedCategory = payload.category ?? existing.category;
        const resolvedTimestamp = payload.timestamp ?? existing.timestamp;
        const meta = await resolveTransactionMeta(
            userId,
            actorUsername,
            resolvedCategory,
            resolvedTimestamp,
        );

        await applyTransactionEffectToWallet(
            walletToApply,
            nextType,
            nextAmount,
            "apply",
            executor,
            {
                transactionId: existing.id,
                createdBy: actorUserId || userId,
                description: buildWalletLogDescription(
                    "update-apply",
                    nextType,
                    payload.description ?? existing.description,
                    meta.categoryName,
                ),
            },
        );

        const updated = await updateTransaction(userId, transactionId, payload, meta, executor);

        if (!updated) {
            const error = new Error("Transaction update failed.");
            (error as Error & { statusCode?: number }).statusCode = 500;
            throw error;
        }

        await syncBudgetJarsByTimestamp(userId, existing.timestamp, executor);
        await syncBudgetJarsByTimestamp(userId, resolvedTimestamp, executor);

        return {
            transaction: updated,
            affectedWalletIds:
                existing.walletId === nextWalletId
                    ? [existing.walletId]
                    : [existing.walletId, nextWalletId],
        };
    });
};

const deleteTransactionForUser = async (
    userId: string,
    transactionId: string,
    actorUserId?: string,
): Promise<{
    deletedTransactionId: string;
    updatedWalletBalance: number;
    walletId: string;
}> => {
    return withTransaction(async (executor) => {
        const existing = await getTransactionById(userId, transactionId, executor);
        if (!existing) {
            const error = new Error("Transaction not found.");
            (error as Error & { statusCode?: number }).statusCode = 404;
            throw error;
        }

        const wallet = await findWalletById(userId, existing.walletId, executor);
        if (!wallet) {
            const error = new Error("Wallet not found.");
            (error as Error & { statusCode?: number }).statusCode = 404;
            throw error;
        }

        const removed = await deleteTransaction(userId, transactionId, executor);

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
            executor,
            {
                transactionId: existing.id,
                createdBy: actorUserId || userId,
                description: buildWalletLogDescription("delete", existing.type, existing.description, existing.categoryName),
            },
        );

        await syncBudgetJarsByTimestamp(userId, existing.timestamp, executor);

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
