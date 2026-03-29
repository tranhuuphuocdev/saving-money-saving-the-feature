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
