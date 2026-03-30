export type TypeCategoryKind = "income" | "expense";

export interface IDefaultCategorySeed {
    name: string;
    type: TypeCategoryKind;
    icon: string;
    index: number;
}

export const DEFAULT_CATEGORIES: IDefaultCategorySeed[] = [
    { name: "Ăn uống", type: "expense", icon: "🍜", index: 0 },
    { name: "Di chuyển", type: "expense", icon: "🚌", index: 1 },
    { name: "Shopee", type: "expense", icon: "📦", index: 2 },
    { name: "Đi chợ", type: "expense", icon: "🛒", index: 3 },
    { name: "Giải trí", type: "expense", icon: "🎮", index: 4 },
    { name: "Mua sắm", type: "expense", icon: "🛍️", index: 5 },
    { name: "Sức khỏe", type: "expense", icon: "💊", index: 6 },
    { name: "Nhà cửa", type: "expense", icon: "🏠", index: 7 },
    { name: "Học tập", type: "expense", icon: "📚", index: 8 },
    { name: "Tình iu", type: "expense", icon: "💗", index: 9 },
    { name: "Tiết kiệm", type: "expense", icon: "💰", index: 10 },
    { name: "Khác", type: "expense", icon: "🧩", index: 11 },
    { name: "Lương", type: "income", icon: "💼", index: 12 },
    { name: "Freelance", type: "income", icon: "🧑‍💻", index: 13 },
    { name: "Thưởng", type: "income", icon: "🎁", index: 14 },
    { name: "Đầu tư", type: "income", icon: "📈", index: 15 },
    { name: "Khác", type: "income", icon: "🧩", index: 16 },
];
