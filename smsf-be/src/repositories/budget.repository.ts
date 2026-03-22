import { randomUUID } from "node:crypto";
import { IBudget } from "../interfaces/budget.interface";
import { esClient, withPrefix } from "../lib/es-client";
import { TIME_FRAME_FORMAT, buildIndexName } from "../util";

interface IBudgetDocument extends IBudget {
    _index?: string;
}

const budgetAlias = withPrefix("budget");

const budgetIndexByPeriod = (month: number, year: number): string => {
    const timestamp = new Date(year, month - 1, 1, 12, 0, 0, 0).getTime();
    return withPrefix(buildIndexName("budget-", timestamp, TIME_FRAME_FORMAT.MONTH));
};

const mapBudgetSource = (source: Record<string, unknown>): IBudget => {
    return {
        id: String(source.bId),
        userId: String(source.uId),
        categoryId: String(source.cateId),
        name: String(source.budName),
        amount: Number(source.budAmount || 0),
        description: source.desc ? String(source.desc) : undefined,
        type: String(source.budType) as IBudget["type"],
        periodMonth: Number(source.periodMonth || 0),
        periodYear: Number(source.periodYear || 0),
        createdAt: Number(source.createdAt || 0),
        updatedAt: Number(source.updatedAt || 0),
    };
};

const getSavingBudgetByUserAndMonth = async (
    userId: string,
    month: number,
    year: number,
): Promise<IBudgetDocument | undefined> => {
    try {
        const response = await esClient.post(`/${budgetAlias}/_search`, {
            size: 1,
            query: {
                bool: {
                    filter: [
                        { term: { uId: String(userId) } },
                        { term: { budType: "saving" } },
                        { term: { periodMonth: month } },
                        { term: { periodYear: year } },
                    ],
                },
            },
            sort: [{ updatedAt: { order: "desc" } }],
        });

        const hit = response.data?.hits?.hits?.[0] as
            | { _index: string; _source: Record<string, unknown> }
            | undefined;

        if (!hit?._source) {
            return undefined;
        }

        return {
            ...mapBudgetSource(hit._source),
            _index: String(hit._index),
        };
    } catch (error) {
        if ((error as { response?: { status?: number } }).response?.status === 404) {
            return undefined;
        }

        throw error;
    }
};

const upsertSavingBudgetByUser = async (
    userId: string,
    categoryId: string,
    month: number,
    year: number,
    amount: number,
): Promise<IBudget> => {
    const existing = await getSavingBudgetByUserAndMonth(userId, month, year);
    const now = Date.now();

    const budget: IBudget = {
        id: existing?.id || randomUUID(),
        userId,
        categoryId,
        name: `Mục tiêu tiết kiệm ${String(month).padStart(2, "0")}/${year}`,
        amount,
        description: "Mỗi đồng giữ lại hôm nay là thêm một bước tự do tài chính ✨",
        type: "saving",
        periodMonth: month,
        periodYear: year,
        createdAt: existing?.createdAt || now,
        updatedAt: now,
    };

    const indexName = budgetIndexByPeriod(month, year);

    await esClient.put(`/${indexName}/_doc/${budget.id}?refresh=true`, {
        bId: budget.id,
        uId: budget.userId,
        cateId: budget.categoryId,
        budName: budget.name,
        budAmount: budget.amount,
        desc: budget.description || "",
        budType: budget.type,
        periodMonth: budget.periodMonth,
        periodYear: budget.periodYear,
        createdAt: budget.createdAt,
        updatedAt: budget.updatedAt,
    });

    if (existing?._index && existing._index !== indexName) {
        try {
            await esClient.delete(`/${existing._index}/_doc/${existing.id}?refresh=true`);
        } catch {
            // noop
        }
    }

    return budget;
};

export { getSavingBudgetByUserAndMonth, upsertSavingBudgetByUser };