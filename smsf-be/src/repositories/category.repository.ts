import { randomUUID } from "node:crypto";
import { ICategory, TypeCategoryKind } from "../interfaces/category.interface";
import { prisma } from "../lib/prisma";

const mapRow = (row: {
    id: string;
    userId: string;
    name: string;
    icon: string | null;
    type: string;
    orderIndex?: number;
    isDefault: boolean;
    isDeleted: boolean;
    createdAt: bigint;
    updatedAt: bigint;
}): ICategory => {
    return {
        id: String(row.id),
        userId: String(row.userId),
        name: String(row.name),
        icon: row.icon ? String(row.icon) : undefined,
        type: String(row.type) as TypeCategoryKind,
        orderIndex: Number(row.orderIndex || 0),
        isDefault: Boolean(row.isDefault),
        isDeleted: Boolean(row.isDeleted),
        createdAt: Number(row.createdAt || 0n),
        updatedAt: Number(row.updatedAt || 0n),
    };
};

const listCategoriesByUser = async (
    userId: string,
    type?: TypeCategoryKind,
): Promise<ICategory[]> => {
    const result = await prisma.category.findMany({
        where: {
            isDeleted: false,
            userId: String(userId),
            ...(type ? { type } : {}),
        },
        orderBy: [
            { orderIndex: "asc" },
            { updatedAt: "desc" },
        ],
        take: 200,
    });

    return result.map(mapRow);
};

const findCategoryByUserAndName = async (
    userId: string,
    name: string,
    type: TypeCategoryKind,
): Promise<ICategory | undefined> => {
    const result = await prisma.category.findFirst({
        where: {
            type,
            name,
            isDeleted: false,
            userId: String(userId),
        },
        orderBy: [
            { orderIndex: "asc" },
            { updatedAt: "desc" },
        ],
    });

    return result ? mapRow(result) : undefined;
};

const findCategoryByIdForUser = async (
    userId: string,
    categoryId: string,
): Promise<ICategory | undefined> => {
    const result = await prisma.category.findFirst({
        where: {
            id: categoryId,
            isDeleted: false,
            userId: String(userId),
        },
        orderBy: [
            { orderIndex: "asc" },
            { updatedAt: "desc" },
        ],
    });

    return result ? mapRow(result) : undefined;
};

const createCategoryForUser = async (
    userId: string,
    name: string,
    type: TypeCategoryKind,
    icon?: string,
    orderIndex = 0,
    isDefault = false,
): Promise<ICategory> => {
    const now = Date.now();
    const category: ICategory = {
        id: randomUUID(),
        userId,
        name,
        icon,
        type,
        orderIndex,
        isDefault,
        isDeleted: false,
        createdAt: now,
        updatedAt: now,
    };

    await prisma.category.create({
        data: {
            id: category.id,
            userId: String(category.userId),
            name: category.name,
            icon: category.icon || null,
            type: category.type,
            orderIndex: category.orderIndex,
            isDefault: category.isDefault,
            isDeleted: category.isDeleted,
            createdAt: BigInt(category.createdAt),
            updatedAt: BigInt(category.updatedAt),
        },
    });

    return category;
};

const getMaxOrderIndexByUserAndType = async (
    userId: string,
    type: TypeCategoryKind,
): Promise<number> => {
    const result = await prisma.$queryRaw<Array<{ max_index: number | null }>>`
        SELECT MAX(cate_index)::int AS max_index
        FROM categories
        WHERE u_id = ${String(userId)}
          AND cate_type = ${type}
          AND is_deleted = false
    `;

    return Number(result?.[0]?.max_index || 0);
};

const reorderCategoriesByUser = async (
    userId: string,
    items: Array<{ id: string; orderIndex: number }>,
): Promise<void> => {
    const now = Date.now();

    await prisma.$transaction(
        items.map((item) =>
            prisma.category.updateMany({
                where: {
                    id: item.id,
                    userId: String(userId),
                    isDeleted: false,
                },
                data: {
                    orderIndex: item.orderIndex,
                    updatedAt: BigInt(now),
                },
            }),
        ),
    );
};

export {
    listCategoriesByUser,
    findCategoryByUserAndName,
    findCategoryByIdForUser,
    createCategoryForUser,
    getMaxOrderIndexByUserAndType,
    reorderCategoriesByUser,
};
