import { randomUUID } from "node:crypto";
import { DEFAULT_CATEGORIES, TypeCategoryKind } from "../constants/default-categories";
import { query } from "../lib/db";

const createCategory = async (
    userId: string,
    name: string,
    type: TypeCategoryKind,
    icon: string,
    index: number,
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
                 cate_index = $2,
                 is_default = true,
                 updated_at = $3
             WHERE cate_id = $4`,
            [icon, index, Date.now(), String(existing.rows[0].cate_id)],
        );
        console.log(`Update existing category icon: ${name} (${type})`);
        return;
    }

    const now = Date.now();
    const cateId = randomUUID();

    await query(
        `INSERT INTO categories (cate_id, u_id, cate_name, cate_type, cate_icon, cate_index, is_default, is_deleted, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [cateId, userId, name, type, icon, index, true, false, now, now],
    );

    console.log(`Create category success: ${name} (${type})`);
};

async function createCategoriesForUser(userId: string): Promise<void> {
    for (const category of DEFAULT_CATEGORIES) {
        await createCategory(userId, category.name, category.type, category.icon, category.index);
    }

    console.log(`Seed categories completed for user: ${userId}`);
}

export { createCategoriesForUser };

if (require.main === module) {
    const seedUserId = String(process.env.SEED_USER_ID || "").trim();

    if (!seedUserId) {
        console.error("Create categories script error: SEED_USER_ID is required.");
        process.exit(1);
    }

    createCategoriesForUser(seedUserId).catch((error) => {
        console.error("Create categories script error:", (error as Error).message);
        process.exit(1);
    });
}
