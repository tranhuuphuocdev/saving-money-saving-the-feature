import { TypeTransactionKind } from '@/types/calendar';

export interface IAiTransactionSuggestion {
    source: 'text' | 'receipt-ocr';
    amount: number | null;
    currency: string;
    type: TypeTransactionKind;
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

export type TypeAiMonthlyAnalysis = 'spending-overview' | 'wasteful-top';
export type TypeAiInsightPeriod = 'day' | 'week' | 'month';

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
