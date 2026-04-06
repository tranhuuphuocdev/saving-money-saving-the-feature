import { IWallet, IWalletLog, IWalletLogPage, IWalletSummary } from "../interfaces/transaction.interface";
import { DbExecutor, prisma } from "../lib/prisma";

const getExecutor = (executor?: DbExecutor) => executor || prisma;

const mapRow = (row: {
    id: string;
    name: string;
    type: string;
    amount: unknown;
    createdAt: bigint;
    updatedAt: bigint;
    isActive?: boolean;
}, userId?: string): IWallet => {
    return {
        id: String(row.id),
        userId: userId || "",
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
            name: wallet.name,
            type: wallet.type,
            amount: wallet.balance,
            createdAt: BigInt(wallet.createdAt),
            updatedAt: BigInt(wallet.updatedAt),
            isActive: wallet.isActive !== false,
            userWallets: {
                create: {
                    userId: wallet.userId,
                    role: "owner",
                    orderIndex: 0,
                    createdAt: BigInt(wallet.createdAt),
                    updatedAt: BigInt(wallet.updatedAt),
                }
            }
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
    const result = await prisma.userWallet.findMany({
        where: { userId },
        include: { wallet: true },
        orderBy: { orderIndex: "asc" },
        take: 200,
    });

    return result.map(uw => mapRow(uw.wallet, userId));
};

const getWalletSummaryByUserId = async (
    userId: string,
): Promise<IWalletSummary> => {
    const [userWallets, totals] = await Promise.all([
        prisma.userWallet.findMany({
            where: { userId },
            include: { wallet: true },
            orderBy: { orderIndex: "asc" },
        }),
        prisma.wallet.aggregate({
            where: {
                userWallets: {
                    some: { userId }
                }
            },
            _sum: { amount: true },
        }),
    ]);

    const wallets = userWallets.map(uw => mapRow(uw.wallet, userId));

    return {
        wallets,
        totalAmount: Number(totals._sum.amount || 0),
        requiresInitialSetup: false,
    };
};

const getWalletById = async (
    userId: string,
    walletId: string,
    executor?: DbExecutor,
): Promise<IWallet | undefined> => {
    const db = getExecutor(executor);
    const userWallet = await db.userWallet.findFirst({
        where: { userId, walletId },
        include: { wallet: true }
    });

    return userWallet ? mapRow(userWallet.wallet, userId) : undefined;
};

const findWalletByUserAndName = async (
    userId: string,
    walletName: string,
): Promise<IWallet | undefined> => {
    const userWallet = await prisma.userWallet.findFirst({
        where: { 
            userId, 
            wallet: { name: walletName }
        },
        include: { wallet: true }
    });

    return userWallet ? mapRow(userWallet.wallet, userId) : undefined;
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

    const db = getExecutor(executor);
    const updatedWallet = await db.wallet.update({
        where: { id: walletId },
        data: {
            amount: nextBalance,
            updatedAt: BigInt(Date.now()),
        }
    });

    return mapRow(updatedWallet, userId);
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

    const updatedWallet = await prisma.wallet.update({
        where: { id: walletId },
        data: {
            isActive,
            updatedAt: BigInt(Date.now()),
        }
    });

    return mapRow(updatedWallet, userId);
};

const updateWalletName = async (
    userId: string,
    walletId: string,
    name: string,
    executor?: DbExecutor,
): Promise<IWallet | undefined> => {
    const wallet = await getWalletById(userId, walletId, executor);
    if (!wallet) {
        return undefined;
    }

    const db = getExecutor(executor);
    const updatedWallet = await db.wallet.update({
        where: { id: walletId },
        data: {
            name,
            updatedAt: BigInt(Date.now()),
        },
    });

    return mapRow(updatedWallet, userId);
};

const reorderWallet = async (
    userId: string,
    walletId: string,
    newOrderIndex: number,
): Promise<void> => {
    const userWallets = await prisma.userWallet.findMany({
        where: { userId },
        orderBy: [
            { orderIndex: "asc" },
            { createdAt: "asc" },
        ],
    });

    const fromIndex = userWallets.findIndex((row) => row.walletId === walletId);
    if (fromIndex < 0) {
        const error = new Error("Wallet not found.");
        (error as Error & { statusCode?: number }).statusCode = 404;
        throw error;
    }

    const boundedTargetIndex = Math.max(0, Math.min(newOrderIndex, userWallets.length - 1));
    const reordered = [...userWallets];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(boundedTargetIndex, 0, moved);

    const now = BigInt(Date.now());
    await prisma.$transaction(
        reordered.map((row, index) =>
            prisma.userWallet.update({
                where: {
                    userId_walletId: {
                        userId,
                        walletId: row.walletId,
                    },
                },
                data: {
                    orderIndex: index,
                    updatedAt: now,
                },
            }),
        ),
    );
};

const shareWalletWithUser = async (
    walletId: string,
    targetUserId: string,
    role: string = "contributor",
): Promise<void> => {
    await prisma.userWallet.create({
        data: {
            userId: targetUserId,
            walletId,
            role,
            orderIndex: 999, // Add to end of list
            createdAt: BigInt(Date.now()),
            updatedAt: BigInt(Date.now()),
        }
    });
};

export {
    getWalletsByUserId,
    getWalletById,
    findWalletByUserAndName,
    updateWalletBalance,
    updateWalletName,
    setWalletActive,
    upsertWallet,
    upsertWalletsBulk,
    getWalletSummaryByUserId,
    createWalletLog,
    getWalletLogsByWalletId,
    reorderWallet,
    shareWalletWithUser,
};

const mapWalletLogRow = (row: {
    id: string;
    walletId: string;
    transactionId: string | null;
    createdBy?: string | null;
    actorDisplayName?: string | null;
    actorUsername?: string | null;
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
    createdBy: row.createdBy ?? undefined,
    actorDisplayName: row.actorDisplayName ?? undefined,
    actorUsername: row.actorUsername ?? undefined,
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
            createdBy: data.createdBy ?? null,
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
    startTime?: number,
    endTime?: number,
): Promise<IWalletLogPage> => {
    const wallet = await getWalletById(userId, walletId);
    if (!wallet) {
        const error = new Error("Wallet not found.");
        (error as Error & { statusCode?: number }).statusCode = 404;
        throw error;
    }

    const offset = (page - 1) * limit;
    const where = {
        walletId,
        ...(startTime || endTime ? {
            createdAt: {
                ...(startTime ? { gte: BigInt(startTime) } : {}),
                ...(endTime ? { lte: BigInt(endTime) } : {}),
            },
        } : {}),
    };

    const [total, rows] = await Promise.all([
        prisma.walletLog.count({ where }),
        prisma.walletLog.findMany({
            where,
            orderBy: { createdAt: "desc" },
            take: limit,
            skip: offset,
        }),
    ]);

    const transactionIds = Array.from(
        new Set(
            rows
                .map((row) => row.transactionId)
                .filter((value): value is string => Boolean(value)),
        ),
    );

    const transactions = transactionIds.length > 0
        ? await prisma.transaction.findMany({
            where: {
                id: {
                    in: transactionIds,
                },
            },
            select: {
                id: true,
                userName: true,
                userId: true,
            },
        })
        : [];

    const actorNameMap = transactions.reduce<Record<string, string>>((acc, item) => {
        acc[item.id] = item.userName || "";
        return acc;
    }, {});

    const actorUserIdMap = transactions.reduce<Record<string, string>>((acc, item) => {
        acc[item.id] = item.userId;
        return acc;
    }, {});

    const createdByUserIds = rows
        .map((row) => row.createdBy)
        .filter((value): value is string => Boolean(value));

    const uniqueUserIds = Array.from(
        new Set(
            [
                ...transactions.map((t) => t.userId),
                ...createdByUserIds,
            ].filter(Boolean),
        ),
    );

    const users = uniqueUserIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: uniqueUserIds } },
            select: { id: true, username: true, displayName: true },
        })
        : [];

    const userDisplayNameMap = users.reduce<Record<string, string>>((acc, u) => {
        acc[u.id] = (u.displayName || "").trim() || u.username;
        return acc;
    }, {});

    const userUsernameMap = users.reduce<Record<string, string>>((acc, u) => {
        acc[u.id] = u.username;
        return acc;
    }, {});

    return {
        items: rows.map((row) => {
            const actorId = row.createdBy || undefined;
            const actorUserId = row.transactionId ? actorUserIdMap[row.transactionId] : undefined;
            return mapWalletLogRow({
                ...row,
                actorDisplayName: actorId
                    ? userDisplayNameMap[actorId]
                    : row.transactionId
                      ? actorNameMap[row.transactionId]
                      : undefined,
                actorUsername: actorId
                    ? userUsernameMap[actorId]
                    : actorUserId
                      ? userUsernameMap[actorUserId]
                      : undefined,
            });
        }),
        page,
        limit,
        total,
        hasMore: offset + rows.length < total,
    };
};
