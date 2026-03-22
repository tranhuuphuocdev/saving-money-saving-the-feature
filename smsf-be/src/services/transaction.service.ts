import {
    ICreateTransactionPayload,
    IPaginatedTransactions,
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
    queryTransactionsByUser,
    updateTransaction,
} from "../repositories/transaction.repository";
import {
    applyTransactionEffectToWallet,
    findWalletById,
} from "./wallet.service";
import { computeSavingsRate, ISavingsRateResult } from "../util/savings-calc";

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

        const transaction = await createTransaction(userId, payload);

        return {
            transaction,
            updatedWalletBalance: updatedWallet.balance,
        };
    });
};

const createTransactionsBulkForUser = async (
    userId: string,
    payloads: ICreateTransactionPayload[],
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

    const transactions = await createTransactionsBulk(userId, payloads);

    return { transactions };
};

const updateTransactionForUser = (
    userId: string,
    transactionId: string,
    payload: IUpdateTransactionPayload,
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

        const updated = await updateTransaction(userId, transactionId, payload);

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

export {
    listTransactionsByMonth,
    listTransactionsByQuery,
    createTransactionForUser,
    createTransactionsBulkForUser,
    updateTransactionForUser,
    deleteTransactionForUser,
    getSavingsRateForUser,
};
