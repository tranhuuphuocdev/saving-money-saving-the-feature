import {
    IAiReceiptAnalyzePayload,
    IAiTextAnalyzePayload,
    IAiTransactionSuggestion,
} from "../interfaces/ai.interface";
import { callGeminiGenerateContent } from "../lib/gemini-client";
import { ICategory } from "../interfaces/category.interface";
import { getCategoriesByUser } from "./category.service";

interface IRawAiResult {
    amount?: number | string;
    type?: "income" | "expense" | string;
    date?: string;
    merchant?: string;
    description?: string;
    category?: string;
    confidence?: number | string;
    currency?: string;
}

const MAX_TEXT_INPUT_LENGTH = 1000;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_MIME = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp", "image/heic", "image/heif"]);

const normalizeText = (value: string): string => {
    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
};

const clampConfidence = (value: unknown): number => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return 0;
    }

    return Math.max(0, Math.min(1, numeric));
};

const safeAmount = (value: unknown): number | null => {
    const numeric = Number(value);

    if (!Number.isFinite(numeric) || numeric <= 0) {
        return null;
    }

    const rounded = Math.round(numeric);
    if (rounded > 1_000_000_000_000) {
        return null;
    }

    return rounded;
};

const parseDateToTimestamp = (dateRaw: unknown, fallbackTimestamp: number): number => {
    const dateStr = String(dateRaw || "").trim();
    if (!dateStr) {
        return fallbackTimestamp;
    }

    const ddmmyyyyMatch = dateStr.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
    if (ddmmyyyyMatch) {
        const day = Number(ddmmyyyyMatch[1]);
        const month = Number(ddmmyyyyMatch[2]);
        const year = Number(ddmmyyyyMatch[3]);

        const constructed = new Date(year, month - 1, day, 12, 0, 0).getTime();
        if (Number.isFinite(constructed)) {
            return constructed;
        }
    }

    const parsed = Date.parse(dateStr);
    if (!Number.isFinite(parsed)) {
        return fallbackTimestamp;
    }

    return parsed;
};

const normalizeRelativeText = (value: string): string => {
    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
};

const resolveRelativeTimestamp = (
    textContext: string,
    fallbackTimestamp: number,
): number | undefined => {
    const normalized = normalizeRelativeText(textContext);
    const baseDate = new Date(fallbackTimestamp);

    if (normalized.includes("hom qua") || normalized.includes("yesterday")) {
        baseDate.setDate(baseDate.getDate() - 1);
        baseDate.setHours(12, 0, 0, 0);
        return baseDate.getTime();
    }

    if (normalized.includes("hom kia") || normalized.includes("2 ngay truoc")) {
        baseDate.setDate(baseDate.getDate() - 2);
        baseDate.setHours(12, 0, 0, 0);
        return baseDate.getTime();
    }

    if (normalized.includes("hom nay") || normalized.includes("today")) {
        baseDate.setHours(12, 0, 0, 0);
        return baseDate.getTime();
    }

    return undefined;
};

const extractJson = (rawText: string): Record<string, unknown> => {
    const trimmed = String(rawText || "").trim();

    if (!trimmed) {
        throw new Error("AI response is empty.");
    }

    const withoutFence = trimmed
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/```$/i, "")
        .trim();

    try {
        return JSON.parse(withoutFence) as Record<string, unknown>;
    } catch {
        const objectStart = withoutFence.indexOf("{");
        const objectEnd = withoutFence.lastIndexOf("}");

        if (objectStart >= 0 && objectEnd > objectStart) {
            const maybeJson = withoutFence.slice(objectStart, objectEnd + 1);
            return JSON.parse(maybeJson) as Record<string, unknown>;
        }

        throw new Error("AI response is not a valid JSON object.");
    }
};

const ensureTextPayload = (payload: IAiTextAnalyzePayload): { text: string; walletId?: string; fallbackTimestamp: number } => {
    const text = String(payload.text || "").trim();
    if (!text) {
        const error = new Error("text is required.");
        (error as Error & { statusCode?: number }).statusCode = 400;
        throw error;
    }

    if (text.length > MAX_TEXT_INPUT_LENGTH) {
        const error = new Error(`text must be <= ${MAX_TEXT_INPUT_LENGTH} characters.`);
        (error as Error & { statusCode?: number }).statusCode = 400;
        throw error;
    }

    return {
        text,
        walletId: String(payload.walletId || "").trim() || undefined,
        fallbackTimestamp:
            Number.isFinite(payload.fallbackTimestamp) && Number(payload.fallbackTimestamp) > 0
                ? Number(payload.fallbackTimestamp)
                : Date.now(),
    };
};

const estimateBase64Size = (base64: string): number => {
    const sanitized = String(base64 || "").replace(/\s/g, "");
    if (!sanitized) return 0;

    const padding = sanitized.endsWith("==") ? 2 : sanitized.endsWith("=") ? 1 : 0;
    return (sanitized.length * 3) / 4 - padding;
};

const ensureReceiptPayload = (
    payload: IAiReceiptAnalyzePayload,
): { imageBase64: string; mimeType: string; walletId?: string; fallbackTimestamp: number } => {
    const imageBase64 = String(payload.imageBase64 || "").replace(/\s/g, "");
    const mimeType = String(payload.mimeType || "").trim().toLowerCase();

    if (!imageBase64) {
        const error = new Error("imageBase64 is required.");
        (error as Error & { statusCode?: number }).statusCode = 400;
        throw error;
    }

    if (!mimeType || !ALLOWED_IMAGE_MIME.has(mimeType)) {
        const error = new Error("Unsupported image mime type.");
        (error as Error & { statusCode?: number }).statusCode = 400;
        throw error;
    }

    const estimatedBytes = estimateBase64Size(imageBase64);
    if (!Number.isFinite(estimatedBytes) || estimatedBytes <= 0 || estimatedBytes > MAX_IMAGE_BYTES) {
        const error = new Error(`image size exceeds limit (${MAX_IMAGE_BYTES} bytes).`);
        (error as Error & { statusCode?: number }).statusCode = 413;
        throw error;
    }

    return {
        imageBase64,
        mimeType,
        walletId: String(payload.walletId || "").trim() || undefined,
        fallbackTimestamp:
            Number.isFinite(payload.fallbackTimestamp) && Number(payload.fallbackTimestamp) > 0
                ? Number(payload.fallbackTimestamp)
                : Date.now(),
    };
};

const matchCategory = (
    categoryName: string | undefined,
    type: "income" | "expense",
    categories: ICategory[],
): { matchedCategoryId?: string; matchedCategoryName?: string; matched: boolean } => {
    const normalizedInput = normalizeText(String(categoryName || ""));

    const candidates = categories.filter((category) => category.type === type);

    if (!normalizedInput || candidates.length === 0) {
        return {
            matched: false,
        };
    }

    const exact = candidates.find((item) => normalizeText(item.name) === normalizedInput);
    if (exact) {
        return {
            matchedCategoryId: exact.id,
            matchedCategoryName: exact.name,
            matched: true,
        };
    }

    const included = candidates.find((item) => {
        const normalizedCategory = normalizeText(item.name);
        return normalizedInput.includes(normalizedCategory) || normalizedCategory.includes(normalizedInput);
    });

    if (included) {
        return {
            matchedCategoryId: included.id,
            matchedCategoryName: included.name,
            matched: true,
        };
    }

    return {
        matched: false,
    };
};

const buildPrompt = (source: "text" | "receipt-ocr", inputText: string, categories: ICategory[]): string => {
    const expenseCategories = categories.filter((item) => item.type === "expense").map((item) => item.name);
    const incomeCategories = categories.filter((item) => item.type === "income").map((item) => item.name);

    return [
        "You are a transaction extraction engine for a personal finance app.",
        "Return ONLY a strict JSON object. Do not include markdown or extra commentary.",
        "Infer from Vietnamese or English naturally.",
        "If uncertain, keep fields empty instead of hallucinating.",
        "Expected JSON schema:",
        JSON.stringify(
            {
                amount: 120000,
                type: "expense",
                date: "2026-03-29",
                merchant: "Coopmart",
                description: "Mua do an",
                category: "An uong",
                confidence: 0.78,
                currency: "VND",
            },
            null,
            2,
        ),
        `Source type: ${source}`,
        `Known expense categories: ${expenseCategories.join(", ") || "(none)"}`,
        `Known income categories: ${incomeCategories.join(", ") || "(none)"}`,
        `Input: ${inputText}`,
    ].join("\n");
};

const toSuggestion = (
    source: "text" | "receipt-ocr",
    raw: IRawAiResult,
    fallbackTimestamp: number,
    textContext: string,
    categoryMatch: { matchedCategoryId?: string; matchedCategoryName?: string; matched: boolean },
): IAiTransactionSuggestion => {
    const resolvedType = raw.type === "income" ? "income" : "expense";
    const resolvedAmount = safeAmount(raw.amount);
    const confidence = clampConfidence(raw.confidence);

    const warnings: string[] = [];
    if (!resolvedAmount) warnings.push("Unable to determine amount confidently.");
    if (!categoryMatch.matched) warnings.push("Could not map category to existing categories.");
    if (confidence < 0.45) warnings.push("AI confidence is low. User confirmation is required.");

    const relativeTimestamp = source === "text"
        ? resolveRelativeTimestamp(textContext, fallbackTimestamp)
        : undefined;
    const parsedTimestamp = parseDateToTimestamp(raw.date, fallbackTimestamp);
    const timestamp = relativeTimestamp ?? parsedTimestamp;

    return {
        source,
        amount: resolvedAmount,
        currency: String(raw.currency || "VND").trim().toUpperCase() || "VND",
        type: resolvedType,
        timestamp,
        merchant: String(raw.merchant || "").trim() || undefined,
        description: String(raw.description || "").trim() || undefined,
        categoryName: categoryMatch.matchedCategoryName || String(raw.category || "").trim() || undefined,
        categoryId: categoryMatch.matchedCategoryId,
        categoryMatched: categoryMatch.matched,
        confidence,
        warnings,
        rawText: textContext,
    };
};

const analyzeFromText = async (
    userId: string,
    payload: IAiTextAnalyzePayload,
): Promise<IAiTransactionSuggestion> => {
    const safePayload = ensureTextPayload(payload);
    const categories = await getCategoriesByUser(userId);

    const prompt = buildPrompt("text", safePayload.text, categories);
    const rawResponseText = await callGeminiGenerateContent({
        parts: [{ text: prompt }],
    });

    const parsed = extractJson(rawResponseText) as IRawAiResult;
    const resolvedType = parsed.type === "income" ? "income" : "expense";
    const categoryMatch = matchCategory(String(parsed.category || ""), resolvedType, categories);

    return toSuggestion("text", parsed, safePayload.fallbackTimestamp, safePayload.text, categoryMatch);
};

const analyzeFromReceiptImage = async (
    userId: string,
    payload: IAiReceiptAnalyzePayload,
): Promise<IAiTransactionSuggestion> => {
    const safePayload = ensureReceiptPayload(payload);
    const categories = await getCategoriesByUser(userId);

    const prompt = buildPrompt(
        "receipt-ocr",
        "Extract transaction information from this receipt image. Prioritize total bill amount and purchase date.",
        categories,
    );

    const rawResponseText = await callGeminiGenerateContent({
        parts: [
            { text: prompt },
            {
                inline_data: {
                    mime_type: safePayload.mimeType,
                    data: safePayload.imageBase64,
                },
            },
        ],
    });

    const parsed = extractJson(rawResponseText) as IRawAiResult;
    const resolvedType = parsed.type === "income" ? "income" : "expense";
    const categoryMatch = matchCategory(String(parsed.category || ""), resolvedType, categories);

    return toSuggestion("receipt-ocr", parsed, safePayload.fallbackTimestamp, "receipt-image", categoryMatch);
};

export { analyzeFromText, analyzeFromReceiptImage };
