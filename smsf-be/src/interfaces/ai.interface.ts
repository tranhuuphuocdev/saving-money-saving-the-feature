export type TypeAiSource = "text" | "receipt-ocr";

export interface IAiTransactionSuggestion {
    source: TypeAiSource;
    amount: number | null;
    currency: string;
    type: "income" | "expense";
    timestamp: number;
    merchant?: string;
    description?: string;
    categoryName?: string;
    categoryId?: string;
    categoryMatched: boolean;
    confidence: number;
    warnings: string[];
    rawText?: string;
}

export interface IAiReceiptAnalyzePayload {
    imageBase64: string;
    mimeType: string;
    walletId?: string;
    fallbackTimestamp?: number;
}

export interface IAiTextAnalyzePayload {
    text: string;
    walletId?: string;
    fallbackTimestamp?: number;
}

export type TypeAiMonthlyAnalysis = "spending-overview" | "wasteful-top";
export type TypeAiInsightPeriod = "day" | "week" | "month";

export interface IAiMonthlyInsightPayload {
    month?: number;
    year?: number;
    analysisType?: TypeAiMonthlyAnalysis;
    periodType?: TypeAiInsightPeriod;
    referenceTimestamp?: number;
    userQuery?: string;
}

export interface IAiMonthlyInsightWastefulItem {
    transactionId: string;
    amount: number;
    categoryName: string;
    description?: string;
    timestamp: number;
    score: number;
    reason: string;
}

export interface IAiMonthlyInsightResult {
    analysisType: TypeAiMonthlyAnalysis;
    periodType: TypeAiInsightPeriod;
    periodLabel: string;
    periodStart: number;
    periodEnd: number;
    month: number;
    year: number;
    summary: string;
    highlights: string[];
    strengths: string[];
    weaknesses: string[];
    improvements: string[];
    topWasteful: IAiMonthlyInsightWastefulItem[];
    warnings: string[];
    totalTransactions: number;
    totalIncome: number;
    totalExpense: number;
}
