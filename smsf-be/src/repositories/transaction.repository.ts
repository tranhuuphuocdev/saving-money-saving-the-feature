import {
    ICreateTransactionPayload,
    IPaginatedTransactions,
    ISpendingTrendPoint,
    ITransaction,
    ITransactionQueryParams,
    IUpdateTransactionPayload,
} from "../interfaces/transaction.interface";
import { esClient, withPrefix } from "../lib/es-client";
import { TIME_FRAME_FORMAT, buildIndexName } from "../util";

const buildId = (): string => {
    return `txn-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
};

const transactionAlias = withPrefix("transaction");

const transactionIndexByTimestamp = (timestamp: number): string => {
    return withPrefix(
        buildIndexName("transaction-", timestamp, TIME_FRAME_FORMAT.MONTH),
    );
};

const mapTransactionSource = (
    source: Record<string, unknown>,
): ITransaction => {
    return {
        id: String(source.txnId),
        userId: String(source.uId),
        userDisplayName: source.uName ? String(source.uName) : undefined,
        walletId: String(source.wId),
        amount: Number(source.amount || 0),
        category: String(source.cateId),
        categoryName: source.cateName ? String(source.cateName) : undefined,
        budgetName: source.bName
            ? String(source.bName)
            : source.bName
              ? String(source.bName)
              : undefined,
        description: source.note ? String(source.note) : undefined,
        type: String(source.txnType) as ITransaction["type"],
        timestamp: Number(source.txnAt),
        createdAt: Number(source.createdAt),
        updatedAt: Number(source.updatedAt),
    };
};

const getTransactionsByUserAndMonth = (
    userId: string,
    month: number,
    year: number,
): Promise<ITransaction[]> => {
    const from = new Date(year, month - 1, 1).getTime();
    const to = new Date(year, month, 1).getTime() - 1;
    const indexName = transactionIndexByTimestamp(from);

    return esClient
        .post(`/${indexName}/_search`, {
            size: 500,
            query: {
                bool: {
                    filter: [
                        { term: { uId: String(userId) } },
                        { range: { txnAt: { gte: from, lte: to } } },
                    ],
                    must_not: [{ term: { isDeleted: true } }],
                },
            },
            sort: [{ txnAt: { order: "desc" } }],
        })
        .then((response) => {
            const hits =
                (response.data?.hits?.hits as Array<{
                    _source: Record<string, unknown>;
                }>) || [];

            return hits.map((hit) => mapTransactionSource(hit._source));
        })
        .catch((error) => {
            if (
                (error as { response?: { status?: number } }).response?.status ===
                404
            ) {
                return [];
            }

            throw error;
        });
};

const queryTransactionsByUser = (
    userId: string,
    queryParams: ITransactionQueryParams,
): Promise<IPaginatedTransactions> => {
    const {
        category,
        description,
        startTime,
        endTime,
        page,
        limit,
    } = queryParams;

    const from = (page - 1) * limit;
    const filters: Array<Record<string, unknown>> = [{ term: { uId: userId } }];

    if (category) {
        filters.push({ term: { cateId: category } });
    }

    if (startTime !== undefined || endTime !== undefined) {
        const range: Record<string, number> = {};
        if (startTime !== undefined) {
            range.gte = startTime;
        }
        if (endTime !== undefined) {
            range.lte = endTime;
        }
        filters.push({ range: { txnAt: range } });
    }

    const must: Array<Record<string, unknown>> = [];
    if (description) {
        must.push({
            match_phrase: {
                note: description,
            },
        });
    }

    return esClient
        .post(`/${transactionAlias}/_search`, {
            from,
            size: limit,
            track_total_hits: true,
            query: {
                bool: {
                    filter: filters,
                    must,
                    must_not: [{ term: { isDeleted: true } }],
                },
            },
            sort: [{ txnAt: { order: "desc" } }],
        })
        .then((response) => {
            const hits =
                (response.data?.hits?.hits as Array<{
                    _source: Record<string, unknown>;
                }>) || [];

            const totalRaw = response.data?.hits?.total;
            const total =
                typeof totalRaw === "number"
                    ? totalRaw
                    : Number(totalRaw?.value || 0);

            return {
                items: hits.map((hit) => mapTransactionSource(hit._source)),
                page,
                limit,
                total,
                hasMore: from + hits.length < total,
            };
        })
        .catch((error) => {
            if (
                (error as { response?: { status?: number } }).response?.status ===
                404
            ) {
                return {
                    items: [],
                    page,
                    limit,
                    total: 0,
                    hasMore: false,
                };
            }

            throw error;
        });
};

const getTransactionById = (
    userId: string,
    transactionId: string,
): Promise<(ITransaction & { _index: string }) | undefined> => {
    return esClient
        .post(`/${transactionAlias}/_search`, {
            size: 1,
            query: {
                bool: {
                    filter: [
                        { term: { uId: String(userId) } },
                        { term: { txnId: transactionId } },
                    ],
                },
            },
            sort: [{ updatedAt: { order: "desc" } }],
        })
        .then((response) => {
            const hit = response.data?.hits?.hits?.[0];
            if (!hit?._source) {
                return undefined;
            }

            return {
                ...mapTransactionSource(hit._source),
                _index: String(hit._index),
            };
        });
};

const createTransaction = (
    userId: string,
    payload: ICreateTransactionPayload,
    metadata: {
        userDisplayName: string;
        categoryName: string;
        budgetName: string;
    },
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

    const indexName = transactionIndexByTimestamp(transaction.timestamp);

    return esClient
        .put(`/${indexName}/_doc/${transaction.id}?refresh=true`, {
            txnId: transaction.id,
            uId: String(transaction.userId),
            uName: transaction.userDisplayName || "",
            wId: transaction.walletId,
            cateId: transaction.category,
            cateName: transaction.categoryName || "",
            bName: transaction.budgetName || "",
            txnType: transaction.type,
            amount: transaction.amount,
            note: transaction.description || "",
            txnAt: transaction.timestamp,
            createdAt: transaction.createdAt,
            updatedAt: transaction.updatedAt,
            isDeleted: false,
        })
        .then(() => transaction);
};

const createTransactionsBulk = (
    userId: string,
    payloads: ICreateTransactionPayload[],
    metadataItems: Array<{
        userDisplayName: string;
        categoryName: string;
        budgetName: string;
    }>,
): Promise<ITransaction[]> => {
    if (payloads.length === 0) {
        return Promise.resolve([]);
    }

    const now = Date.now();
    const transactions = payloads.map((payload, index) => {
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

    const operations = transactions.flatMap((transaction) => {
        const indexName = transactionIndexByTimestamp(transaction.timestamp);
        return [
            {
                index: {
                    _index: indexName,
                    _id: transaction.id,
                },
            },
            {
                txnId: transaction.id,
                uId: String(transaction.userId),
                uName: transaction.userDisplayName || "",
                wId: transaction.walletId,
                cateId: transaction.category,
                cateName: transaction.categoryName || "",
                bName: transaction.budgetName || "",
                txnType: transaction.type,
                amount: transaction.amount,
                note: transaction.description || "",
                txnAt: transaction.timestamp,
                createdAt: transaction.createdAt,
                updatedAt: transaction.updatedAt,
                isDeleted: false,
            },
        ];
    });

    return esClient
        .post(
            "/_bulk?refresh=true",
            operations.map((line) => JSON.stringify(line)).join("\n") + "\n",
            {
                headers: {
                    "Content-Type": "application/x-ndjson",
                },
            },
        )
        .then(() => transactions);
};

const updateTransaction = (
    userId: string,
    transactionId: string,
    payload: IUpdateTransactionPayload,
    metadata: {
        userDisplayName: string;
        categoryName: string;
        budgetName: string;
    },
): Promise<ITransaction | undefined> => {
    return getTransactionById(userId, transactionId).then((transaction) => {
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

        const nextIndex = transactionIndexByTimestamp(transaction.timestamp);

        return esClient
            .put(`/${nextIndex}/_doc/${transaction.id}?refresh=true`, {
                txnId: transaction.id,
                uId: String(transaction.userId),
                uName: transaction.userDisplayName || "",
                wId: transaction.walletId,
                cateId: transaction.category,
                cateName: transaction.categoryName || "",
                bName: transaction.budgetName || "",
                txnType: transaction.type,
                amount: transaction.amount,
                note: transaction.description || "",
                txnAt: transaction.timestamp,
                createdAt: transaction.createdAt,
                updatedAt: transaction.updatedAt,
                isDeleted: false,
            })
            .then(async () => {
                if (nextIndex !== transaction._index) {
                    try {
                        await esClient.delete(
                            `/${transaction._index}/_doc/${transaction.id}?refresh=true`,
                        );
                    } catch {
                        // noop
                    }
                }
                return transaction;
            });
    });
};

const deleteTransaction = (
    userId: string,
    transactionId: string,
): Promise<ITransaction | undefined> => {
    return getTransactionById(userId, transactionId).then(async (transaction) => {
        if (!transaction) {
            return undefined;
        }

        await esClient.delete(
            `/${transaction._index}/_doc/${transaction.id}?refresh=true`,
        );

        return transaction;
    });
};

const getSpendingTrendAggregationByMonth = async (
    userId: string,
    month: number,
    year: number,
): Promise<{ points: ISpendingTrendPoint[]; totalIncome: number }> => {
    const from = new Date(year, month - 1, 1).getTime();
    const to = new Date(year, month, 1).getTime() - 1;

    try {
        const response = await esClient.post(`/${transactionAlias}/_search`, {
            size: 0,
            query: {
                bool: {
                    filter: [
                        { term: { uId: String(userId) } },
                        { range: { txnAt: { gte: from, lte: to } } },
                    ],
                    must_not: [{ term: { isDeleted: true } }],
                },
            },
            aggs: {
                total_income: {
                    filter: { term: { txnType: "income" } },
                    aggs: {
                        amount: {
                            sum: { field: "amount" },
                        },
                    },
                },
                by_day: {
                    date_histogram: {
                        field: "txnAt",
                        calendar_interval: "day",
                        min_doc_count: 0,
                        extended_bounds: {
                            min: from,
                            max: to,
                        },
                    },
                    aggs: {
                        expense_amount: {
                            filter: { term: { txnType: "expense" } },
                            aggs: {
                                amount: {
                                    sum: { field: "amount" },
                                },
                            },
                        },
                        income_amount: {
                            filter: { term: { txnType: "income" } },
                            aggs: {
                                amount: {
                                    sum: { field: "amount" },
                                },
                            },
                        },
                    },
                },
            },
        });

        const buckets =
            (response.data?.aggregations?.by_day?.buckets as Array<Record<string, unknown>>) ||
            [];

        const points: ISpendingTrendPoint[] = buckets.map((bucket) => {
            const timestamp = Number(bucket.key || 0);
            const date = new Date(timestamp);

            return {
                day: date.getDate(),
                timestamp,
                expense: Number((bucket.expense_amount as { amount?: { value?: number } })?.amount?.value || 0),
                income: Number((bucket.income_amount as { amount?: { value?: number } })?.amount?.value || 0),
            };
        });

        const totalIncome = Number(
            response.data?.aggregations?.total_income?.amount?.value || 0,
        );

        return { points, totalIncome };
    } catch (error) {
        if ((error as { response?: { status?: number } }).response?.status === 404) {
            return { points: [], totalIncome: 0 };
        }

        throw error;
    }
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
