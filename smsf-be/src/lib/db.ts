import pg from "pg";
import config from "../config";

const pool = new pg.Pool({
    connectionString: config.DATABASE_URL,
});

pool.on("error", (err) => {
    console.error("[db] unexpected pool error:", err.message);
});

export type DbExecutor = Pick<pg.PoolClient, "query">;

export const query = (text: string, params?: unknown[]) => pool.query(text, params);

export const queryWithExecutor = (
    executor: DbExecutor,
    text: string,
    params?: unknown[],
) => executor.query(text, params);

export const withTransaction = async <T>(
    handler: (executor: pg.PoolClient) => Promise<T>,
): Promise<T> => {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");
        const result = await handler(client);
        await client.query("COMMIT");
        return result;
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};

export const getPool = () => pool;

export default pool;
