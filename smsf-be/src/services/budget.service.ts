import { ISavingGoalSummary } from "../interfaces/budget.interface";
import {
    getSavingBudgetByUserAndMonth,
    upsertSavingBudgetByUser,
} from "../repositories/budget.repository";
import { ensureCategoryByName } from "./category.service";

const SAVING_CATEGORY_NAME = "Tiết kiệm";

const getSavingGoalByUser = async (
    userId: string,
    month: number,
    year: number,
): Promise<ISavingGoalSummary> => {
    const budget = await getSavingBudgetByUserAndMonth(userId, month, year);

    return {
        amount: budget?.amount || 0,
        month,
        year,
        categoryId: budget?.categoryId,
    };
};

const getSavingBudgetByUser = async (userId: string, month: number, year: number) => {
    return getSavingBudgetByUserAndMonth(userId, month, year);
};

const upsertSavingGoalByUser = async (
    userId: string,
    month: number,
    year: number,
    amount: number,
): Promise<ISavingGoalSummary> => {
    const savingCategory = await ensureCategoryByName(
        userId,
        SAVING_CATEGORY_NAME,
        "expense",
    );

    const budget = await upsertSavingBudgetByUser(
        userId,
        savingCategory.id,
        month,
        year,
        amount,
    );

    return {
        amount: budget.amount,
        month: budget.periodMonth,
        year: budget.periodYear,
        categoryId: budget.categoryId,
    };
};

export { getSavingGoalByUser, getSavingBudgetByUser, upsertSavingGoalByUser };