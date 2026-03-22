import { IWallet, IWalletSummary } from "../interfaces/transaction.interface";
import {
    getWalletById,
    getWalletsByUserId,
    getWalletSummaryByUserId,
    upsertWalletsBulk,
    updateWalletBalance,
} from "../repositories/wallet.repository";

const buildDefaultWallets = (userId: string): IWallet[] => {
    const now = Date.now();
    return [
        {
            id: `wallet-cash-${userId}`,
            userId,
            name: "Tiền mặt",
            type: "cash",
            balance: 0,
            createdAt: now,
            updatedAt: now,
        },
        {
            id: `wallet-bank-${userId}`,
            userId,
            name: "Ngân hàng",
            type: "bank",
            balance: 0,
            createdAt: now,
            updatedAt: now,
        },
        {
            id: `wallet-momo-${userId}`,
            userId,
            name: "Momo",
            type: "momo",
            balance: 0,
            createdAt: now,
            updatedAt: now,
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
): Promise<IWallet | undefined> => {
    return getWalletById(userId, walletId);
};

const applyTransactionEffectToWallet = (
    wallet: IWallet,
    transactionType: "income" | "expense",
    amount: number,
    mode: "apply" | "revert",
): Promise<IWallet> => {
    const direction = mode === "apply" ? 1 : -1;
    const delta = transactionType === "income" ? amount * direction : -amount * direction;
    const nextBalance = wallet.balance + delta;

    if (nextBalance < 0) {
        const error = new Error("Wallet balance is not enough for this expense.");
        (error as Error & { statusCode?: number }).statusCode = 400;
        throw error;
    }

    return updateWalletBalance(wallet.userId, wallet.id, nextBalance).then(
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

export {
    listWalletsByUserId,
    getWalletSummary,
    findWalletById,
    applyTransactionEffectToWallet,
};
