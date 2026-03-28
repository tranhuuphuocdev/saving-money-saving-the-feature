import { createHash, randomUUID } from "node:crypto";
import { query } from "../lib/db";

type IWalletType = "momo" | "bank" | "cash";

const DEFAULT_WALLETS: Array<{ type: IWalletType; name: string }> = [
    { type: "momo", name: "Ví Momo" },
    { type: "bank", name: "Ngân hàng" },
    { type: "cash", name: "Tiền mặt" },
];

function hashPassword(password: string): string {
    return createHash("sha256").update(password).digest("hex");
}

async function createDefaultWalletsForUser(userId: string, timestamp: number): Promise<void> {
    for (const wallet of DEFAULT_WALLETS) {
        const wId = randomUUID();

        await query(
            `INSERT INTO wallets (w_id, u_id, w_name, w_type, amount, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [wId, userId, wallet.name, wallet.type, 0, timestamp, timestamp],
        );

        console.log("Create wallet success", {
            walletId: wId,
            walletType: wallet.type,
            userId,
        });
    }
}

async function createUser(): Promise<void> {
    const now = Date.now();
    const rawPassword = process.env.USER_PASSWORD || "123456";

    const uId = process.env.USER_ID || randomUUID();
    const dn = process.env.USER_DN || "dunglamtraitimanhdau";
    const username = process.env.USER_USERNAME || "rampo";
    const teleChatId = process.env.USER_TELEGRAM_CHAT_ID || null;
    const password = hashPassword(rawPassword);
    const role = process.env.USER_ROLE || "admin";

    await query(
        `INSERT INTO users (u_id, dn, username, tele_chat_id, password, role, created_at, updated_at, is_deleted)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [uId, dn, username, teleChatId, password, role, now, now, false],
    );

    console.log("Create user success");
    console.log({
        id: uId,
        username,
        role,
    });

    await createDefaultWalletsForUser(uId, now);
}

createUser().catch((error) => {
    console.error("Create user script error:", (error as Error).message);
    process.exit(1);
});
