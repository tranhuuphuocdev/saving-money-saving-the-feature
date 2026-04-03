import { IWallet, IWalletLogPage, IWalletSummary } from "../interfaces/transaction.interface";
import { randomUUID } from "node:crypto";
import { DbExecutor, prisma } from "../lib/prisma";
import {
    findWalletByUserAndName,
    getWalletById,
    getWalletsByUserId,
    getWalletSummaryByUserId,
    upsertWallet,
    upsertWalletsBulk,
    updateWalletBalance,
    setWalletActive,
    createWalletLog,
    getWalletLogsByWalletId,
    reorderWallet,
} from "../repositories/wallet.repository";

interface IWalletLogOptions {
    transactionId?: string;
    action?: string;
    description?: string;
    createdAt?: number;
}

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

const requiresInitialWalletSetup = async (wallets: IWallet[]): Promise<boolean> => {
    if (wallets.length === 0) {
        return false;
    }

    const initialSetupLogs = await prisma.walletLog.count({
        where: {
            walletId: {
                in: wallets.map((wallet) => wallet.id),
            },
            action: "initial-setup",
        },
    });

    return initialSetupLogs === 0;
};

const listWalletsByUserId = async (userId: string): Promise<IWallet[]> => {
    const wallets = await getWalletsByUserId(userId);
    if (wallets.length > 0) {
        return wallets;
    }

    // Check if user exists before creating default wallets
    const userExists = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true },
    });

    if (!userExists) {
        const error = new Error("User not found.");
        (error as Error & { statusCode?: number }).statusCode = 404;
        throw error;
    }

    const defaults = buildDefaultWallets(userId);
    await upsertWalletsBulk(defaults);
    return defaults;
};

const getWalletSummary = async (userId: string): Promise<IWalletSummary> => {
    const wallets = await listWalletsByUserId(userId);
    const shouldRequireInitialSetup = await requiresInitialWalletSetup(wallets);
    const summary = await getWalletSummaryByUserId(userId);

    if (summary.wallets.length === 0) {
        return {
            wallets,
            totalAmount: wallets.reduce((sum, wallet) => sum + wallet.balance, 0),
            requiresInitialSetup: shouldRequireInitialSetup,
        };
    }

    return {
        ...summary,
        requiresInitialSetup: shouldRequireInitialSetup,
    };
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
    logOptions?: IWalletLogOptions,
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
        async (updatedWallet) => {
            if (!updatedWallet) {
                const error = new Error("Wallet not found during balance update.");
                (error as Error & { statusCode?: number }).statusCode = 404;
                throw error;
            }

            const action =
                mode === "apply"
                    ? transactionType === "income" ? "credit" : "debit"
                    : transactionType === "income" ? "debit" : "credit";

            try {
                await createWalletLog({
                    walletId: wallet.id,
                    transactionId: logOptions?.transactionId ?? undefined,
                    action: logOptions?.action || action,
                    amount,
                    balanceBefore: wallet.balance,
                    balanceAfter: nextBalance,
                    description: logOptions?.description,
                    createdAt: logOptions?.createdAt ?? Date.now(),
                }, executor);
            } catch {
                // wallet log failure is non-critical
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

const initializeWalletBalancesForUser = async (
    userId: string,
    payload: {
        wallets: Array<{
            walletId: string;
            balance: number;
        }>;
    },
): Promise<IWalletSummary> => {
    const wallets = await listWalletsByUserId(userId);
    const submittedWallets = Array.isArray(payload.wallets) ? payload.wallets : [];

    if (wallets.length === 0) {
        const error = new Error("No wallets found for initial setup.");
        (error as Error & { statusCode?: number }).statusCode = 400;
        throw error;
    }

    if (!(await requiresInitialWalletSetup(wallets))) {
        const error = new Error("Initial wallet setup has already been completed.");
        (error as Error & { statusCode?: number }).statusCode = 409;
        throw error;
    }

    if (submittedWallets.length !== wallets.length) {
        const error = new Error("Please provide an initial balance for every wallet.");
        (error as Error & { statusCode?: number }).statusCode = 400;
        throw error;
    }

    const balancesByWalletId = new Map<string, number>();

    for (const item of submittedWallets) {
        const walletId = String(item.walletId || "").trim();
        const balance = Number(item.balance ?? 0);

        if (!walletId) {
            const error = new Error("walletId is required for initial setup.");
            (error as Error & { statusCode?: number }).statusCode = 400;
            throw error;
        }

        if (balancesByWalletId.has(walletId)) {
            const error = new Error("Duplicate walletId found in initial setup payload.");
            (error as Error & { statusCode?: number }).statusCode = 400;
            throw error;
        }

        if (!Number.isFinite(balance) || balance < 0) {
            const error = new Error("Wallet balance must be a non-negative number.");
            (error as Error & { statusCode?: number }).statusCode = 400;
            throw error;
        }

        balancesByWalletId.set(walletId, balance);
    }

    for (const wallet of wallets) {
        if (!balancesByWalletId.has(wallet.id)) {
            const error = new Error(`Missing initial balance for wallet ${wallet.name}.`);
            (error as Error & { statusCode?: number }).statusCode = 400;
            throw error;
        }
    }

    const now = Date.now();

    await prisma.$transaction(async (tx) => {
        for (const wallet of wallets) {
            const nextBalance = balancesByWalletId.get(wallet.id) ?? 0;

            await updateWalletBalance(userId, wallet.id, nextBalance, tx);
            await createWalletLog({
                walletId: wallet.id,
                action: "initial-setup",
                amount: nextBalance,
                balanceBefore: wallet.balance,
                balanceAfter: nextBalance,
                description: "Thiết lập số dư khởi tạo",
                createdAt: now,
            }, tx);
        }
    });

    return getWalletSummary(userId);
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

const getWalletLogsForUser = async (
    userId: string,
    walletId: string,
    page: number,
    limit: number,
    startTime?: number,
    endTime?: number,
): Promise<IWalletLogPage> => {
    return getWalletLogsByWalletId(userId, walletId, page, limit, startTime, endTime);
};

const reorderWalletForUser = async (
    userId: string,
    walletId: string,
    orderIndex: number,
): Promise<void> => {
    const wallet = await findWalletById(userId, walletId);
    if (!wallet) {
        const error = new Error("Wallet not found.");
        (error as Error & { statusCode?: number }).statusCode = 404;
        throw error;
    }

    return reorderWallet(userId, walletId, orderIndex);
};

export {
    listWalletsByUserId,
    getWalletSummary,
    findWalletById,
    applyTransactionEffectToWallet,
    createWalletForUser,
    initializeWalletBalancesForUser,
    setWalletActiveForUser,
    getWalletLogsForUser,
    reorderWalletForUser,
};
