import { IWallet, IWalletSummary } from "../interfaces/transaction.interface";
import { esClient, withPrefix } from "../lib/es-client";
import { TIME_FRAME_FORMAT, buildIndexName } from "../util";

const walletAlias = withPrefix("wallet");

const mapWalletSource = (source: Record<string, unknown>): IWallet => {
    return {
        id: String(source.wId),
        userId: String(source.uId),
        name: String(source.wName),
        type: String(source.wType || "cash"),
        balance: Number(source.amount || 0),
        createdAt: Number(source.createdAt),
        updatedAt: Number(source.updatedAt),
    };
};

const walletIndexByTimestamp = (timestamp: number): string => {
    return withPrefix(
        buildIndexName("wallet-", timestamp, TIME_FRAME_FORMAT.MONTH),
    );
};

const upsertWallet = async (wallet: IWallet): Promise<IWallet> => {
    const indexName = walletIndexByTimestamp(wallet.updatedAt || Date.now());

    await esClient.put(
        `/${indexName}/_doc/${wallet.id}?refresh=true`,
        {
            wId: wallet.id,
            uId: String(wallet.userId),
            wName: wallet.name,
            wType: wallet.type,
            amount: wallet.balance,
            createdAt: wallet.createdAt,
            updatedAt: wallet.updatedAt,
        },
    );

    return wallet;
};

const upsertWalletsBulk = async (wallets: IWallet[]): Promise<void> => {
    if (wallets.length === 0) {
        return;
    }

    const operations = wallets.flatMap((wallet) => {
        const indexName = walletIndexByTimestamp(wallet.updatedAt || Date.now());

        return [
            {
                index: {
                    _index: indexName,
                    _id: wallet.id,
                },
            },
            {
                wId: wallet.id,
                uId: String(wallet.userId),
                wName: wallet.name,
                wType: wallet.type,
                amount: wallet.balance,
                createdAt: wallet.createdAt,
                updatedAt: wallet.updatedAt,
            },
        ];
    });

    await esClient.post("/_bulk?refresh=true", operations.map((line) => JSON.stringify(line)).join("\n") + "\n", {
        headers: {
            "Content-Type": "application/x-ndjson",
        },
    });
};

const getWalletsByUserId = async (userId: string): Promise<IWallet[]> => {
    const response = await esClient.post(`/${walletAlias}/_search`, {
        size: 200,
        query: {
            term: {
                uId: String(userId),
            },
        },
        sort: [{ updatedAt: { order: "desc" } }],
    });

    const hits =
        (response.data?.hits?.hits as Array<{ _source: Record<string, unknown> }>) ||
        [];

    const seen = new Set<string>();
    const wallets: IWallet[] = [];

    for (const hit of hits) {
        const wallet = mapWalletSource(hit._source);
        if (!seen.has(wallet.id)) {
            seen.add(wallet.id);
            wallets.push(wallet);
        }
    }

    return wallets;
};

const getWalletSummaryByUserId = async (
    userId: string,
): Promise<IWalletSummary> => {
    const response = await esClient.post(`/${walletAlias}/_search`, {
        size: 0,
        query: {
            term: {
                uId: String(userId),
            },
        },
        aggs: {
            total_amount: {
                sum: {
                    field: "amount",
                },
            },
            wallets_by_id: {
                terms: {
                    field: "wId",
                    size: 200,
                },
                aggs: {
                    latest_wallet: {
                        top_hits: {
                            size: 1,
                            sort: [{ updatedAt: { order: "desc" } }],
                        },
                    },
                },
            },
        },
    });

    const buckets =
        (response.data?.aggregations?.wallets_by_id?.buckets as Array<{
            latest_wallet?: {
                hits?: {
                    hits?: Array<{ _source: Record<string, unknown> }>;
                };
            };
        }>) || [];

    const wallets = buckets
        .map((bucket) => bucket.latest_wallet?.hits?.hits?.[0]?._source)
        .filter(Boolean)
        .map((source) => mapWalletSource(source as Record<string, unknown>));

    return {
        wallets,
        totalAmount: response.data?.aggregations?.total_amount?.value || 0,
    };
};

const getWalletById = async (
    userId: string,
    walletId: string,
): Promise<IWallet | undefined> => {
    const response = await esClient.post(`/${walletAlias}/_search`, {
        size: 1,
        query: {
            bool: {
                filter: [
                    { term: { uId: String(userId) } },
                    { term: { wId: walletId } },
                ],
            },
        },
        sort: [{ updatedAt: { order: "desc" } }],
    });

    const hit = response.data?.hits?.hits?.[0];
    if (!hit?._source) {
        return undefined;
    }

    return mapWalletSource(hit._source);
};

const updateWalletBalance = async (
    userId: string,
    walletId: string,
    nextBalance: number,
): Promise<IWallet | undefined> => {
    const wallet = await getWalletById(userId, walletId);
    if (!wallet) {
        return undefined;
    }

    const updatedWallet: IWallet = {
        ...wallet,
        balance: nextBalance,
        updatedAt: Date.now(),
    };

    await upsertWallet(updatedWallet);
    return updatedWallet;
};

export {
    getWalletsByUserId,
    getWalletById,
    updateWalletBalance,
    upsertWallet,
    upsertWalletsBulk,
    getWalletSummaryByUserId,
};
