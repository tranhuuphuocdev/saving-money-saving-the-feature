import { IWallet, IWalletSummary } from "../interfaces/transaction.interface";
import { randomUUID } from "node:crypto";
import { DbExecutor } from "../lib/prisma";
import {
    findWalletByUserAndName,
    getWalletById,
    getWalletsByUserId,
    getWalletSummaryByUserId,
    upsertWallet,
    upsertWalletsBulk,
    updateWalletBalance,
    setWalletActive,
} from "../repositories/wallet.repository";

const buildDefaultWallets = (userId: string): IWallet[] => {
    const now = Date.now();
    return [
        {
            id: randomUUID(),
            userId,
            name: "Tiền mặt",
            type: "cash",
            balance: 0,
            createdAt: now,
            updatedAt: now,
                isActive: true,
        },
        {
            id: randomUUID(),
            userId,
            name: "Ngân hàng",
            type: "bank",
            balance: 0,
            createdAt: now,
            updatedAt: now,
                isActive: true,
        },
        {
            id: randomUUID(),
            userId,
            name: "Momo",
            type: "momo",
            balance: 0,
            createdAt: now,
            updatedAt: now,
                isActive: true,
        },
    ];
};

const listWalletsByUserId = async (userId: string): Promise<IWallet[]> => {
    const wallets = await getWalletsByUserId(userId);
    if (wallets.length > 0) {
        return wallets;
    }

    const defaults = buildDefaultWallets(userId);
    await upsertWalletsBulk(defaults);
    return defaults;
};

const getWalletSummary = async (userId: string): Promise<IWalletSummary> => {
    const wallets = await listWalletsByUserId(userId);
    const summary = await getWalletSummaryByUserId(userId);

    if (summary.wallets.length === 0) {
        return {
            wallets,
            totalAmount: wallets.reduce((sum, wallet) => sum + wallet.balance, 0),
        };
    }

    return summary;
};

const findWalletById = async (
    userId: string,
    walletId: string,
    executor?: DbExecutor,
): Promise<IWallet | undefined> => {
    return getWalletById(userId, walletId, executor);
};

const applyTransactionEffectToWallet = (
    wallet: IWallet,
    transactionType: "income" | "expense",
    amount: number,
    mode: "apply" | "revert",
    executor?: DbExecutor,
): Promise<IWallet> => {
    const direction = mode === "apply" ? 1 : -1;
    const delta = transactionType === "income" ? amount * direction : -amount * direction;
    const nextBalance = wallet.balance + delta;

    if (nextBalance < 0) {
        const error = new Error("Không có tiền mà mua tùm lum dị cha nội, nạp tiền dô!!");
        (error as Error & { statusCode?: number }).statusCode = 400;
        throw error;
    }

    return updateWalletBalance(wallet.userId, wallet.id, nextBalance, executor).then(
        (updatedWallet) => {
            if (!updatedWallet) {
                const error = new Error("Wallet not found during balance update.");
                (error as Error & { statusCode?: number }).statusCode = 404;
                throw error;
            }

            return updatedWallet;
        },
    );
};

const createWalletForUser = async (
    userId: string,
    payload: {
        name: string;
        type?: string;
        balance?: number;
    },
): Promise<IWallet> => {
    const name = String(payload.name || "").trim();
    const type = String(payload.type || "custom").trim().toLowerCase();
    const balance = Number(payload.balance || 0);

    if (!name) {
        const error = new Error("Wallet name is required.");
        (error as Error & { statusCode?: number }).statusCode = 400;
        throw error;
    }

    if (name.length > 40) {
        const error = new Error("Wallet name must be less than or equal to 40 characters.");
        (error as Error & { statusCode?: number }).statusCode = 400;
        throw error;
    }

    if (!Number.isFinite(balance) || balance < 0) {
        const error = new Error("Wallet balance must be a non-negative number.");
        (error as Error & { statusCode?: number }).statusCode = 400;
        throw error;
    }

    const duplicatedWallet = await findWalletByUserAndName(userId, name);
    if (duplicatedWallet) {
        const error = new Error("Wallet name already exists.");
        (error as Error & { statusCode?: number }).statusCode = 409;
        throw error;
    }

    const now = Date.now();
    const safeType = type || "custom";

    const newWallet: IWallet = {
        id: randomUUID(),
        userId,
        name,
        type: safeType,
        balance,
        createdAt: now,
        updatedAt: now,
            isActive: true,
    };

    return upsertWallet(newWallet);
};

    const setWalletActiveForUser = async (
        userId: string,
        walletId: string,
        isActive: boolean,
    ): Promise<IWallet> => {
        const updated = await setWalletActive(userId, walletId, isActive);

        if (!updated) {
            const error = new Error("Wallet not found.");
            (error as Error & { statusCode?: number }).statusCode = 404;
            throw error;
        }

        return updated;
    };

export {
    listWalletsByUserId,
    getWalletSummary,
    findWalletById,
    applyTransactionEffectToWallet,
    createWalletForUser,
        setWalletActiveForUser,
};
