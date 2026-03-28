import { ICategory, TypeCategoryKind } from "../interfaces/category.interface";
import {
    createCategoryForUser,
    findCategoryByIdForUser,
    findCategoryByUserAndName,
    listCategoriesByUser,
} from "../repositories/category.repository";

const getCategoriesByUser = (
    userId: string,
    type?: TypeCategoryKind,
): Promise<ICategory[]> => {
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

    return createCategoryForUser(userId, normalizedName, type, icon);
};

const getCategoryById = async (userId: string, categoryId: string): Promise<ICategory | undefined> => {
    if (!categoryId) {
        return undefined;
    }

    return findCategoryByIdForUser(userId, categoryId);
};

export {
    getCategoriesByUser,
    ensureCategoryByName,
    getCategoryById,
    createCustomCategoryForUser,
};
