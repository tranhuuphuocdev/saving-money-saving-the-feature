import { randomUUID } from "node:crypto";
import { query } from "../lib/db";

interface ISeedWallet {
    wId: string;
    uId: string;
    wName: string;
    wType: string;
    amount: number;
    createdAt: number;
    updatedAt: number;
}

async function createWallets(): Promise<void> {
    const now = Date.now();
    const userId = process.env.SEED_USER_ID || "6629d893-5736-41d1-ac1d-8b625159d01b";

    const wallets: ISeedWallet[] = [
        {
            wId: randomUUID(),
            uId: userId,
            wName: "Momo",
            wType: "momo",
            amount: 500000,
            createdAt: now,
            updatedAt: now,
        },
        {
            wId: randomUUID(),
            uId: userId,
            wName: "Vietcombank",
            wType: "bank",
            amount: 2000000,
            createdAt: now,
            updatedAt: now,
        },
        {
            wId: randomUUID(),
            uId: userId,
            wName: "Tiền mặt",
            wType: "cash",
            amount: 5000000,
            createdAt: now,
            updatedAt: now,
        },
        {
            wId: randomUUID(),
            uId: userId,
            wName: "ZaloPay",
            wType: "zalopay",
            amount: 800000,
            createdAt: now,
            updatedAt: now,
        },
    ];

    for (const wallet of wallets) {
        await query(
            `INSERT INTO wallets (w_id, u_id, w_name, w_type, amount, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [wallet.wId, wallet.uId, wallet.wName, wallet.wType, wallet.amount, wallet.createdAt, wallet.updatedAt],
        );
    }

    console.log("Create wallets success");
    console.table(
        wallets.map((wallet) => ({
            wId: wallet.wId,
            uId: wallet.uId,
            wName: wallet.wName,
            wType: wallet.wType,
            amount: wallet.amount,
        })),
    );
}

createWallets().catch((error) => {
    console.error("Create wallets script error:", (error as Error).message);
    process.exit(1);
});