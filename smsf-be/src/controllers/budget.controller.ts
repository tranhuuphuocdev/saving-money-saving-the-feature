import { Request, Response } from "express";
import { getSavingGoalByUser, upsertSavingGoalByUser } from "../services/budget.service";
import {
    getOrSetCachedSavingsValue,
    getSavingsCacheKey,
    invalidateSavingsCacheByUser,
} from "../lib/savings-cache";

const parseMonthYear = (
    monthRaw: unknown,
    yearRaw: unknown,
): { month: number; year: number; error?: string } => {
    const now = new Date();
    const month = monthRaw ? Number(monthRaw) : now.getMonth() + 1;
    const year = yearRaw ? Number(yearRaw) : now.getFullYear();

    if (
        !Number.isInteger(month) ||
        month < 1 ||
        month > 12 ||
        !Number.isInteger(year) ||
        year < 1970
    ) {
        return {
            month,
            year,
            error: "month/year query is invalid.",
        };
    }

    return { month, year };
};

const getSavingGoal = async (req: Request, res: Response): Promise<Response> => {
    const userId = String(req.user?.id || "").trim();

    if (!userId) {
        return res.status(401).json({ success: false, message: "Unauthorized." });
    }

    const { month, year, error } = parseMonthYear(req.query.month, req.query.year);

    if (error) {
        return res.status(400).json({ success: false, message: error });
    }

    const cacheKey = getSavingsCacheKey("goal", userId, month, year);
    const result = await getOrSetCachedSavingsValue(cacheKey, () =>
        getSavingGoalByUser(userId, month, year),
    );

    return res.json({ success: true, data: result });
};

const upsertSavingGoal = async (
    req: Request,
    res: Response,
): Promise<Response> => {
    const userId = String(req.user?.id || "").trim();

    if (!userId) {
        return res.status(401).json({ success: false, message: "Unauthorized." });
    }

    const { month, year, error } = parseMonthYear(req.body?.month, req.body?.year);

    if (error) {
        return res.status(400).json({ success: false, message: error });
    }

    const amount = Number(req.body?.amount);

    if (!Number.isFinite(amount) || amount < 0) {
        return res.status(400).json({
            success: false,
            message: "amount must be a non-negative number.",
        });
    }

    const result = await upsertSavingGoalByUser(userId, month, year, amount);
    invalidateSavingsCacheByUser(userId);

    return res.json({
        success: true,
        message: "Saving goal updated successfully.",
        data: result,
    });
};

export { getSavingGoal, upsertSavingGoal };