import {
    ICreateTransactionPayload,
    IPaginatedTransactions,
    ISpendingTrendPoint,
    ITransaction,
    ITransactionQueryParams,
    IUpdateTransactionPayload,
} from "../interfaces/transaction.interface";
import { Prisma } from "@prisma/client";
import { DbExecutor, prisma } from "../lib/prisma";

const getExecutor = (executor?: DbExecutor) => executor || prisma;

const buildId = (): string => {
    return `txn-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
};

const mapRow = (row: {
    id: string;
    userId: string;
    userName: string | null;
    walletId: string;
    amount: unknown;
    categoryId: string;
    categoryName: string | null;
    budgetName: string | null;
    note: string | null;
    type: string;
    transactionAt: bigint;
    createdAt: bigint;
    updatedAt: bigint;
}): ITransaction => {
    return {
        id: String(row.id),
        userId: String(row.userId),
        userDisplayName: row.userName ? String(row.userName) : undefined,
        walletId: String(row.walletId),
        amount: Number(row.amount || 0),
        category: String(row.categoryId),
        categoryName: row.categoryName ? String(row.categoryName) : undefined,
        budgetName: row.budgetName ? String(row.budgetName) : undefined,
        description: row.note ? String(row.note) : undefined,
        type: String(row.type) as ITransaction["type"],
        timestamp: Number(row.transactionAt),
        createdAt: Number(row.createdAt),
        updatedAt: Number(row.updatedAt),
    };
};

const getTransactionsByUserAndMonth = async (
    userId: string,
    month: number,
    year: number,
): Promise<ITransaction[]> => {
    const from = new Date(year, month - 1, 1).getTime();
    const to = new Date(year, month, 1).getTime() - 1;

    const result = await prisma.transaction.findMany({
        where: {
            userId,
            transactionAt: {
                gte: BigInt(from),
                lte: BigInt(to),
            },
            isDeleted: false,
        },
        orderBy: { transactionAt: "desc" },
        take: 500,
    });

    return result.map(mapRow);
};

const queryTransactionsByUser = async (
    userId: string,
    queryParams: ITransactionQueryParams,
): Promise<IPaginatedTransactions> => {
    const { category, categories, description, startTime, endTime, page, limit } = queryParams;
    const offset = (page - 1) * limit;
    const where: Prisma.TransactionWhereInput = {
        userId,
        isDeleted: false,
    };

    if (categories && categories.length > 0) {
        where.categoryId = { in: categories };
    } else if (category) {
        where.categoryId = category;
    }

    if (startTime !== undefined || endTime !== undefined) {
        where.transactionAt = {
            ...(startTime !== undefined ? { gte: BigInt(startTime) } : {}),
            ...(endTime !== undefined ? { lte: BigInt(endTime) } : {}),
        };
    }

    if (description) {
        where.note = {
            contains: description,
            mode: "insensitive",
        };
    }

    const [total, result] = await Promise.all([
        prisma.transaction.count({ where }),
        prisma.transaction.findMany({
            where,
            orderBy: { transactionAt: "desc" },
            take: limit,
            skip: offset,
        }),
    ]);

    const txnIds = result.map((r) => r.id);
    const walletLogs = txnIds.length > 0
        ? await prisma.walletLog.findMany({
            where: { transactionId: { in: txnIds } },
            select: { transactionId: true, balanceBefore: true, balanceAfter: true },
        })
        : [];
    const logMap = walletLogs.reduce<Record<string, { balanceBefore: number; balanceAfter: number }>>((acc, log) => {
        if (log.transactionId) {
            acc[log.transactionId] = {
                balanceBefore: Number(log.balanceBefore || 0),
                balanceAfter: Number(log.balanceAfter || 0),
            };
        }
        return acc;
    }, {});

    return {
        items: result.map((row) => ({
            ...mapRow(row),
            ...logMap[row.id],
        })),
        page,
        limit,
        total,
        hasMore: offset + result.length < total,
    };
};

const getTransactionById = async (
    userId: string,
    transactionId: string,
    executor?: DbExecutor,
): Promise<ITransaction | undefined> => {
    const db = getExecutor(executor);
    const result = await db.transaction.findFirst({
        where: {
            userId,
            id: transactionId,
        },
        orderBy: { updatedAt: "desc" },
    });

    return result ? mapRow(result) : undefined;
};

const createTransaction = async (
    userId: string,
    payload: ICreateTransactionPayload,
    metadata: {
        userDisplayName: string;
        categoryName: string;
        budgetName: string;
    },
    executor?: DbExecutor,
): Promise<ITransaction> => {
    const now = Date.now();

    const transaction: ITransaction = {
        id: buildId(),
        userId,
        userDisplayName: metadata.userDisplayName,
        walletId: payload.walletId,
        amount: payload.amount,
        category: payload.category,
        categoryName: metadata.categoryName,
        budgetName: metadata.budgetName,
        description: payload.description,
        type: payload.type,
        timestamp: payload.timestamp,
        createdAt: now,
        updatedAt: now,
    };

    const db = getExecutor(executor);

    await db.transaction.create({
        data: {
            id: transaction.id,
            userId: transaction.userId,
            userName: transaction.userDisplayName || "",
            walletId: transaction.walletId,
            categoryId: transaction.category,
            categoryName: transaction.categoryName || "",
            budgetName: transaction.budgetName || "",
            type: transaction.type,
            amount: transaction.amount,
            note: transaction.description || "",
            transactionAt: BigInt(transaction.timestamp),
            createdAt: BigInt(transaction.createdAt),
            updatedAt: BigInt(transaction.updatedAt),
            isDeleted: false,
        },
    });

    return transaction;
};

const createTransactionsBulk = async (
    userId: string,
    payloads: ICreateTransactionPayload[],
    metadataItems: Array<{
        userDisplayName: string;
        categoryName: string;
        budgetName: string;
    }>,
    executor?: DbExecutor,
): Promise<ITransaction[]> => {
    if (payloads.length === 0) {
        return [];
    }

    const now = Date.now();
    const transactions: ITransaction[] = payloads.map((payload, index) => {
        const metadata = metadataItems[index];
        return {
            id: buildId(),
            userId,
            userDisplayName: metadata?.userDisplayName || userId,
            walletId: payload.walletId,
            amount: payload.amount,
            category: payload.category,
            categoryName: metadata?.categoryName || payload.category,
            budgetName: metadata?.budgetName || "",
            description: payload.description,
            type: payload.type,
            timestamp: payload.timestamp,
            createdAt: now,
            updatedAt: now,
        };
    });

    const db = getExecutor(executor);

    for (const txn of transactions) {
        await db.transaction.create({
            data: {
                id: txn.id,
                userId: txn.userId,
                userName: txn.userDisplayName || "",
                walletId: txn.walletId,
                categoryId: txn.category,
                categoryName: txn.categoryName || "",
                budgetName: txn.budgetName || "",
                type: txn.type,
                amount: txn.amount,
                note: txn.description || "",
                transactionAt: BigInt(txn.timestamp),
                createdAt: BigInt(txn.createdAt),
                updatedAt: BigInt(txn.updatedAt),
                isDeleted: false,
            },
        });
    }

    return transactions;
};

const updateTransaction = async (
    userId: string,
    transactionId: string,
    payload: IUpdateTransactionPayload,
    metadata: {
        userDisplayName: string;
        categoryName: string;
        budgetName: string;
    },
    executor?: DbExecutor,
): Promise<ITransaction | undefined> => {
    const transaction = await getTransactionById(userId, transactionId, executor);
    if (!transaction) {
        return undefined;
    }

    if (payload.walletId !== undefined) {
        transaction.walletId = payload.walletId;
    }
    if (payload.amount !== undefined) {
        transaction.amount = payload.amount;
    }
    if (payload.category !== undefined) {
        transaction.category = payload.category;
    }
    if (payload.description !== undefined) {
        transaction.description = payload.description;
    }
    if (payload.type !== undefined) {
        transaction.type = payload.type;
    }
    if (payload.timestamp !== undefined) {
        transaction.timestamp = payload.timestamp;
    }

    transaction.userDisplayName = metadata.userDisplayName;
    transaction.categoryName = metadata.categoryName;
    transaction.budgetName = metadata.budgetName;
    transaction.updatedAt = Date.now();

    const db = getExecutor(executor);

    await db.transaction.update({
        where: { id: transaction.id },
        data: {
            userName: transaction.userDisplayName || "",
            walletId: transaction.walletId,
            categoryId: transaction.category,
            categoryName: transaction.categoryName || "",
            budgetName: transaction.budgetName || "",
            type: transaction.type,
            amount: transaction.amount,
            note: transaction.description || "",
            transactionAt: BigInt(transaction.timestamp),
            updatedAt: BigInt(transaction.updatedAt),
        },
    });

    return transaction;
};

const deleteTransaction = async (
    userId: string,
    transactionId: string,
    executor?: DbExecutor,
): Promise<ITransaction | undefined> => {
    const transaction = await getTransactionById(userId, transactionId, executor);
    if (!transaction) {
        return undefined;
    }

    const db = getExecutor(executor);

    await db.transaction.delete({
        where: { id: transaction.id },
    });

    return transaction;
};

const getSpendingTrendAggregationByMonth = async (
    userId: string,
    month: number,
    year: number,
): Promise<{ points: ISpendingTrendPoint[]; totalIncome: number }> => {
    const from = new Date(year, month - 1, 1).getTime();
    const to = new Date(year, month, 1).getTime() - 1;
    const daysInMonth = new Date(year, month, 0).getDate();

    const result = await prisma.$queryRaw<
        Array<{ day: number; expense_amount: unknown; income_amount: unknown }>
    >`
        SELECT
            EXTRACT(DAY FROM to_timestamp("txn_at" / 1000.0) AT TIME ZONE 'UTC')::int AS day,
            COALESCE(SUM(CASE WHEN "txn_type" = 'expense' THEN "amount" ELSE 0 END), 0) AS expense_amount,
            COALESCE(SUM(CASE WHEN "txn_type" = 'income' THEN "amount" ELSE 0 END), 0) AS income_amount
        FROM "transactions"
                WHERE "u_id" = ${userId}::uuid
          AND "txn_at" >= ${BigInt(from)}
          AND "txn_at" <= ${BigInt(to)}
          AND "is_deleted" = false
        GROUP BY day
        ORDER BY day
    `;

    const dayMap = new Map<number, { expense: number; income: number }>();
    for (const row of result) {
        dayMap.set(Number(row.day), {
            expense: Number(row.expense_amount || 0),
            income: Number(row.income_amount || 0),
        });
    }

    const points: ISpendingTrendPoint[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
        const dayData = dayMap.get(d) || { expense: 0, income: 0 };
        const dayTimestamp = new Date(year, month - 1, d).getTime();
        points.push({
            day: d,
            timestamp: dayTimestamp,
            expense: dayData.expense,
            income: dayData.income,
        });
    }

    const incomeResult = await prisma.transaction.aggregate({
        where: {
            userId,
            transactionAt: {
                gte: BigInt(from),
                lte: BigInt(to),
            },
            type: "income",
            isDeleted: false,
        },
        _sum: {
            amount: true,
        },
    });

    const totalIncome = Number(incomeResult._sum.amount || 0);

    return { points, totalIncome };
};

export {
    getTransactionsByUserAndMonth,
    queryTransactionsByUser,
    getTransactionById,
    createTransaction,
    createTransactionsBulk,
    updateTransaction,
    deleteTransaction,
    getSpendingTrendAggregationByMonth,
};
