export type TypeBudgetKind = "week" | "month" | "year" | "saving" | "jar";

export interface IBudget {
    id: string;
    userId: string;
    categoryId: string;
    name: string;
    amount: number;
    description?: string;
    type: TypeBudgetKind;
    periodMonth: number;
    periodYear: number;
    spentAmount?: number;
    createdAt: number;
    updatedAt: number;
}

export interface ISavingGoalSummary {
    amount: number;
    month: number;
    year: number;
    categoryId?: string;
}

export interface IBudgetJar {
    id: string;
    name: string;
    month: number;
    year: number;
    targetAmount: number;
    spentAmount: number;
    progressPercent: number;
    remainingAmount: number;
    categoryIds: string[];
    categoryNames: string[];
}

export interface IBudgetJarSetupItem {
    name: string;
    targetAmount?: number;
    targetPercent?: number;
    categoryIds: string[];
}

export interface IBudgetJarSetupPayload {
    month: number;
    year: number;
    incomeAmount?: number;
    jars: IBudgetJarSetupItem[];
}

export interface IBudgetJarPresetItem {
    name: string;
    targetPercent: number;
    targetAmount?: number;
    categoryNames: string[];
}

export interface IBudgetJarPreset {
    code: string;
    label: string;
    incomeHint: string;
    items: IBudgetJarPresetItem[];
}