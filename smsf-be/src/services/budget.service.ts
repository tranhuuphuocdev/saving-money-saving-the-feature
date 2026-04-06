import {
    IBudgetJar,
    IBudgetJarPreset,
    IBudgetJarPresetItem,
    IBudgetJarSetupPayload,
    ISavingGoalSummary,
} from "../interfaces/budget.interface";
import {
    getSavingBudgetByUserAndMonth,
    listJarBudgetsByUserAndMonth,
    recalculateJarBudgetSpendingByUserAndMonth,
    replaceJarBudgetsByUserAndMonth,
    upsertSavingBudgetByUser,
} from "../repositories/budget.repository";
import { DbExecutor } from "../lib/prisma";
import { ensureCategoryByName, getCategoriesByUser } from "./category.service";

const SAVING_CATEGORY_NAME = "Tiết kiệm";

const JAR_SUGGESTION_BASE: Array<{
    code: string;
    label: string;
    incomeHint: string;
    items: Array<{
        name: string;
        targetPercent: number;
        categoryNames: string[];
    }>;
}> = [
    {
        code: "basic-under-10",
        label: "Mức lương cơ bản",
        incomeHint: "Dưới 10 triệu VNĐ",
        items: [
            { name: "Thiết yếu", targetPercent: 65, categoryNames: ["Nhà cửa", "Ăn uống", "Di chuyển", "Đi chợ", "Hóa đơn"] },
            { name: "Tiết kiệm & Đầu tư", targetPercent: 15, categoryNames: ["Tiết kiệm", "Đầu tư"] },
            { name: "Phát triển bản thân", targetPercent: 10, categoryNames: ["Học tập", "Giáo dục", "Sức khỏe"] },
            { name: "Hưởng thụ", targetPercent: 5, categoryNames: ["Giải trí", "Mua sắm"] },
            { name: "Dự phòng", targetPercent: 5, categoryNames: ["Khác"] },
        ],
    },
    {
        code: "avg-10-15",
        label: "Mức lương trung bình",
        incomeHint: "10 - 15 triệu VNĐ",
        items: [
            { name: "Thiết yếu", targetPercent: 55, categoryNames: ["Nhà cửa", "Ăn uống", "Di chuyển", "Đi chợ", "Hóa đơn"] },
            { name: "Tiết kiệm & Đầu tư", targetPercent: 20, categoryNames: ["Tiết kiệm", "Đầu tư"] },
            { name: "Phát triển bản thân", targetPercent: 10, categoryNames: ["Học tập", "Giáo dục", "Sức khỏe"] },
            { name: "Hưởng thụ", targetPercent: 10, categoryNames: ["Giải trí", "Mua sắm"] },
            { name: "Mối quan hệ", targetPercent: 5, categoryNames: ["Khác"] },
        ],
    },
    {
        code: "good-15-30",
        label: "Mức lương khá",
        incomeHint: "15 - 30 triệu VNĐ",
        items: [
            { name: "Thiết yếu", targetPercent: 45, categoryNames: ["Nhà cửa", "Ăn uống", "Di chuyển", "Đi chợ", "Hóa đơn"] },
            { name: "Tiết kiệm & Đầu tư", targetPercent: 30, categoryNames: ["Tiết kiệm", "Đầu tư"] },
            { name: "Hưởng thụ", targetPercent: 10, categoryNames: ["Giải trí", "Mua sắm"] },
            { name: "Phát triển bản thân", targetPercent: 10, categoryNames: ["Học tập", "Giáo dục", "Sức khỏe"] },
            { name: "Cho đi/Dự phòng", targetPercent: 5, categoryNames: ["Khác"] },
        ],
    },
    {
        code: "high-30-plus",
        label: "Mức lương cao",
        incomeHint: "Trên 30 triệu VNĐ",
        items: [
            { name: "Thiết yếu", targetPercent: 35, categoryNames: ["Nhà cửa", "Ăn uống", "Di chuyển", "Đi chợ", "Hóa đơn"] },
            { name: "Tiết kiệm & Đầu tư", targetPercent: 45, categoryNames: ["Tiết kiệm", "Đầu tư"] },
            { name: "Hưởng thụ", targetPercent: 10, categoryNames: ["Giải trí", "Mua sắm"] },
            { name: "Mối quan hệ & Cho đi", targetPercent: 5, categoryNames: ["Khác"] },
            { name: "Phát triển bản thân", targetPercent: 5, categoryNames: ["Học tập", "Giáo dục", "Sức khỏe"] },
        ],
    },
];

const normalizePercent = (value: number): number => {
    if (!Number.isFinite(value)) {
        return 0;
    }

    return Math.max(0, Math.min(100, Number(value.toFixed(2))));
};

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

const listBudgetJarPresets = async (
    userId: string,
    incomeAmount?: number,
): Promise<IBudgetJarPreset[]> => {
    const categories = await getCategoriesByUser(userId, "expense");
    const categoryNameMap = categories.reduce<Record<string, string>>((acc, item) => {
        acc[item.name.trim().toLowerCase()] = item.id;
        return acc;
    }, {});

    return JAR_SUGGESTION_BASE.map((preset) => {
        const items: IBudgetJarPresetItem[] = preset.items.map((item) => {
            const targetAmount =
                incomeAmount && incomeAmount > 0
                    ? Number(((incomeAmount * item.targetPercent) / 100).toFixed(0))
                    : undefined;

            return {
                name: item.name,
                targetPercent: item.targetPercent,
                targetAmount,
                categoryNames: item.categoryNames.filter(
                    (categoryName) => Boolean(categoryNameMap[categoryName.trim().toLowerCase()]),
                ),
            };
        });

        return {
            code: preset.code,
            label: preset.label,
            incomeHint: preset.incomeHint,
            items,
        };
    });
};

const getBudgetJarsByUser = async (
    userId: string,
    month: number,
    year: number,
): Promise<IBudgetJar[]> => {
    const rows = await listJarBudgetsByUserAndMonth(userId, month, year);

    return rows.map((item) => {
        const targetAmount = Number(item.amount || 0);
        const spentAmount = Number(item.spentAmount || 0);
        const progressPercent = targetAmount > 0 ? normalizePercent((spentAmount / targetAmount) * 100) : 0;

        return {
            id: item.id,
            name: item.name,
            month,
            year,
            targetAmount,
            spentAmount,
            progressPercent,
            remainingAmount: Number((targetAmount - spentAmount).toFixed(0)),
            categoryIds: item.categoryIds,
            categoryNames: item.categoryNames,
        };
    });
};

const setupBudgetJarsByUser = async (
    userId: string,
    payload: IBudgetJarSetupPayload,
): Promise<IBudgetJar[]> => {
    if (!payload.jars.length) {
        await replaceJarBudgetsByUserAndMonth(userId, payload.month, payload.year, []);
        await recalculateJarBudgetSpendingByUserAndMonth(userId, payload.month, payload.year);
        return getBudgetJarsByUser(userId, payload.month, payload.year);
    }

    const categories = await getCategoriesByUser(userId, "expense");
    const categoryById = categories.reduce<Record<string, { id: string; name: string }>>((acc, item) => {
        acc[item.id] = { id: item.id, name: item.name };
        return acc;
    }, {});

    const mappedItems: Array<{
        name: string;
        targetAmount: number;
        categoryIds: string[];
        categoryNames: string[];
    }> = payload.jars.map((item) => {
        const name = String(item.name || "").trim();
        const categoryIds = Array.from(new Set((item.categoryIds || []).map((id) => String(id).trim()).filter(Boolean)));

        if (!name) {
            const error = new Error("Jar name is required.");
            (error as Error & { statusCode?: number }).statusCode = 400;
            throw error;
        }

        if (!categoryIds.length) {
            const error = new Error(`Jar '${name}' must include at least one category.`);
            (error as Error & { statusCode?: number }).statusCode = 400;
            throw error;
        }

        const invalidCategoryId = categoryIds.find((id) => !categoryById[id]);
        if (invalidCategoryId) {
            const error = new Error(`Category '${invalidCategoryId}' is invalid for this user.`);
            (error as Error & { statusCode?: number }).statusCode = 400;
            throw error;
        }

        let targetAmount = Number(item.targetAmount || 0);
        if (!Number.isFinite(targetAmount) || targetAmount < 0) {
            const error = new Error(`Jar '${name}' has invalid targetAmount.`);
            (error as Error & { statusCode?: number }).statusCode = 400;
            throw error;
        }

        if (targetAmount <= 0 && Number(item.targetPercent || 0) > 0 && Number(payload.incomeAmount || 0) > 0) {
            targetAmount = ((Number(payload.incomeAmount) * Number(item.targetPercent)) / 100);
        }

        // Allow zero target amount so users can set up jars first and fill income later.
        if (!Number.isFinite(targetAmount) || targetAmount < 0) {
            targetAmount = 0;
        }

        return {
            name,
            targetAmount: Number(targetAmount.toFixed(0)),
            categoryIds,
            categoryNames: categoryIds.map((id) => categoryById[id].name),
        };
    });

    await replaceJarBudgetsByUserAndMonth(userId, payload.month, payload.year, mappedItems);
    await recalculateJarBudgetSpendingByUserAndMonth(userId, payload.month, payload.year);

    return getBudgetJarsByUser(userId, payload.month, payload.year);
};

const syncBudgetJarsByUserMonth = async (
    userId: string,
    month: number,
    year: number,
    executor?: DbExecutor,
): Promise<void> => {
    await recalculateJarBudgetSpendingByUserAndMonth(userId, month, year, executor);
};

const syncBudgetJarsByTimestamp = async (
    userId: string,
    timestamp: number,
    executor?: DbExecutor,
): Promise<void> => {
    if (!Number.isFinite(timestamp) || timestamp <= 0) {
        return;
    }

    const date = new Date(timestamp);
    await syncBudgetJarsByUserMonth(
        userId,
        date.getMonth() + 1,
        date.getFullYear(),
        executor,
    );
};

export {
    getSavingGoalByUser,
    getSavingBudgetByUser,
    upsertSavingGoalByUser,
    listBudgetJarPresets,
    getBudgetJarsByUser,
    setupBudgetJarsByUser,
    syncBudgetJarsByUserMonth,
    syncBudgetJarsByTimestamp,
};