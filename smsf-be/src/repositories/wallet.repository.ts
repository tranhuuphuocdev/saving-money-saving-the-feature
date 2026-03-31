import { IWallet, IWalletLog, IWalletLogPage, IWalletSummary } from "../interfaces/transaction.interface";
import { DbExecutor, prisma } from "../lib/prisma";

const getExecutor = (executor?: DbExecutor) => executor || prisma;

const mapRow = (row: {
    id: string;
    userId: string;
    name: string;
    type: string;
    amount: unknown;
    createdAt: bigint;
    updatedAt: bigint;
    isActive?: boolean;
}): IWallet => {
    return {
        id: String(row.id),
        userId: String(row.userId),
        name: String(row.name),
        type: String(row.type || "cash"),
        balance: Number(row.amount || 0),
        createdAt: Number(row.createdAt || 0n),
        updatedAt: Number(row.updatedAt || 0n),
        isActive: row.isActive !== false,
    };
};

const upsertWallet = async (
    wallet: IWallet,
    executor?: DbExecutor,
): Promise<IWallet> => {
    const db = getExecutor(executor);

    await db.wallet.upsert({
        where: { id: wallet.id },
        create: {
            id: wallet.id,
            userId: wallet.userId,
            name: wallet.name,
            type: wallet.type,
            amount: wallet.balance,
            createdAt: BigInt(wallet.createdAt),
            updatedAt: BigInt(wallet.updatedAt),
                isActive: wallet.isActive !== false,
        },
        update: {
            name: wallet.name,
            type: wallet.type,
            amount: wallet.balance,
            updatedAt: BigInt(wallet.updatedAt),
                isActive: wallet.isActive !== false,
        },
    });

    return wallet;
};

const upsertWalletsBulk = async (wallets: IWallet[]): Promise<void> => {
    if (wallets.length === 0) {
        return;
    }

    for (const wallet of wallets) {
        await upsertWallet(wallet);
    }
};

const getWalletsByUserId = async (userId: string): Promise<IWallet[]> => {
    const result = await prisma.wallet.findMany({
        where: { userId },
        orderBy: { updatedAt: "desc" },
        take: 200,
    });

    return result.map(mapRow);
};

const getWalletSummaryByUserId = async (
    userId: string,
): Promise<IWalletSummary> => {
    const [walletRows, totals] = await Promise.all([
        prisma.wallet.findMany({
            where: { userId },
            orderBy: { updatedAt: "desc" },
        }),
        prisma.wallet.aggregate({
            where: { userId },
            _sum: { amount: true },
        }),
    ]);

    const wallets = walletRows.map(mapRow);

    return {
        wallets,
        totalAmount: Number(totals._sum.amount || 0),
    };
};

const getWalletById = async (
    userId: string,
    walletId: string,
    executor?: DbExecutor,
): Promise<IWallet | undefined> => {
    const db = getExecutor(executor);
    const result = await db.wallet.findFirst({
        where: { userId, id: walletId },
        orderBy: { updatedAt: "desc" },
    });

    return result ? mapRow(result) : undefined;
};

const findWalletByUserAndName = async (
    userId: string,
    walletName: string,
): Promise<IWallet | undefined> => {
    const result = await prisma.wallet.findFirst({
        where: { userId, name: walletName },
        orderBy: { updatedAt: "desc" },
    });

    return result ? mapRow(result) : undefined;
};

const updateWalletBalance = async (
    userId: string,
    walletId: string,
    nextBalance: number,
    executor?: DbExecutor,
): Promise<IWallet | undefined> => {
    const wallet = await getWalletById(userId, walletId, executor);
    if (!wallet) {
        return undefined;
    }

    const updatedWallet: IWallet = {
        ...wallet,
        balance: nextBalance,
        updatedAt: Date.now(),
    };

    await upsertWallet(updatedWallet, executor);
    return updatedWallet;
};

const setWalletActive = async (
    userId: string,
    walletId: string,
    isActive: boolean,
): Promise<IWallet | undefined> => {
    const wallet = await getWalletById(userId, walletId);
    if (!wallet) {
        return undefined;
    }

    const updatedWallet: IWallet = {
        ...wallet,
        isActive,
        updatedAt: Date.now(),
    };

    await upsertWallet(updatedWallet);
    return updatedWallet;
};

export {
    getWalletsByUserId,
    getWalletById,
    findWalletByUserAndName,
    updateWalletBalance,
    setWalletActive,
    upsertWallet,
    upsertWalletsBulk,
    getWalletSummaryByUserId,
    createWalletLog,
    getWalletLogsByWalletId,
};

const mapWalletLogRow = (row: {
    id: string;
    walletId: string;
    transactionId: string | null;
    action: string;
    amount: unknown;
    balanceBefore: unknown;
    balanceAfter: unknown;
    description: string | null;
    createdAt: bigint;
}): IWalletLog => ({
    id: String(row.id),
    walletId: String(row.walletId),
    transactionId: row.transactionId ?? undefined,
    action: String(row.action),
    amount: Number(row.amount || 0),
    balanceBefore: Number(row.balanceBefore || 0),
    balanceAfter: Number(row.balanceAfter || 0),
    description: row.description ?? undefined,
    createdAt: Number(row.createdAt || 0n),
});

const createWalletLog = async (
    data: Omit<IWalletLog, 'id'>,
    executor?: DbExecutor,
): Promise<void> => {
    const db = getExecutor(executor);
    await db.walletLog.create({
        data: {
            walletId: data.walletId,
            transactionId: data.transactionId ?? null,
            action: data.action,
            amount: data.amount,
            balanceBefore: data.balanceBefore,
            balanceAfter: data.balanceAfter,
            description: data.description ?? null,
            createdAt: BigInt(data.createdAt),
        },
    });
};

const getWalletLogsByWalletId = async (
    userId: string,
    walletId: string,
    page: number,
    limit: number,
): Promise<IWalletLogPage> => {
    const wallet = await getWalletById(userId, walletId);
    if (!wallet) {
        const error = new Error("Wallet not found.");
        (error as Error & { statusCode?: number }).statusCode = 404;
        throw error;
    }

    const offset = (page - 1) * limit;
    const [total, rows] = await Promise.all([
        prisma.walletLog.count({ where: { walletId } }),
        prisma.walletLog.findMany({
            where: { walletId },
            orderBy: { createdAt: "desc" },
            take: limit,
            skip: offset,
        }),
    ]);

    return {
        items: rows.map(mapWalletLogRow),
        page,
        limit,
        total,
        hasMore: offset + rows.length < total,
    };
};
