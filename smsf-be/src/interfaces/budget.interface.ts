export type TypeBudgetKind = "week" | "month" | "year" | "saving";

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
    createdAt: number;
    updatedAt: number;
}

export interface ISavingGoalSummary {
    amount: number;
    month: number;
    year: number;
    categoryId?: string;
}