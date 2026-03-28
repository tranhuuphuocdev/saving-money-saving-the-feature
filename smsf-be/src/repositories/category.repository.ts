import { randomUUID } from "node:crypto";
import { ICategory, TypeCategoryKind } from "../interfaces/category.interface";
import { prisma } from "../lib/prisma";

const mapRow = (row: {
    id: string;
    userId: string;
    name: string;
    icon: string | null;
    type: string;
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
            OR: [
                { isDefault: true },
                { userId: String(userId) },
            ],
            ...(type ? { type } : {}),
        },
        orderBy: [
            { isDefault: "desc" },
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
            OR: [
                { isDefault: true },
                { userId: String(userId) },
            ],
        },
        orderBy: [
            { isDefault: "desc" },
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
            OR: [
                { isDefault: true },
                { userId: String(userId) },
            ],
        },
        orderBy: [
            { isDefault: "desc" },
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
): Promise<ICategory> => {
    const now = Date.now();
    const category: ICategory = {
        id: randomUUID(),
        userId,
        name,
        icon,
        type,
        isDefault: false,
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
            isDefault: category.isDefault,
            isDeleted: category.isDeleted,
            createdAt: BigInt(category.createdAt),
            updatedAt: BigInt(category.updatedAt),
        },
    });

    return category;
};

export {
    listCategoriesByUser,
    findCategoryByUserAndName,
    findCategoryByIdForUser,
    createCategoryForUser,
};
