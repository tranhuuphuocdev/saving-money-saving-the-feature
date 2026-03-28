import pool from "../lib/db";
import { createCategories } from "./create-categories";

const TABLES = [
    "notifications",
    "transactions",
    "budgets",
    "wallets",
    "categories",
    "users",
];

async function truncateDb(): Promise<void> {
    console.log("[truncate-db] truncating all tables...");

    for (const table of TABLES) {
        await pool.query(`TRUNCATE TABLE ${table} CASCADE`);
        console.log(`[truncate-db] truncated: ${table}`);
    }

    console.log("[truncate-db] all tables truncated.");
    console.log("[truncate-db] re-seeding default categories...");

    await createCategories();

    console.log("[truncate-db] done.");
    await pool.end();
}

if (require.main === module) {
    truncateDb().catch((error) => {
        console.error("[truncate-db] failed:", (error as Error).message);
        process.exit(1);
    });
}
