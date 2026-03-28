export type TypeCategoryKind = "income" | "expense";

export interface ICategory {
    id: string;
    userId: string;
    name: string;
    icon?: string;
    type: TypeCategoryKind;
    isDefault: boolean;
    isDeleted: boolean;
    createdAt: number;
    updatedAt: number;
}
