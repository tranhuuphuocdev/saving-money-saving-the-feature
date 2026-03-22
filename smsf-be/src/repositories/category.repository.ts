import { randomUUID } from "node:crypto";
import { ICategory, TypeCategoryKind } from "../interfaces/category.interface";
import { esClient, withPrefix } from "../lib/es-client";
import { TIME_FRAME_FORMAT, buildIndexName } from "../util";

const categoryAlias = withPrefix("category");

const categoryIndexByTimestamp = (timestamp: number): string => {
    return withPrefix(
        buildIndexName("category-", timestamp, TIME_FRAME_FORMAT.MONTH),
    );
};

const mapCategorySource = (source: Record<string, unknown>): ICategory => {
    return {
        id: String(source.cateId),
        userId: String(source.uId),
        name: String(source.cateName),
        type: String(source.cateType) as TypeCategoryKind,
        isDefault: Boolean(source.isDefault),
        isDeleted: Boolean(source.isDeleted),
        createdAt: Number(source.createdAt || 0),
        updatedAt: Number(source.updatedAt || 0),
    };
};

const listCategoriesByUser = async (
    userId: string,
    type?: TypeCategoryKind,
): Promise<ICategory[]> => {
    const filters: Array<Record<string, unknown>> = [];

    if (type) {
        filters.push({ term: { cateType: type } });
    }

    return esClient
        .post(`/${categoryAlias}/_search`, {
            size: 200,
            query: {
                bool: {
                    filter: filters,
                    should: [
                        { term: { isDefault: true } },
                        { term: { uId: String(userId) } },
                    ],
                    minimum_should_match: 1,
                    must_not: [{ term: { isDeleted: true } }],
                },
            },
            sort: [{ isDefault: { order: "desc" } }, { updatedAt: { order: "desc" } }],
        })
        .then((response) => {
            const hits =
                (response.data?.hits?.hits as Array<{
                    _source: Record<string, unknown>;
                }>) || [];

            return hits.map((hit) => mapCategorySource(hit._source));
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

const findCategoryByUserAndName = async (
    userId: string,
    name: string,
    type: TypeCategoryKind,
): Promise<ICategory | undefined> => {
    try {
        const response = await esClient.post(`/${categoryAlias}/_search`, {
            size: 1,
            query: {
                bool: {
                    filter: [{ term: { cateType: type } }],
                    should: [
                        { term: { isDefault: true } },
                        { term: { uId: String(userId) } },
                    ],
                    minimum_should_match: 1,
                    must: [
                        {
                            term: {
                                "cateName.keyword": name,
                            },
                        },
                    ],
                    must_not: [{ term: { isDeleted: true } }],
                },
            },
            sort: [{ isDefault: { order: "desc" } }, { updatedAt: { order: "desc" } }],
        });

        const hit = response.data?.hits?.hits?.[0] as
            | { _source: Record<string, unknown> }
            | undefined;

        return hit?._source ? mapCategorySource(hit._source) : undefined;
    } catch (error) {
        if ((error as { response?: { status?: number } }).response?.status === 404) {
            return undefined;
        }

        throw error;
    }
};

const createCategoryForUser = async (
    userId: string,
    name: string,
    type: TypeCategoryKind,
): Promise<ICategory> => {
    const now = Date.now();
    const category: ICategory = {
        id: randomUUID(),
        userId,
        name,
        type,
        isDefault: false,
        isDeleted: false,
        createdAt: now,
        updatedAt: now,
    };

    const indexName = categoryIndexByTimestamp(now);

    await esClient.put(`/${indexName}/_doc/${category.id}?refresh=true`, {
        cateId: category.id,
        uId: String(category.userId),
        cateName: category.name,
        cateType: category.type,
        createdAt: category.createdAt,
        updatedAt: category.updatedAt,
        isDefault: category.isDefault,
        isDeleted: category.isDeleted,
    });

    return category;
};

export { listCategoriesByUser, findCategoryByUserAndName, createCategoryForUser };
