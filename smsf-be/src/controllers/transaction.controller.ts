import { Request, Response } from "express";
import {
    createTransactionsBulkForUser,
    createTransactionForUser,
    deleteTransactionForUser,
    listTransactionsByQuery,
    listTransactionsByMonth,
    updateTransactionForUser,
    getSavingsRateForUser,
    getMonthlySpendingTrendForUser,
} from "../services/transaction.service";
import { getSavingGoalByUser } from "../services/budget.service";
import {
    getOrSetCachedSavingsValue,
    getSavingsCacheKey,
    invalidateSavingsCacheByUser,
} from "../lib/savings-cache";
import {
    validateCreateTransactionsBulkPayload,
    validateCreateTransactionPayload,
    validateUpdateTransactionPayload,
} from "../validators/transaction.validator";
import { getWalletSummary } from "../services/wallet.service";

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

const parseTransactionQuery = (query: Request["query"]): {
    page: number;
    limit: number;
    category?: string;
    categories?: string[];
    description?: string;
    startTime?: number;
    endTime?: number;
    error?: string;
} => {
    const pageRaw = query.page;
    const limitRaw = query.limit;
    const category = String(query.category || "").trim() || undefined;
    const description = String(query.description || "").trim() || undefined;

    const categoriesRaw = query.categories;
    let categories: string[] | undefined;
    if (categoriesRaw) {
        const raw = Array.isArray(categoriesRaw)
            ? categoriesRaw.map((c) => String(c).trim())
            : String(categoriesRaw).split(",").map((c) => c.trim());
        const filtered = raw.filter(Boolean);
        if (filtered.length > 0) categories = filtered;
    }

    const page = pageRaw ? Number(pageRaw) : 1;
    const limit = limitRaw ? Number(limitRaw) : 20;

    if (!Number.isInteger(page) || page < 1) {
        return { page, limit, error: "page must be a positive integer." };
    }

    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
        return { page, limit, error: "limit must be between 1 and 100." };
    }

    const startTimeRaw = query.startTime;
    const endTimeRaw = query.endTime;

    const startTime =
        startTimeRaw !== undefined ? Number(startTimeRaw) : undefined;
    const endTime = endTimeRaw !== undefined ? Number(endTimeRaw) : undefined;

    if (startTime !== undefined && !Number.isFinite(startTime)) {
        return { page, limit, error: "startTime must be a valid timestamp." };
    }

    if (endTime !== undefined && !Number.isFinite(endTime)) {
        return { page, limit, error: "endTime must be a valid timestamp." };
    }

    if (
        startTime !== undefined &&
        endTime !== undefined &&
        startTime > endTime
    ) {
        return {
            page,
            limit,
            error: "startTime must be less than or equal to endTime.",
        };
    }

    return {
        page,
        limit,
        category,
        categories,
        description,
        startTime,
        endTime,
    };
};

const getTransactions = async (req: Request, res: Response): Promise<Response> => {
    const userId = String(req.user?.id || "").trim();

    if (!userId) {
        return res.status(401).json({
            success: false,
            message: "Unauthorized.",
        });
    }

    const { month, year, error } = parseMonthYear(
        req.query.month,
        req.query.year,
    );

    if (error) {
        return res.status(400).json({
            success: false,
            message: error,
        });
    }

    const transactions = await listTransactionsByMonth(userId, month, year);

    return res.json({
        success: true,
        data: transactions,
    });
};

const queryTransactions = async (
    req: Request,
    res: Response,
): Promise<Response> => {
    const userId = String(req.user?.id || "").trim();

    if (!userId) {
        return res.status(401).json({
            success: false,
            message: "Unauthorized.",
        });
    }

    const query = parseTransactionQuery(req.query);

    if (query.error) {
        return res.status(400).json({
            success: false,
            message: query.error,
        });
    }

    const result = await listTransactionsByQuery(userId, {
        page: query.page,
        limit: query.limit,
        category: query.category,
        description: query.description,
        startTime: query.startTime,
        endTime: query.endTime,
    });

    return res.json({
        success: true,
        data: result,
    });
};

const createTransaction = async (
    req: Request,
    res: Response,
): Promise<Response> => {
    const userId = String(req.user?.id || "").trim();

    if (!userId) {
        return res.status(401).json({
            success: false,
            message: "Unauthorized.",
        });
    }

    const validation = validateCreateTransactionPayload(req.body);

    if (!validation.isValid || !validation.payload) {
        return res.status(400).json({
            success: false,
            message: "Validation failed.",
            errors: validation.errors,
        });
    }

    try {
        const result = await createTransactionForUser(
            userId,
            validation.payload,
            String(req.user?.username || "").trim() || undefined,
        );
        const walletSummary = await getWalletSummary(userId);
        invalidateSavingsCacheByUser(userId);

        return res.status(201).json({
            success: true,
            message: "Transaction created successfully.",
            data: {
                transaction: result.transaction,
                ...walletSummary,
            },
        });
    } catch (error) {
        const statusCode =
            (error as Error & { statusCode?: number }).statusCode || 500;

        return res.status(statusCode).json({
            success: false,
            message: (error as Error).message,
        });
    }
};

const createTransactionsBulk = async (
    req: Request,
    res: Response,
): Promise<Response> => {
    const userId = String(req.user?.id || "").trim();

    if (!userId) {
        return res.status(401).json({
            success: false,
            message: "Unauthorized.",
        });
    }

    const validation = validateCreateTransactionsBulkPayload(req.body);
    if (!validation.isValid || !validation.payload) {
        return res.status(400).json({
            success: false,
            message: "Validation failed.",
            errors: validation.errors,
        });
    }

    try {
        const result = await createTransactionsBulkForUser(
            userId,
            validation.payload,
            String(req.user?.username || "").trim() || undefined,
        );
        const walletSummary = await getWalletSummary(userId);
        invalidateSavingsCacheByUser(userId);

        return res.status(201).json({
            success: true,
            message: "Bulk transactions created successfully.",
            data: {
                transactions: result.transactions,
                ...walletSummary,
            },
        });
    } catch (error) {
        const statusCode =
            (error as Error & { statusCode?: number }).statusCode || 500;

        return res.status(statusCode).json({
            success: false,
            message: (error as Error).message,
        });
    }
};

const updateTransaction = async (
    req: Request,
    res: Response,
): Promise<Response> => {
    const userId = String(req.user?.id || "").trim();
    const transactionId = String(req.params.transactionId || "").trim();

    if (!userId) {
        return res.status(401).json({
            success: false,
            message: "Unauthorized.",
        });
    }

    if (!transactionId) {
        return res.status(400).json({
            success: false,
            message: "transactionId is required.",
        });
    }

    const validation = validateUpdateTransactionPayload(req.body);
    if (!validation.isValid || !validation.payload) {
        return res.status(400).json({
            success: false,
            message: "Validation failed.",
            errors: validation.errors,
        });
    }

    try {
        const result = await updateTransactionForUser(
            userId,
            transactionId,
            validation.payload,
            String(req.user?.username || "").trim() || undefined,
        );
        const walletSummary = await getWalletSummary(userId);
        invalidateSavingsCacheByUser(userId);

        return res.json({
            success: true,
            message: "Transaction updated successfully.",
            data: {
                transaction: result.transaction,
                ...walletSummary,
            },
        });
    } catch (error) {
        const statusCode =
            (error as Error & { statusCode?: number }).statusCode || 500;

        return res.status(statusCode).json({
            success: false,
            message: (error as Error).message,
        });
    }
};

const removeTransaction = async (
    req: Request,
    res: Response,
): Promise<Response> => {
    const userId = String(req.user?.id || "").trim();
    const transactionId = String(req.params.transactionId || "").trim();

    if (!userId) {
        return res.status(401).json({
            success: false,
            message: "Unauthorized.",
        });
    }

    if (!transactionId) {
        return res.status(400).json({
            success: false,
            message: "transactionId is required.",
        });
    }

    try {
        const result = await deleteTransactionForUser(userId, transactionId);
        const walletSummary = await getWalletSummary(userId);
        invalidateSavingsCacheByUser(userId);

        return res.json({
            success: true,
            message: "Transaction deleted successfully.",
            data: {
                ...result,
                ...walletSummary,
            },
        });
    } catch (error) {
        const statusCode =
            (error as Error & { statusCode?: number }).statusCode || 500;

        return res.status(statusCode).json({
            success: false,
            message: (error as Error).message,
        });
    }
};

const getSavingsRate = async (
    req: Request,
    res: Response,
): Promise<Response> => {
    const userId = String(req.user?.id || "").trim();

    if (!userId) {
        return res.status(401).json({ success: false, message: "Unauthorized." });
    }

    const { month, year, error } = parseMonthYear(req.query.month, req.query.year);

    if (error) {
        return res.status(400).json({ success: false, message: error });
    }

    const savingsGoalRaw = req.query.savingsGoal;
    const querySavingsGoal =
        savingsGoalRaw !== undefined ? Number(savingsGoalRaw) : undefined;

    if (
        querySavingsGoal !== undefined &&
        (!Number.isFinite(querySavingsGoal) || querySavingsGoal < 0)
    ) {
        return res.status(400).json({
            success: false,
            message: "savingsGoal must be a non-negative number.",
        });
    }

    try {
        const result =
            querySavingsGoal !== undefined
                ? await getSavingsRateForUser(userId, month, year, querySavingsGoal)
                : await getOrSetCachedSavingsValue(
                      getSavingsCacheKey("rate", userId, month, year),
                      async () => {
                          const budgetSummary = await getSavingGoalByUser(userId, month, year);
                          return getSavingsRateForUser(userId, month, year, budgetSummary.amount);
                      },
                  );

        return res.json({ success: true, data: result });
    } catch (err) {
        const statusCode = (err as Error & { statusCode?: number }).statusCode || 500;
        return res.status(statusCode).json({
            success: false,
            message: (err as Error).message,
        });
    }
};

const getSpendingTrend = async (
    req: Request,
    res: Response,
): Promise<Response> => {
    const userId = String(req.user?.id || "").trim();

    if (!userId) {
        return res.status(401).json({ success: false, message: "Unauthorized." });
    }

    const { month, year, error } = parseMonthYear(req.query.month, req.query.year);

    if (error) {
        return res.status(400).json({ success: false, message: error });
    }

    try {
        const trend = await getMonthlySpendingTrendForUser(userId, month, year);
        return res.json({ success: true, data: trend });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: (error as Error).message || "Failed to load spending trend.",
        });
    }
};

export {
    getTransactions,
    queryTransactions,
    createTransaction,
    createTransactionsBulk,
    updateTransaction,
    removeTransaction,
    getSavingsRate,
    getSpendingTrend,
};
