import { randomUUID } from "node:crypto";
import { IBudget, IBudgetJarSetupItem } from "../interfaces/budget.interface";
import { DbExecutor, prisma } from "../lib/prisma";

const getExecutor = (executor?: DbExecutor) => executor || prisma;

const mapRow = (row: {
    id: string;
    userId: string;
    categoryId: string;
    name: string;
    amount: unknown;
    description: string | null;
    type: string;
    periodMonth: number;
    periodYear: number;
    spentAmount: unknown;
    createdAt: bigint;
    updatedAt: bigint;
}): IBudget => {
    return {
        id: String(row.id),
        userId: String(row.userId),
        categoryId: String(row.categoryId),
        name: String(row.name),
        amount: Number(row.amount || 0),
        description: row.description ? String(row.description) : undefined,
        type: String(row.type) as IBudget["type"],
        periodMonth: Number(row.periodMonth || 0),
        periodYear: Number(row.periodYear || 0),
        spentAmount: Number(row.spentAmount || 0),
        createdAt: Number(row.createdAt || 0n),
        updatedAt: Number(row.updatedAt || 0n),
    };
};

const getMonthRange = (month: number, year: number): { from: number; to: number } => {
    const from = new Date(year, month - 1, 1, 0, 0, 0, 0).getTime();
    const to = new Date(year, month, 1, 0, 0, 0, 0).getTime() - 1;

    return { from, to };
};

const getSavingBudgetByUserAndMonth = async (
    userId: string,
    month: number,
    year: number,
): Promise<IBudget | undefined> => {
    const result = await prisma.budget.findFirst({
        where: {
            userId,
            type: "saving",
            periodMonth: month,
            periodYear: year,
        },
        orderBy: { updatedAt: "desc" },
    });

    if (!result) {
        return undefined;
    }

    return mapRow(result);
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
        spentAmount: existing?.spentAmount || 0,
        createdAt: existing?.createdAt || now,
        updatedAt: now,
    };

    await prisma.budget.upsert({
        where: { id: budget.id },
        create: {
            id: budget.id,
            userId: budget.userId,
            categoryId: budget.categoryId,
            name: budget.name,
            amount: budget.amount,
            spentAmount: budget.spentAmount || 0,
            description: budget.description || "",
            type: budget.type,
            periodMonth: budget.periodMonth,
            periodYear: budget.periodYear,
            createdAt: BigInt(budget.createdAt),
            updatedAt: BigInt(budget.updatedAt),
        },
        update: {
            categoryId: budget.categoryId,
            name: budget.name,
            amount: budget.amount,
            description: budget.description || "",
            updatedAt: BigInt(budget.updatedAt),
        },
    });

    return budget;
};

const listJarBudgetsByUserAndMonth = async (
    userId: string,
    month: number,
    year: number,
): Promise<
    Array<
        IBudget & {
            categoryIds: string[];
            categoryNames: string[];
        }
    >
> => {
    const result = await prisma.budget.findMany({
        where: {
            userId,
            type: "jar",
            periodMonth: month,
            periodYear: year,
        },
        include: {
            budgetCategoryMaps: {
                include: {
                    category: true,
                },
            },
        },
        orderBy: [
            { spentAmount: "desc" },
            { updatedAt: "desc" },
        ],
    });

    return result.map((row) => {
        const base = mapRow(row);
        const categoryIds = row.budgetCategoryMaps.map((item) => String(item.categoryId));
        const categoryNames = row.budgetCategoryMaps
            .map((item) => item.category?.name)
            .filter((name): name is string => Boolean(name));

        return {
            ...base,
            categoryIds,
            categoryNames,
        };
    });
};

const replaceJarBudgetsByUserAndMonth = async (
    userId: string,
    month: number,
    year: number,
    setupItems: Array<
        IBudgetJarSetupItem & {
            categoryNames: string[];
            targetAmount: number;
        }
    >,
): Promise<void> => {
    await prisma.$transaction(async (tx) => {
        await tx.budget.deleteMany({
            where: {
                userId,
                periodMonth: month,
                periodYear: year,
                type: "jar",
            },
        });

        const now = Date.now();

        for (const item of setupItems) {
            const budgetId = randomUUID();
            const primaryCategoryId = item.categoryIds[0];

            await tx.budget.create({
                data: {
                    id: budgetId,
                    userId,
                    categoryId: primaryCategoryId,
                    name: item.name,
                    amount: item.targetAmount,
                    spentAmount: 0,
                    description: item.categoryNames.join(", "),
                    type: "jar",
                    periodMonth: month,
                    periodYear: year,
                    createdAt: BigInt(now),
                    updatedAt: BigInt(now),
                },
            });

            for (const categoryId of item.categoryIds) {
                await tx.budgetCategoryMap.create({
                    data: {
                        id: randomUUID(),
                        budgetId,
                        categoryId,
                        createdAt: BigInt(now),
                        updatedAt: BigInt(now),
                    },
                });
            }
        }
    });
};

const recalculateJarBudgetSpendingByUserAndMonth = async (
    userId: string,
    month: number,
    year: number,
    executor?: DbExecutor,
): Promise<void> => {
    const range = getMonthRange(month, year);
    const now = Date.now();
    const db = getExecutor(executor);

    await db.$executeRaw`
        UPDATE "budgets" b
        SET "bud_spent" = COALESCE(spent.total_amount, 0),
            "updated_at" = ${BigInt(now)}
        FROM (
            SELECT b2."b_id", SUM(t."amount")::numeric AS total_amount
            FROM "budgets" b2
            LEFT JOIN "budget_category_maps" bcm ON bcm."b_id" = b2."b_id"
            LEFT JOIN "transactions" t ON t."u_id" = b2."u_id"
                AND t."cate_id" = bcm."cate_id"
                AND t."txn_type" = 'expense'
                AND t."is_deleted" = false
                AND t."txn_at" BETWEEN ${BigInt(range.from)} AND ${BigInt(range.to)}
                        WHERE b2."u_id" = ${userId}::uuid
              AND b2."period_month" = ${month}
              AND b2."period_year" = ${year}
              AND b2."bud_type" = 'jar'
            GROUP BY b2."b_id"
        ) spent
        WHERE b."b_id" = spent."b_id"
    `;

    await db.$executeRaw`
        UPDATE "budgets"
        SET "bud_spent" = 0,
            "updated_at" = ${BigInt(now)}
        WHERE "u_id" = ${userId}::uuid
          AND "period_month" = ${month}
          AND "period_year" = ${year}
          AND "bud_type" = 'jar'
          AND "b_id" NOT IN (
              SELECT DISTINCT b2."b_id"
              FROM "budgets" b2
              LEFT JOIN "budget_category_maps" bcm ON bcm."b_id" = b2."b_id"
              LEFT JOIN "transactions" t ON t."u_id" = b2."u_id"
                  AND t."cate_id" = bcm."cate_id"
                  AND t."txn_type" = 'expense'
                  AND t."is_deleted" = false
                  AND t."txn_at" BETWEEN ${BigInt(range.from)} AND ${BigInt(range.to)}
                            WHERE b2."u_id" = ${userId}::uuid
                AND b2."period_month" = ${month}
                AND b2."period_year" = ${year}
                AND b2."bud_type" = 'jar'
                AND t."txn_id" IS NOT NULL
          )
    `;
};

export {
    getSavingBudgetByUserAndMonth,
    upsertSavingBudgetByUser,
    listJarBudgetsByUserAndMonth,
    replaceJarBudgetsByUserAndMonth,
    recalculateJarBudgetSpendingByUserAndMonth,
};
