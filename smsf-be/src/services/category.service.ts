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

const getCategoryById = async (userId: string, categoryId: string): Promise<ICategory | undefined> => {
    if (!categoryId) {
        return undefined;
    }

    return findCategoryByIdForUser(userId, categoryId);
};

export { getCategoriesByUser, ensureCategoryByName, getCategoryById };
