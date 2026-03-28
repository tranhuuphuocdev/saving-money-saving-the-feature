import { randomUUID } from "node:crypto";
import { query } from "../lib/db";

type TypeCategoryKind = "income" | "expense";

interface ICategorySeed {
    name: string;
    type: TypeCategoryKind;
    icon: string;
}

const DEFAULT_CATEGORIES: ICategorySeed[] = [
    { name: "Ăn uống", type: "expense", icon: "🍜" },
    { name: "Di chuyển", type: "expense", icon: "🚌" },
    { name: "Đi chợ", type: "expense", icon: "🛒" },
    { name: "Giải trí", type: "expense", icon: "🎮" },
    { name: "Mua sắm", type: "expense", icon: "🛍️" },
    { name: "Sức khỏe", type: "expense", icon: "💊" },
    { name: "Nhà cửa", type: "expense", icon: "🏠" },
    { name: "Học tập", type: "expense", icon: "📚" },
    { name: "Tình iu", type: "expense", icon: "💗" },
    { name: "Shopee", type: "expense", icon: "📦" },
    { name: "Khác", type: "expense", icon: "🧩" },
    { name: "Tiết kiệm", type: "expense", icon: "💰" },
    { name: "Lương", type: "income", icon: "💼" },
    { name: "Freelance", type: "income", icon: "🧑‍💻" },
    { name: "Thưởng", type: "income", icon: "🎁" },
    { name: "Đầu tư", type: "income", icon: "📈" },
    { name: "Khác", type: "income", icon: "🧩" },
];

const userId = process.env.SEED_USER_ID || "app-default";

const createCategory = async (
    name: string,
    type: TypeCategoryKind,
    icon: string,
): Promise<void> => {
    const existing = await query(
        `SELECT cate_id FROM categories
         WHERE u_id = $1 AND cate_type = $2 AND cate_name = $3 AND is_deleted = false
         LIMIT 1`,
        [userId, type, name],
    );

    if (existing.rows.length > 0) {
        await query(
            `UPDATE categories
             SET cate_icon = $1,
                 is_default = true,
                 updated_at = $2
             WHERE cate_id = $3`,
            [icon, Date.now(), String(existing.rows[0].cate_id)],
        );
        console.log(`Update existing category icon: ${name} (${type})`);
        return;
    }

    const now = Date.now();
    const cateId = randomUUID();

    await query(
        `INSERT INTO categories (cate_id, u_id, cate_name, cate_type, cate_icon, is_default, is_deleted, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [cateId, userId, name, type, icon, true, false, now, now],
    );

    console.log(`Create category success: ${name} (${type})`);
};

async function createCategories(): Promise<void> {
    for (const category of DEFAULT_CATEGORIES) {
        await createCategory(category.name, category.type, category.icon);
    }

    console.log("Seed categories completed.");
}

export { createCategories };

if (require.main === module) {
    createCategories().catch((error) => {
        console.error("Create categories script error:", (error as Error).message);
        process.exit(1);
    });
}
