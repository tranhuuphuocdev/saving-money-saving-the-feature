import { ICategory, TypeCategoryKind } from "../interfaces/category.interface";
import {
    createCategoryForUser,
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

export { getCategoriesByUser, ensureCategoryByName };
