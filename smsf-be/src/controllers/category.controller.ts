import { Request, Response } from "express";
import { TypeCategoryKind } from "../interfaces/category.interface";
import {
    createCustomCategoryForUser,
    getCategoriesByUser,
    updateCategoryOrderByUser,
} from "../services/category.service";

const parseType = (typeRaw: unknown): TypeCategoryKind | undefined | "invalid" => {
    if (typeRaw === undefined || typeRaw === null || typeRaw === "") {
        return undefined;
    }

    const value = String(typeRaw).trim();
    if (value === "income" || value === "expense") {
        return value;
    }

    return "invalid";
};

const getCategories = async (req: Request, res: Response): Promise<Response> => {
    const userId = String(req.user?.id || "").trim();

    if (!userId) {
        return res.status(401).json({
            success: false,
            message: "Unauthorized.",
        });
    }

    const type = parseType(req.query.type);
    if (type === "invalid") {
        return res.status(400).json({
            success: false,
            message: "type must be either income or expense.",
        });
    }

    const categories = await getCategoriesByUser(userId, type);

    return res.json({
        success: true,
        data: categories,
    });
};

const createCategory = async (req: Request, res: Response): Promise<Response> => {
    const userId = String(req.user?.id || "").trim();

    if (!userId) {
        return res.status(401).json({
            success: false,
            message: "Unauthorized.",
        });
    }

    const type = parseType(req.body?.type);
    if (type === "invalid" || !type) {
        return res.status(400).json({
            success: false,
            message: "type must be either income or expense.",
        });
    }

    const name = String(req.body?.name || "").trim();
    const icon =
        req.body?.icon === undefined || req.body?.icon === null
            ? undefined
            : String(req.body?.icon || "").trim();

    try {
        const category = await createCustomCategoryForUser(userId, name, type, icon || undefined);

        return res.status(201).json({
            success: true,
            message: "Category created successfully.",
            data: category,
        });
    } catch (error) {
        const statusCode = (error as Error & { statusCode?: number }).statusCode || 500;
        return res.status(statusCode).json({
            success: false,
            message: (error as Error).message,
        });
    }
};

const reorderCategories = async (req: Request, res: Response): Promise<Response> => {
    const userId = String(req.user?.id || "").trim();

    if (!userId) {
        return res.status(401).json({
            success: false,
            message: "Unauthorized.",
        });
    }

    const type = parseType(req.body?.type);
    if (type === "invalid" || !type) {
        return res.status(400).json({
            success: false,
            message: "type must be either income or expense.",
        });
    }

    const categoryIdsRaw = Array.isArray(req.body?.categoryIds) ? req.body.categoryIds : [];
    const categoryIds = categoryIdsRaw.map((item) => String(item || "").trim()).filter(Boolean);

    if (categoryIds.length === 0) {
        return res.status(400).json({
            success: false,
            message: "categoryIds is required.",
        });
    }

    try {
        await updateCategoryOrderByUser(userId, type, categoryIds);
        const categories = await getCategoriesByUser(userId, type);
        return res.json({
            success: true,
            data: categories,
        });
    } catch (error) {
        const statusCode = (error as Error & { statusCode?: number }).statusCode || 500;
        return res.status(statusCode).json({
            success: false,
            message: (error as Error).message,
        });
    }
};

export { getCategories, createCategory, reorderCategories };
