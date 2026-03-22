import { Request, Response } from "express";
import { TypeCategoryKind } from "../interfaces/category.interface";
import { getCategoriesByUser } from "../services/category.service";

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

export { getCategories };
