import { DEFAULT_CATEGORIES } from "../constants/default-categories";
import { ICategory, TypeCategoryKind } from "../interfaces/category.interface";
import {
    createCategoryForUser,
    findCategoryByIdForUser,
    findCategoryByUserAndName,
    getMaxOrderIndexByUserAndType,
    listCategoriesByUser,
    reorderCategoriesByUser,
} from "../repositories/category.repository";

const ensureDefaultCategoriesForUser = async (userId: string): Promise<void> => {
    const existing = await listCategoriesByUser(userId);
    if (existing.length > 0) {
        return;
    }

    for (const category of DEFAULT_CATEGORIES) {
        await createCategoryForUser(
            userId,
            category.name,
            category.type,
            category.icon,
            category.index,
            true,
        );
    }
};

const getCategoriesByUser = async (
    userId: string,
    type?: TypeCategoryKind,
): Promise<ICategory[]> => {
    await ensureDefaultCategoriesForUser(userId);
    return listCategoriesByUser(userId, type);
};

const ensureCategoryByName = async (
    userId: string,
    name: string,
    type: TypeCategoryKind,
): Promise<ICategory> => {
    const existing = await findCategoryByUserAndName(userId, name, type);

    if (existing) {
        return existing;
    }

    return createCategoryForUser(userId, name, type);
};

const createCustomCategoryForUser = async (
    userId: string,
    name: string,
    type: TypeCategoryKind,
    icon?: string,
): Promise<ICategory> => {
    const normalizedName = String(name || "").trim();

    if (!normalizedName) {
        const error = new Error("name is required.");
        (error as Error & { statusCode?: number }).statusCode = 400;
        throw error;
    }

    if (normalizedName.length > 64) {
        const error = new Error("name must be less than or equal to 64 characters.");
        (error as Error & { statusCode?: number }).statusCode = 400;
        throw error;
    }

    const existing = await findCategoryByUserAndName(userId, normalizedName, type);
    if (existing) {
        return existing;
    }

    const currentMax = await getMaxOrderIndexByUserAndType(userId, type);
    return createCategoryForUser(userId, normalizedName, type, icon, currentMax + 1, false);
};

const getCategoryById = async (userId: string, categoryId: string): Promise<ICategory | undefined> => {
    if (!categoryId) {
        return undefined;
    }

    return findCategoryByIdForUser(userId, categoryId);
};

const updateCategoryOrderByUser = async (
    userId: string,
    type: TypeCategoryKind,
    categoryIds: string[],
): Promise<void> => {
    const existing = await listCategoriesByUser(userId, type);
    if (existing.length === 0) {
        return;
    }

    const existingIdSet = new Set(existing.map((item) => item.id));
    if (categoryIds.some((id) => !existingIdSet.has(id))) {
        const error = new Error("category ids contain invalid item.");
        (error as Error & { statusCode?: number }).statusCode = 400;
        throw error;
    }

    const missingIds = existing.filter((item) => !categoryIds.includes(item.id)).map((item) => item.id);
    const normalizedIds = [...categoryIds, ...missingIds];

    await reorderCategoriesByUser(
        userId,
        normalizedIds.map((id, index) => ({
            id,
            orderIndex: index,
        })),
    );
};

export {
    getCategoriesByUser,
    ensureCategoryByName,
    getCategoryById,
    createCustomCategoryForUser,
    ensureDefaultCategoriesForUser,
    updateCategoryOrderByUser,
};
