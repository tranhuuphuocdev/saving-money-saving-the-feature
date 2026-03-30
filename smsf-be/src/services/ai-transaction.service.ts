import {
    IAiMonthlyInsightPayload,
    IAiMonthlyInsightResult,
    IAiMonthlyInsightWastefulItem,
    IAiReceiptAnalyzePayload,
    IAiTextAnalyzePayload,
    IAiTransactionSuggestion,
    TypeAiInsightPeriod,
    TypeAiMonthlyAnalysis,
} from "../interfaces/ai.interface";
import { callGeminiGenerateContent } from "../lib/gemini-client";
import { ICategory } from "../interfaces/category.interface";
import { getCategoriesByUser } from "./category.service";
import { ITransaction } from "../interfaces/transaction.interface";
import { listTransactionsByMonth, listTransactionsByQuery } from "./transaction.service";

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

interface ICompactMonthlyTransaction {
    id: string;
    ts: number;
    t: "income" | "expense";
    a: number;
    c: string;
    d?: string;
}

interface IRawMonthlyInsightItem {
    transactionId?: string;
    score?: number | string;
    reason?: string;
}

interface IRawMonthlyInsightResult {
    summary?: string;
    highlights?: unknown;
    strengths?: unknown;
    weaknesses?: unknown;
    improvements?: unknown;
    topWasteful?: unknown;
    warnings?: unknown;
}

const MAX_TEXT_INPUT_LENGTH = 1000;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_MIME = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp", "image/heic", "image/heif"]);
const ALLOWED_MONTHLY_ANALYSIS = new Set<TypeAiMonthlyAnalysis>(["spending-overview", "wasteful-top"]);
const ALLOWED_INSIGHT_PERIOD = new Set<TypeAiInsightPeriod>(["day", "week", "month"]);

const TRANSACTION_RESPONSE_SCHEMA: Record<string, unknown> = {
    type: "object",
    properties: {
        amount: { type: "number", nullable: true },
        type: { type: "string", enum: ["income", "expense"] },
        date: { type: "string", nullable: true },
        merchant: { type: "string", nullable: true },
        description: { type: "string", nullable: true },
        category: { type: "string", nullable: true },
        confidence: { type: "number", nullable: true },
        currency: { type: "string", nullable: true },
    },
    required: ["type"],
};

const MONTHLY_INSIGHT_RESPONSE_SCHEMA: Record<string, unknown> = {
    type: "object",
    properties: {
        summary: { type: "string" },
        highlights: { type: "array", items: { type: "string" } },
        strengths: { type: "array", items: { type: "string" } },
        weaknesses: { type: "array", items: { type: "string" } },
        improvements: { type: "array", items: { type: "string" } },
        topWasteful: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    transactionId: { type: "string" },
                    score: { type: "number" },
                    reason: { type: "string" },
                },
                required: ["transactionId", "score", "reason"],
            },
        },
        warnings: { type: "array", items: { type: "string" } },
    },
    required: ["summary", "highlights", "strengths", "weaknesses", "improvements", "topWasteful", "warnings"],
};

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

const sanitizeJsonLikeText = (raw: string): string => {
    return String(raw || "")
        .replace(/^\uFEFF/, "")
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/,\s*([}\]])/g, "$1")
        .trim();
};

const parseJsonObjectCandidate = (candidate: string): Record<string, unknown> | null => {
    const sanitized = sanitizeJsonLikeText(candidate);
    if (!sanitized) return null;

    try {
        const parsed = JSON.parse(sanitized) as unknown;

        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            return parsed as Record<string, unknown>;
        }

        if (typeof parsed === "string") {
            const reparsed = JSON.parse(sanitizeJsonLikeText(parsed)) as unknown;
            if (reparsed && typeof reparsed === "object" && !Array.isArray(reparsed)) {
                return reparsed as Record<string, unknown>;
            }
        }
    } catch {
        return null;
    }

    return null;
};

const extractBalancedJsonObjectCandidates = (input: string): string[] => {
    const text = String(input || "");
    const candidates: string[] = [];

    for (let start = 0; start < text.length; start += 1) {
        if (text[start] !== "{") continue;

        let depth = 0;
        let inString = false;
        let escaped = false;

        for (let i = start; i < text.length; i += 1) {
            const ch = text[i];

            if (inString) {
                if (escaped) {
                    escaped = false;
                    continue;
                }

                if (ch === "\\") {
                    escaped = true;
                    continue;
                }

                if (ch === '"') {
                    inString = false;
                }

                continue;
            }

            if (ch === '"') {
                inString = true;
                continue;
            }

            if (ch === "{") {
                depth += 1;
                continue;
            }

            if (ch === "}") {
                depth -= 1;
                if (depth === 0) {
                    candidates.push(text.slice(start, i + 1));
                    break;
                }
            }
        }
    }

    return candidates;
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

    const directParsed = parseJsonObjectCandidate(withoutFence);
    if (directParsed) {
        return directParsed;
    }

    const candidates = extractBalancedJsonObjectCandidates(withoutFence);
    for (const candidate of candidates) {
        const parsed = parseJsonObjectCandidate(candidate);
        if (parsed) {
            return parsed;
        }
    }

    throw new Error("AI response is not a valid JSON object.");
};

const toSchemaHint = (schema: Record<string, unknown>): string => {
    return JSON.stringify(schema);
};

const requestGeminiJsonObject = async (params: {
    parts: Array<{ text: string } | { inline_data: { mime_type: string; data: string } }>;
    responseSchema: Record<string, unknown>;
}): Promise<Record<string, unknown>> => {
    const rawResponseText = await callGeminiGenerateContent({
        parts: params.parts,
        responseSchema: params.responseSchema,
    });

    try {
        return extractJson(rawResponseText);
    } catch {
        const repairPrompt = [
            "Convert the following content into ONE strict JSON object.",
            "Output must be JSON only, without markdown/code fences/comments.",
            `Schema: ${toSchemaHint(params.responseSchema)}`,
            `Content: ${rawResponseText}`,
        ].join("\n");

        const repairedResponse = await callGeminiGenerateContent({
            parts: [{ text: repairPrompt }],
            responseSchema: params.responseSchema,
        });

        return extractJson(repairedResponse);
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

const inferInsightPeriodFromUserQuery = (params: {
    userQuery?: string;
    fallbackPeriodType: TypeAiInsightPeriod;
    fallbackTimestamp: number;
}): { periodType: TypeAiInsightPeriod; referenceTimestamp: number } => {
    const rawQuery = String(params.userQuery || "").trim();
    if (!rawQuery) {
        return {
            periodType: params.fallbackPeriodType,
            referenceTimestamp: params.fallbackTimestamp,
        };
    }

    const normalized = normalizeRelativeText(rawQuery);

    if (normalized.includes("hom nay") || normalized.includes("today")) {
        return {
            periodType: "day",
            referenceTimestamp: params.fallbackTimestamp,
        };
    }

    if (normalized.includes("tuan nay") || normalized.includes("this week")) {
        return {
            periodType: "week",
            referenceTimestamp: params.fallbackTimestamp,
        };
    }

    const explicitDate = rawQuery.match(/(?:ngày\s*)?(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?/i);
    if (explicitDate) {
        const day = Number(explicitDate[1]);
        const month = Number(explicitDate[2]);
        const yearRaw = Number(explicitDate[3]);
        const nowYear = new Date(params.fallbackTimestamp).getFullYear();
        const year = Number.isFinite(yearRaw)
            ? (yearRaw < 100 ? 2000 + yearRaw : yearRaw)
            : nowYear;

        const parsed = new Date(year, month - 1, day, 12, 0, 0, 0).getTime();
        if (Number.isFinite(parsed)) {
            return {
                periodType: "day",
                referenceTimestamp: parsed,
            };
        }
    }

    return {
        periodType: params.fallbackPeriodType,
        referenceTimestamp: params.fallbackTimestamp,
    };
};

const ensureMonthlyInsightPayload = (
    payload: IAiMonthlyInsightPayload,
): {
    month: number;
    year: number;
    analysisType: TypeAiMonthlyAnalysis;
    periodType: TypeAiInsightPeriod;
    referenceTimestamp: number;
    userQuery?: string;
} => {
    const now = new Date();
    const month = Number(payload.month) || now.getMonth() + 1;
    const year = Number(payload.year) || now.getFullYear();
    const rawAnalysisType = String(payload.analysisType || "spending-overview").trim() as TypeAiMonthlyAnalysis;
    const analysisType = ALLOWED_MONTHLY_ANALYSIS.has(rawAnalysisType)
        ? rawAnalysisType
        : "spending-overview";
    const rawPeriod = String(payload.periodType || "month").trim().toLowerCase();

    if (rawPeriod === "year") {
        const error = new Error("trợ lý Pô con chưa được nạp VIP lần đầu, bạn thông cảm nhé huhu");
        (error as Error & { statusCode?: number }).statusCode = 400;
        throw error;
    }

    const periodType = ALLOWED_INSIGHT_PERIOD.has(rawPeriod as TypeAiInsightPeriod)
        ? rawPeriod as TypeAiInsightPeriod
        : "month";

    if (!Number.isInteger(month) || month < 1 || month > 12) {
        const error = new Error("month must be in range 1..12.");
        (error as Error & { statusCode?: number }).statusCode = 400;
        throw error;
    }

    if (!Number.isInteger(year) || year < 2000 || year > 2200) {
        const error = new Error("year is out of range.");
        (error as Error & { statusCode?: number }).statusCode = 400;
        throw error;
    }

    const fallbackTimestamp =
        Number.isFinite(payload.referenceTimestamp) && Number(payload.referenceTimestamp) > 0
            ? Number(payload.referenceTimestamp)
            : Date.now();
    const userQuery = String(payload.userQuery || "").trim() || undefined;
    const inferred = inferInsightPeriodFromUserQuery({
        userQuery,
        fallbackPeriodType: periodType,
        fallbackTimestamp,
    });

    return {
        month,
        year,
        analysisType,
        periodType: inferred.periodType,
        referenceTimestamp: inferred.referenceTimestamp,
        userQuery,
    };
};

const getPeriodRange = (params: {
    periodType: TypeAiInsightPeriod;
    month: number;
    year: number;
    referenceTimestamp: number;
}): { periodStart: number; periodEnd: number; month: number; year: number; periodLabel: string } => {
    const ref = new Date(params.referenceTimestamp);
    let start = new Date(ref);
    let end = new Date(ref);

    if (params.periodType === "day") {
        start = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), 0, 0, 0, 0);
        end = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), 23, 59, 59, 999);
    } else if (params.periodType === "week") {
        const day = ref.getDay();
        const diffToMonday = day === 0 ? -6 : 1 - day;
        start = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() + diffToMonday, 0, 0, 0, 0);
        end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6, 23, 59, 59, 999);
    } else {
        start = new Date(params.year, params.month - 1, 1, 0, 0, 0, 0);
        end = new Date(params.year, params.month, 0, 23, 59, 59, 999);
    }

    const label = params.periodType === "day"
        ? `ngày ${start.getDate().toString().padStart(2, "0")}/${(start.getMonth() + 1).toString().padStart(2, "0")}/${start.getFullYear()}`
        : params.periodType === "week"
            ? `tuần ${start.getDate().toString().padStart(2, "0")}/${(start.getMonth() + 1).toString().padStart(2, "0")} - ${end.getDate().toString().padStart(2, "0")}/${(end.getMonth() + 1).toString().padStart(2, "0")}/${end.getFullYear()}`
            : `tháng ${(start.getMonth() + 1).toString().padStart(2, "0")}/${start.getFullYear()}`;

    return {
        periodStart: start.getTime(),
        periodEnd: end.getTime(),
        month: start.getMonth() + 1,
        year: start.getFullYear(),
        periodLabel: label,
    };
};

const listTransactionsByRange = async (
    userId: string,
    periodStart: number,
    periodEnd: number,
): Promise<ITransaction[]> => {
    const items: ITransaction[] = [];
    let page = 1;
    const limit = 500;

    while (page <= 5) {
        const result = await listTransactionsByQuery(userId, {
            startTime: periodStart,
            endTime: periodEnd,
            page,
            limit,
        });

        items.push(...result.items);
        if (!result.hasMore) break;
        page += 1;
    }

    return items;
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

const toCompactTransactions = (
    transactions: ITransaction[],
    categories: ICategory[],
): ICompactMonthlyTransaction[] => {
    const categoryMap = new Map(categories.map((item) => [item.id, item.name]));

    return transactions.map((transaction) => ({
        id: transaction.id,
        ts: transaction.timestamp,
        t: transaction.type,
        a: transaction.amount,
        c: String(transaction.categoryName || categoryMap.get(transaction.category) || transaction.category || "Khác"),
        d: String(transaction.description || "").trim() || undefined,
    }));
};

const toStringList = (value: unknown, maxItems: number): string[] => {
    if (!Array.isArray(value)) return [];

    return value
        .map((item) => String(item || "").trim())
        .filter(Boolean)
        .slice(0, maxItems);
};

const buildMonthlyInsightPrompt = (params: {
    analysisType: TypeAiMonthlyAnalysis;
    periodType: TypeAiInsightPeriod;
    periodLabel: string;
    userQuery?: string;
    month: number;
    year: number;
    totals: { totalIncome: number; totalExpense: number; totalTransactions: number };
    compactTransactions: ICompactMonthlyTransaction[];
}): string => {
    const modeLabel =
        params.analysisType === "wasteful-top"
            ? "Top giao dịch không đáng"
            : "Phân tích chi tiêu tổng quan";
    const periodRules = params.periodType === "day"
        ? [
            "- Scope is EXACTLY one day (the day in Period label).",
            "- Do NOT summarize the whole month.",
            "- In summary/highlights, explicitly mention this day context.",
        ]
        : params.periodType === "week"
            ? [
                "- Scope is EXACTLY one week (the week range in Period label).",
                "- Do NOT summarize the whole month.",
                "- In summary/highlights, explicitly mention this week context.",
            ]
            : [
                "- Scope is this month only.",
            ];
    const modeRequirements = params.analysisType === "wasteful-top"
        ? [
            "- strengths: must be an empty array [].",
            "- weaknesses: must be an empty array [].",
            "- improvements: must be an empty array [].",
            "- topWasteful: return 3-5 unusual expense transactions if possible.",
            "- reason in each topWasteful item must explain: why this looks unusual, and in what scenario this expense may still be necessary.",
        ]
        : [
            "- strengths: 1-3 positive aspects of this spending period.",
            "- weaknesses: 1-3 problematic patterns or overspending areas.",
            "- improvements: 2-3 actionable suggestions to improve next period.",
            "- topWasteful: can be empty or max 3 items.",
        ];

    return [
        "You are a concise period-based finance analyst for a Vietnamese personal finance app.",
        "Return ONLY strict JSON with schema:",
        JSON.stringify(
            {
                summary: "string",
                highlights: ["string"],
                strengths: ["string"],
                weaknesses: ["string"],
                improvements: ["string"],
                topWasteful: [{ transactionId: "string", score: 0.7, reason: "string" }],
                warnings: ["string"],
            },
            null,
            2,
        ),
        "Requirements:",
        "- Language: Vietnamese WITH full diacritical marks (tiếng Việt có dấu). NEVER write Vietnamese without diacritics.",
        "- summary: 1-2 short sentences summarizing overall health for this analysis mode.",
        "- highlights: 2-4 key numerical insights (amounts, percentages).",
        ...periodRules,
        "- topWasteful: choose only IDs from input data.",
        ...modeRequirements,
        "- score in range 0..1 (higher means less essential spending).",
        buildMonthlyModeGuardrail(params.analysisType),
        `Analysis mode: ${modeLabel}`,
        `Period type: ${params.periodType}`,
        `Period label: ${params.periodLabel}`,
        `User request: ${params.userQuery || "(none)"}`,
        `Totals: income=${params.totals.totalIncome}, expense=${params.totals.totalExpense}, count=${params.totals.totalTransactions}`,
        "Compact transaction fields:",
        "- id: transaction id",
        "- ts: timestamp (ms)",
        "- t: income|expense",
        "- a: amount (VND)",
        "- c: category name",
        "- d: description (optional)",
        `Data: ${JSON.stringify(params.compactTransactions)}`,
    ].join("\n");
};

const normalizeWastefulItems = (params: {
    value: unknown;
    compactTransactions: ICompactMonthlyTransaction[];
    analysisType: TypeAiMonthlyAnalysis;
}): IAiMonthlyInsightWastefulItem[] => {
    const transactionMap = new Map(params.compactTransactions.map((item) => [item.id, item]));

    if (!Array.isArray(params.value)) {
        return [];
    }

    const mapped = (params.value as IRawMonthlyInsightItem[])
        .map((item) => {
            const transactionId = String(item.transactionId || "").trim();
            if (!transactionId || !transactionMap.has(transactionId)) return null;

            const transaction = transactionMap.get(transactionId);
            if (!transaction) return null;

            const score = clampConfidence(item.score);
            const reason = String(item.reason || "").trim() || "Chi phí có dấu hiệu chưa tối ưu.";

            return {
                transactionId,
                amount: transaction.a,
                categoryName: transaction.c,
                description: transaction.d,
                timestamp: transaction.ts,
                score,
                reason,
            };
        })
        .filter(Boolean) as IAiMonthlyInsightWastefulItem[];

    const sorted = mapped.sort((left, right) => right.score - left.score);

    if (params.analysisType === "wasteful-top") {
        return sorted.slice(0, 5);
    }

    return sorted.slice(0, 3);
};

const buildFallbackWastefulItems = (
    compactTransactions: ICompactMonthlyTransaction[],
    limit: number,
): IAiMonthlyInsightWastefulItem[] => {
    return compactTransactions
        .filter((item) => item.t === "expense")
        .sort((left, right) => right.a - left.a)
        .slice(0, limit)
        .map((item, index) => ({
            transactionId: item.id,
            amount: item.a,
            categoryName: item.c,
            description: item.d,
            timestamp: item.ts,
            score: Math.max(0.45, 0.88 - index * 0.09),
            reason: "Giá trị giao dịch cao so với mặt bằng chi tiêu; cần đối chiếu đây là nhu cầu thiết yếu hay khoản phát sinh chưa cần ngay.",
        }));
};

const alignWastefulTopOutput = (params: {
    periodLabel: string;
    topWasteful: IAiMonthlyInsightWastefulItem[];
    totalExpense: number;
}): { summary: string; highlights: string[] } => {
    const top1 = params.topWasteful[0];
    const top3Total = params.topWasteful.slice(0, 3).reduce((sum, item) => sum + item.amount, 0);
    const expenseShare = params.totalExpense > 0
        ? Math.round((top3Total / params.totalExpense) * 100)
        : 0;

    const summary = top1
        ? `Top giao dịch bất thường ${params.periodLabel} đã được tổng hợp, dùng để ưu tiên cắt giảm.`
        : `${params.periodLabel} không đủ dữ liệu chi tiêu để xếp hạng giao dịch bất thường.`;

    const highlights = top1
        ? [
            `Khoản đứng đầu là ${top1.amount.toLocaleString("vi-VN")} VND (${top1.categoryName}).`,
            `Top 3 khoản chiếm khoảng ${expenseShare}% tổng chi tiêu trong kỳ phân tích này.`,
            "Nên ưu tiên xem lại những khoản chi lớn có tần suất lặp lại.",
        ]
        : ["Chưa tìm thấy giao dịch chi tiêu để đánh giá bất thường."];

    return { summary, highlights };
};

const enforceInsightContextByPeriod = (params: {
    periodType: TypeAiInsightPeriod;
    periodLabel: string;
    summary: string;
    highlights: string[];
}): { summary: string; highlights: string[] } => {
    const rewriteLine = (line: string): string => String(line || "")
        .replace(/tháng này/gi, "kỳ phân tích này")
        .replace(/thang nay/gi, "kỳ phân tích này")
        .replace(/trong tháng/gi, "trong kỳ")
        .replace(/trong thang/gi, "trong kỳ")
        .replace(/theo tháng/gi, "theo kỳ");

    if (params.periodType === "month") {
        return {
            summary: params.summary,
            highlights: params.highlights,
        };
    }

    const marker = params.periodType === "day" ? "ngày" : "tuần";
    let summary = rewriteLine(params.summary);
    if (!summary.toLowerCase().includes(marker)) {
        summary = `Phân tích ${params.periodLabel}: ${summary}`;
    }

    let highlights = params.highlights.map((line) => rewriteLine(line));
    const hasMarker = highlights.some((line) => line.toLowerCase().includes(marker));
    if (!hasMarker) {
        highlights = [`Phạm vi phân tích: ${params.periodLabel}.`, ...highlights].slice(0, 4);
    }

    return { summary, highlights };
};

const buildHeuristicMonthlyInsight = (params: {
    analysisType: TypeAiMonthlyAnalysis;
    periodType: TypeAiInsightPeriod;
    periodLabel: string;
    periodStart: number;
    periodEnd: number;
    month: number;
    year: number;
    totalIncome: number;
    totalExpense: number;
    totalTransactions: number;
    compactTransactions: ICompactMonthlyTransaction[];
}): IAiMonthlyInsightResult => {
    const topWasteful = buildFallbackWastefulItems(
        params.compactTransactions,
        params.analysisType === "wasteful-top" ? 5 : 3,
    );

    const savings = params.totalIncome - params.totalExpense;
    const savingsLabel = savings >= 0
        ? `${savings.toLocaleString("vi-VN")} VND`
        : `-${Math.abs(savings).toLocaleString("vi-VN")} VND`;
    const highlights = [
        `Tổng chi tháng này là ${params.totalExpense.toLocaleString("vi-VN")} VND.`,
        `Tổng thu tháng này là ${params.totalIncome.toLocaleString("vi-VN")} VND.`,
        savings >= 0
            ? `Bạn đang dư ra ${savingsLabel} trong tháng này.`
            : `Bạn đang âm ${savingsLabel} trong tháng này.`,
    ];
    const strengths = params.analysisType === "spending-overview" && savings >= 0
        ? ["Đã kiểm soát được chi tiêu trong giới hạn thu nhập."]
        : [];
    const weaknesses = params.analysisType === "spending-overview" && savings < 0
        ? ["Chi tiêu vượt quá thu nhập trong kỳ này."]
        : [];
    const improvements = params.analysisType === "spending-overview"
        ? ["Theo dõi thêm các khoản chi lớn để tối ưu trong kỳ sau."]
        : [];

    const wastefulAligned =
        params.analysisType === "wasteful-top"
            ? alignWastefulTopOutput({
                periodLabel: params.periodLabel,
                topWasteful,
                totalExpense: params.totalExpense,
            })
            : null;

    return {
        analysisType: params.analysisType,
        periodType: params.periodType,
        periodLabel: params.periodLabel,
        periodStart: params.periodStart,
        periodEnd: params.periodEnd,
        month: params.month,
        year: params.year,
        summary: wastefulAligned?.summary || `Mình đã phân tích ${params.totalTransactions} giao dịch trong ${params.periodLabel}.`,
        highlights: wastefulAligned?.highlights || highlights,
        strengths,
        weaknesses,
        improvements,
        topWasteful,
        warnings: [
            "trợ lý Pô con đang đói bụng, đợi ăn xong mình phân tích thêm nhé!",
            "Đã dùng chế độ dự phòng vì phân tích AI tạm thời chưa ổn định.",
        ],
        totalTransactions: params.totalTransactions,
        totalIncome: params.totalIncome,
        totalExpense: params.totalExpense,
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

const buildMonthlyModeGuardrail = (analysisType: TypeAiMonthlyAnalysis): string => {
    if (analysisType === "wasteful-top") {
        return [
            "IMPORTANT MODE RULE:",
            "- Focus ONLY on unusual / potentially unnecessary expense transactions.",
            "- Do NOT return generic conclusions like 'chi tieu on dinh' or 'tiet kiem tot' without concrete top transactions.",
            "- Do NOT provide strengths/weaknesses/improvements in this mode.",
            "- highlights must mention why each unusual expense is abnormal and when it might still be necessary.",
        ].join("\n");
    }

    return [
        "IMPORTANT MODE RULE:",
        "- Focus on overall spending health and trend.",
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
    const parsed = await requestGeminiJsonObject({
        parts: [{ text: prompt }],
        responseSchema: TRANSACTION_RESPONSE_SCHEMA,
    }) as IRawAiResult;
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

    const parsed = await requestGeminiJsonObject({
        parts: [
            { text: prompt },
            {
                inline_data: {
                    mime_type: safePayload.mimeType,
                    data: safePayload.imageBase64,
                },
            },
        ],
        responseSchema: TRANSACTION_RESPONSE_SCHEMA,
    }) as IRawAiResult;
    const resolvedType = parsed.type === "income" ? "income" : "expense";
    const categoryMatch = matchCategory(String(parsed.category || ""), resolvedType, categories);

    return toSuggestion("receipt-ocr", parsed, safePayload.fallbackTimestamp, "receipt-image", categoryMatch);
};

const analyzeMonthlyInsights = async (
    userId: string,
    payload: IAiMonthlyInsightPayload,
): Promise<IAiMonthlyInsightResult> => {
    const safePayload = ensureMonthlyInsightPayload(payload);
    const period = getPeriodRange({
        periodType: safePayload.periodType,
        month: safePayload.month,
        year: safePayload.year,
        referenceTimestamp: safePayload.referenceTimestamp,
    });

    const [transactions, categories] = await Promise.all([
        listTransactionsByRange(userId, period.periodStart, period.periodEnd),
        getCategoriesByUser(userId),
    ]);

    const totalIncome = transactions
        .filter((item) => item.type === "income")
        .reduce((sum, item) => sum + item.amount, 0);
    const totalExpense = transactions
        .filter((item) => item.type === "expense")
        .reduce((sum, item) => sum + item.amount, 0);
    const totalTransactions = transactions.length;

    if (transactions.length === 0) {
        return {
            analysisType: safePayload.analysisType,
            periodType: safePayload.periodType,
            periodLabel: period.periodLabel,
            periodStart: period.periodStart,
            periodEnd: period.periodEnd,
            month: period.month,
            year: period.year,
            summary: `${period.periodLabel} bạn chưa có giao dịch nào để phân tích.`,
            highlights: ["Hãy thêm giao dịch để AI đưa ra nhận định sát hơn."],
            strengths: [],
            weaknesses: [],
            improvements: ["Bắt đầu ghi chép giao dịch hằng ngày để AI có dữ liệu phân tích."],
            topWasteful: [],
            warnings: [],
            totalTransactions,
            totalIncome,
            totalExpense,
        };
    }

    const compactTransactions = toCompactTransactions(transactions, categories);
    const prompt = buildMonthlyInsightPrompt({
        analysisType: safePayload.analysisType,
        periodType: safePayload.periodType,
        periodLabel: period.periodLabel,
        userQuery: safePayload.userQuery,
        month: period.month,
        year: period.year,
        totals: {
            totalIncome,
            totalExpense,
            totalTransactions,
        },
        compactTransactions,
    });

    try {
        let bestCandidate: {
            summary: string;
            highlights: string[];
            strengths: string[];
            weaknesses: string[];
            improvements: string[];
            topWasteful: IAiMonthlyInsightWastefulItem[];
            warnings: string[];
        } | null = null;

        for (let attempt = 1; attempt <= 3; attempt += 1) {
            const parsed = await requestGeminiJsonObject({
                parts: [{ text: prompt }],
                responseSchema: MONTHLY_INSIGHT_RESPONSE_SCHEMA,
            }) as IRawMonthlyInsightResult;

            const summary =
                String(parsed.summary || "").trim()
                || `Đã phân tích ${totalTransactions} giao dịch trong ${period.periodLabel}.`;
            const highlights = toStringList(parsed.highlights, 4);
            const strengths = toStringList(parsed.strengths, 3);
            const weaknesses = toStringList(parsed.weaknesses, 3);
            const improvements = toStringList(parsed.improvements, 3);
            const warnings = toStringList(parsed.warnings, 3);
            const topWastefulRaw = normalizeWastefulItems({
                value: parsed.topWasteful,
                compactTransactions,
                analysisType: safePayload.analysisType,
            });

            const topWasteful =
                safePayload.analysisType === "wasteful-top" && topWastefulRaw.length === 0
                    ? buildFallbackWastefulItems(compactTransactions, 5)
                    : topWastefulRaw;

            bestCandidate = {
                summary,
                highlights,
                strengths,
                weaknesses,
                improvements,
                topWasteful,
                warnings,
            };

            const hasEnoughSections =
                safePayload.analysisType === "wasteful-top"
                    ? highlights.length > 0 && topWasteful.length > 0
                    : highlights.length > 0
                        && strengths.length > 0
                        && weaknesses.length > 0
                        && improvements.length > 0;

            if (hasEnoughSections) {
                break;
            }
        }

        if (!bestCandidate) {
            throw new Error("Empty insight candidate");
        }

        const fallbackNote = "trợ lý Pô con đang đói bụng, đợi ăn xong mình phân tích thêm nhé!";
        const safeHighlights = bestCandidate.highlights.length > 0
            ? bestCandidate.highlights
            : [`Chưa đủ dữ liệu nhận định chi tiết cho ${period.periodLabel}.`];
        const safeStrengths = safePayload.analysisType === "wasteful-top"
            ? []
            : bestCandidate.strengths.length > 0
                ? bestCandidate.strengths
                : ["Cần thêm dữ liệu để xác định ưu điểm rõ hơn."];
        const safeWeaknesses = safePayload.analysisType === "wasteful-top"
            ? []
            : bestCandidate.weaknesses.length > 0
                ? bestCandidate.weaknesses
                : ["Cần thêm dữ liệu để chỉ ra điểm chưa tối ưu rõ hơn."];
        const safeImprovements = safePayload.analysisType === "wasteful-top"
            ? []
            : bestCandidate.improvements.length > 0
                ? bestCandidate.improvements
                : ["Theo dõi chi tiêu đều đặn để trợ lý đề xuất chính xác hơn."];
        const composedWarnings = [...bestCandidate.warnings];

        const stillMissingSections =
            safePayload.analysisType === "wasteful-top"
                ? bestCandidate.highlights.length === 0 || bestCandidate.topWasteful.length === 0
                : bestCandidate.highlights.length === 0
                    || bestCandidate.strengths.length === 0
                    || bestCandidate.weaknesses.length === 0
                    || bestCandidate.improvements.length === 0;

        if (stillMissingSections) {
            composedWarnings.unshift(fallbackNote);
        }

        const wastefulAligned =
            safePayload.analysisType === "wasteful-top"
                ? alignWastefulTopOutput({
                    periodLabel: period.periodLabel,
                    topWasteful: bestCandidate.topWasteful,
                    totalExpense,
                })
                : null;
        const periodAligned = enforceInsightContextByPeriod({
            periodType: safePayload.periodType,
            periodLabel: period.periodLabel,
            summary: wastefulAligned?.summary || bestCandidate.summary,
            highlights: wastefulAligned?.highlights || safeHighlights,
        });

        return {
            analysisType: safePayload.analysisType,
            periodType: safePayload.periodType,
            periodLabel: period.periodLabel,
            periodStart: period.periodStart,
            periodEnd: period.periodEnd,
            month: period.month,
            year: period.year,
            summary: periodAligned.summary,
            highlights: periodAligned.highlights,
            strengths: safeStrengths,
            weaknesses: safeWeaknesses,
            improvements: safeImprovements,
            topWasteful: bestCandidate.topWasteful,
            warnings: composedWarnings,
            totalTransactions,
            totalIncome,
            totalExpense,
        };
    } catch {
        return buildHeuristicMonthlyInsight({
            analysisType: safePayload.analysisType,
            periodType: safePayload.periodType,
            periodLabel: period.periodLabel,
            periodStart: period.periodStart,
            periodEnd: period.periodEnd,
            month: period.month,
            year: period.year,
            totalIncome,
            totalExpense,
            totalTransactions,
            compactTransactions,
        });
    }
};

const MULTI_TRANSACTION_RESPONSE_SCHEMA: Record<string, unknown> = {
    type: "object",
    properties: {
        transactions: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    amount: { type: "number", nullable: true },
                    type: { type: "string", enum: ["income", "expense"] },
                    date: { type: "string", nullable: true },
                    merchant: { type: "string", nullable: true },
                    description: { type: "string", nullable: true },
                    category: { type: "string", nullable: true },
                    confidence: { type: "number", nullable: true },
                    currency: { type: "string", nullable: true },
                },
                required: ["type"],
            },
        },
    },
    required: ["transactions"],
};

const buildMultiTransactionPrompt = (
    text: string,
    categories: ICategory[],
    fallbackTimestamp: number,
): string => {
    const expenseCategories = categories.filter((item) => item.type === "expense").map((item) => item.name);
    const incomeCategories = categories.filter((item) => item.type === "income").map((item) => item.name);
    const todayStr = new Date(fallbackTimestamp).toISOString().split("T")[0];
    const yesterdayStr = new Date(fallbackTimestamp - 86400000).toISOString().split("T")[0];

    return [
        "You are a transaction extraction engine for a personal finance app.",
        "The input may contain ONE OR MORE transaction descriptions.",
        "Return ONLY a strict JSON object with a \"transactions\" array.",
        "Each item in the array must follow this schema:",
        JSON.stringify(
            {
                amount: 35000,
                type: "expense",
                date: "2026-03-28",
                merchant: null,
                description: "Phở gà",
                category: "Ăn uống",
                confidence: 0.9,
                currency: "VND",
            },
            null,
            2,
        ),
        "Rules:",
        "- Extract ALL transactions mentioned.",
        "- Resolve ALL relative dates to absolute YYYY-MM-DD format.",
        `- Today is ${todayStr}. Yesterday is ${yesterdayStr}.`,
        "- 'hôm nay' or 'today' = " + todayStr,
        "- 'hôm qua' or 'yesterday' = " + yesterdayStr,
        "- For explicit dates like '28/3' or '28/3/2026', resolve to absolute date.",
        "- If date is missing, use today's date.",
        "- If amount is missing or unclear, set to null.",
        "- confidence in 0..1 range.",
        `- Known expense categories: ${expenseCategories.join(", ") || "(none)"}`,
        `- Known income categories: ${incomeCategories.join(", ") || "(none)"}`,
        `Input: ${text}`,
    ].join("\n");
};

const analyzeFromTextMulti = async (
    userId: string,
    payload: IAiTextAnalyzePayload,
): Promise<IAiTransactionSuggestion[]> => {
    const safePayload = ensureTextPayload(payload);
    const categories = await getCategoriesByUser(userId);

    const prompt = buildMultiTransactionPrompt(
        safePayload.text,
        categories,
        safePayload.fallbackTimestamp,
    );
    const parsed = await requestGeminiJsonObject({
        parts: [{ text: prompt }],
        responseSchema: MULTI_TRANSACTION_RESPONSE_SCHEMA,
    });

    const rawList = Array.isArray(parsed.transactions)
        ? (parsed.transactions as IRawAiResult[])
        : [];

    if (rawList.length === 0) {
        return [toSuggestion("text", {}, safePayload.fallbackTimestamp, safePayload.text, { matched: false })];
    }

    return rawList.map((raw) => {
        const resolvedType = raw.type === "income" ? "income" : "expense";
        const categoryMatch = matchCategory(String(raw.category || ""), resolvedType, categories);
        // Pass empty text context so resolveRelativeTimestamp is skipped —
        // the AI has already resolved relative dates to absolute YYYY-MM-DD.
        return toSuggestion("text", raw, safePayload.fallbackTimestamp, "", categoryMatch);
    });
};

export { analyzeFromText, analyzeFromTextMulti, analyzeFromReceiptImage, analyzeMonthlyInsights };
