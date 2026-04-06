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
import { emitToUser } from "../lib/socket";
import { prisma } from "../lib/prisma";
import { listSharedFundMemberIds } from "../services/shared-fund.service";
import { logApiError, logApiInfo, logApiWarn } from "../util/api-logger";

const notifySharedFundActivity = async (payload: {
    walletId: string;
    actorId: string;
    actorName: string;
    action: "create" | "update" | "delete";
    amount?: number;
    type?: "income" | "expense";
    description?: string;
}) => {
    const wallet = await prisma.wallet.findUnique({
        where: { id: payload.walletId },
        select: {
            id: true,
            name: true,
            type: true,
        },
    });

    if (!wallet || wallet.type !== "shared-fund") {
        return;
    }

    const memberIds = await listSharedFundMemberIds(wallet.id);
    if (memberIds.length === 0) {
        return;
    }

    const createdAt = Date.now();
    const message =
        payload.action === "delete"
            ? `${payload.actorName} đã xóa một giao dịch trong quỹ ${wallet.name}`
            : payload.action === "update"
              ? `${payload.actorName} đã cập nhật giao dịch trong quỹ ${wallet.name}`
              : `${payload.actorName} đã thêm giao dịch vào quỹ ${wallet.name}`;

    for (const memberId of memberIds) {
        emitToUser(memberId, "shared_fund_activity", {
            id: `${wallet.id}:${createdAt}:${memberId}`,
            walletId: wallet.id,
            walletName: wallet.name,
            actorId: payload.actorId,
            actorName: payload.actorName,
            action: payload.action,
            amount: payload.amount,
            type: payload.type,
            description: payload.description,
            createdAt,
            message,
        });
    }
};

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
        logApiWarn(req, "Get transactions request rejected: missing user");
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
        logApiWarn(req, "Get transactions request rejected: invalid month/year", {
            month: req.query.month,
            year: req.query.year,
        });
        return res.status(400).json({
            success: false,
            message: error,
        });
    }

    const transactions = await listTransactionsByMonth(userId, month, year);

    logApiInfo(req, "Transactions loaded by month", {
        month,
        year,
        itemCount: transactions.length,
    });

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
        logApiWarn(req, "Query transactions request rejected: missing user");
        return res.status(401).json({
            success: false,
            message: "Unauthorized.",
        });
    }

    const query = parseTransactionQuery(req.query);

    if (query.error) {
        logApiWarn(req, "Query transactions request rejected: invalid query", {
            error: query.error,
        });
        return res.status(400).json({
            success: false,
            message: query.error,
        });
    }

    const result = await listTransactionsByQuery(userId, {
        page: query.page,
        limit: query.limit,
        category: query.category,
        categories: query.categories,
        description: query.description,
        startTime: query.startTime,
        endTime: query.endTime,
    });

    logApiInfo(req, "Transactions queried", {
        page: result.page,
        limit: result.limit,
        total: result.total,
        itemCount: result.items.length,
        filters: {
            category: query.category,
            categories: query.categories,
            description: query.description,
            startTime: query.startTime,
            endTime: query.endTime,
        },
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
        logApiWarn(req, "Create transaction request rejected: missing user");
        return res.status(401).json({
            success: false,
            message: "Unauthorized.",
        });
    }

    const validation = validateCreateTransactionPayload(req.body);

    if (!validation.isValid || !validation.payload) {
        logApiWarn(req, "Create transaction request rejected: validation failed", {
            validationErrors: validation.errors,
        });
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
            userId,
        );
        await notifySharedFundActivity({
            walletId: result.transaction.walletId,
            actorId: userId,
            actorName: String(req.user?.username || "Thành viên"),
            action: "create",
            amount: result.transaction.amount,
            type: result.transaction.type,
            description: result.transaction.description,
        });
        const walletSummary = await getWalletSummary(userId);
        invalidateSavingsCacheByUser(userId);

        logApiInfo(req, "Transaction created", {
            transactionId: result.transaction.id,
            walletId: result.transaction.walletId,
            amount: result.transaction.amount,
            transactionType: result.transaction.type,
            category: result.transaction.category,
            updatedWalletBalance: result.updatedWalletBalance,
        });

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

        logApiError(req, "Create transaction failed", error, {
            statusCode,
            walletId: validation.payload?.walletId,
            amount: validation.payload?.amount,
            transactionType: validation.payload?.type,
            category: validation.payload?.category,
        });

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
        logApiWarn(req, "Create bulk transactions request rejected: missing user");
        return res.status(401).json({
            success: false,
            message: "Unauthorized.",
        });
    }

    const validation = validateCreateTransactionsBulkPayload(req.body);
    if (!validation.isValid || !validation.payload) {
        logApiWarn(req, "Create bulk transactions request rejected: validation failed", {
            validationErrors: validation.errors,
        });
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
            userId,
        );
        const walletSummary = await getWalletSummary(userId);
        invalidateSavingsCacheByUser(userId);

        logApiInfo(req, "Bulk transactions created", {
            createdCount: result.transactions.length,
            walletCount: walletSummary.wallets.length,
            totalAmount: walletSummary.totalAmount,
        });

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

        logApiError(req, "Create bulk transactions failed", error, {
            statusCode,
            submittedCount: validation.payload?.length || 0,
        });

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
        logApiWarn(req, "Update transaction request rejected: missing user");
        return res.status(401).json({
            success: false,
            message: "Unauthorized.",
        });
    }

    if (!transactionId) {
        logApiWarn(req, "Update transaction request rejected: missing transactionId");
        return res.status(400).json({
            success: false,
            message: "transactionId is required.",
        });
    }

    const validation = validateUpdateTransactionPayload(req.body);
    if (!validation.isValid || !validation.payload) {
        logApiWarn(req, "Update transaction request rejected: validation failed", {
            transactionId,
            validationErrors: validation.errors,
        });
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
            userId,
        );
        await notifySharedFundActivity({
            walletId: result.transaction.walletId,
            actorId: userId,
            actorName: String(req.user?.username || "Thành viên"),
            action: "update",
            amount: result.transaction.amount,
            type: result.transaction.type,
            description: result.transaction.description,
        });
        const walletSummary = await getWalletSummary(userId);
        invalidateSavingsCacheByUser(userId);

        logApiInfo(req, "Transaction updated", {
            transactionId: result.transaction.id,
            walletId: result.transaction.walletId,
            amount: result.transaction.amount,
            transactionType: result.transaction.type,
            affectedWalletIds: result.affectedWalletIds,
        });

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

        logApiError(req, "Update transaction failed", error, {
            statusCode,
            transactionId,
            walletId: validation.payload?.walletId,
            amount: validation.payload?.amount,
            transactionType: validation.payload?.type,
        });

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
        logApiWarn(req, "Delete transaction request rejected: missing user");
        return res.status(401).json({
            success: false,
            message: "Unauthorized.",
        });
    }

    if (!transactionId) {
        logApiWarn(req, "Delete transaction request rejected: missing transactionId");
        return res.status(400).json({
            success: false,
            message: "transactionId is required.",
        });
    }

    try {
        const result = await deleteTransactionForUser(userId, transactionId, userId);
        await notifySharedFundActivity({
            walletId: result.walletId,
            actorId: userId,
            actorName: String(req.user?.username || "Thành viên"),
            action: "delete",
        });
        const walletSummary = await getWalletSummary(userId);
        invalidateSavingsCacheByUser(userId);

        logApiInfo(req, "Transaction deleted", {
            transactionId: result.deletedTransactionId,
            walletId: result.walletId,
            updatedWalletBalance: result.updatedWalletBalance,
        });

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

        logApiError(req, "Delete transaction failed", error, {
            statusCode,
            transactionId,
        });

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
        logApiWarn(req, "Get savings rate request rejected: missing user");
        return res.status(401).json({ success: false, message: "Unauthorized." });
    }

    const { month, year, error } = parseMonthYear(req.query.month, req.query.year);

    if (error) {
        logApiWarn(req, "Get savings rate request rejected: invalid month/year", {
            month: req.query.month,
            year: req.query.year,
        });
        return res.status(400).json({ success: false, message: error });
    }

    const savingsGoalRaw = req.query.savingsGoal;
    const querySavingsGoal =
        savingsGoalRaw !== undefined ? Number(savingsGoalRaw) : undefined;

    if (
        querySavingsGoal !== undefined &&
        (!Number.isFinite(querySavingsGoal) || querySavingsGoal < 0)
    ) {
        logApiWarn(req, "Get savings rate request rejected: invalid savingsGoal", {
            savingsGoal: savingsGoalRaw,
        });
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

        logApiInfo(req, "Savings rate loaded", {
            month,
            year,
            usedQuerySavingsGoal: querySavingsGoal !== undefined,
            savingsGoal: result.savingsGoal,
            savingsRate: result.savingsRate,
        });

        return res.json({ success: true, data: result });
    } catch (err) {
        const statusCode = (err as Error & { statusCode?: number }).statusCode || 500;
        logApiError(req, "Get savings rate failed", err, {
            statusCode,
            month,
            year,
            savingsGoal: querySavingsGoal,
        });
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
        logApiWarn(req, "Get spending trend request rejected: missing user");
        return res.status(401).json({ success: false, message: "Unauthorized." });
    }

    const { month, year, error } = parseMonthYear(req.query.month, req.query.year);

    if (error) {
        logApiWarn(req, "Get spending trend request rejected: invalid month/year", {
            month: req.query.month,
            year: req.query.year,
        });
        return res.status(400).json({ success: false, message: error });
    }

    try {
        const trend = await getMonthlySpendingTrendForUser(userId, month, year);
        logApiInfo(req, "Spending trend loaded", {
            month,
            year,
            pointCount: trend.points.length,
            totalIncome: trend.totalIncome,
            savingsGoal: trend.savingsGoal,
        });
        return res.json({ success: true, data: trend });
    } catch (error) {
        logApiError(req, "Get spending trend failed", error, {
            month,
            year,
        });
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
