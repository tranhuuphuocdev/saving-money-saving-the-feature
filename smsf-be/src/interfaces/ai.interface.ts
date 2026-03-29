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
