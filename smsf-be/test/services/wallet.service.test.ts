import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { IWallet } from "../../src/interfaces/transaction.interface";

const walletRepositoryMocks = vi.hoisted(() => ({
    findWalletByUserAndName: vi.fn(),
    getWalletById: vi.fn(),
    getWalletLogsByWalletId: vi.fn(),
    getWalletSummaryByUserId: vi.fn(),
    getWalletsByUserId: vi.fn(),
    upsertWallet: vi.fn(),
    upsertWalletsBulk: vi.fn(),
    updateWalletBalance: vi.fn(),
    setWalletActive: vi.fn(),
    createWalletLog: vi.fn(),
    reorderWallet: vi.fn(),
}));

const prismaMocks = vi.hoisted(() => ({
    prisma: {
        walletLog: {
            count: vi.fn(),
        },
        user: {
            findUnique: vi.fn(),
        },
        $transaction: vi.fn(),
    },
}));

vi.mock("../../src/repositories/wallet.repository", () => walletRepositoryMocks);
vi.mock("../../src/lib/prisma", () => prismaMocks);

import { applyTransactionEffectToWallet } from "../../src/services/wallet.service";

const buildWallet = (overrides: Partial<IWallet> = {}): IWallet => ({
    id: "wallet-1",
    userId: "user-1",
    name: "Main Wallet",
    type: "cash",
    balance: 100,
    createdAt: 1,
    updatedAt: 1,
    isActive: true,
    ...overrides,
});

describe("wallet.service applyTransactionEffectToWallet", () => {
    beforeEach(() => {
        walletRepositoryMocks.updateWalletBalance.mockReset();
        walletRepositoryMocks.createWalletLog.mockReset();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it("applies income and writes a credit log", async () => {
        const wallet = buildWallet({ balance: 100 });
        const updatedWallet = buildWallet({ balance: 150, updatedAt: 2 });

        walletRepositoryMocks.updateWalletBalance.mockResolvedValue(updatedWallet);
        walletRepositoryMocks.createWalletLog.mockResolvedValue(undefined);

        const result = await applyTransactionEffectToWallet(
            wallet,
            "income",
            50,
            "apply",
            undefined,
            {
                transactionId: "txn-1",
                description: "Salary",
            },
        );

        expect(walletRepositoryMocks.updateWalletBalance).toHaveBeenCalledWith(
            "user-1",
            "wallet-1",
            150,
            undefined,
        );
        expect(walletRepositoryMocks.createWalletLog).toHaveBeenCalledWith(
            expect.objectContaining({
                walletId: "wallet-1",
                transactionId: "txn-1",
                action: "credit",
                amount: 50,
                balanceBefore: 100,
                balanceAfter: 150,
                description: "Salary",
            }),
            undefined,
        );
        expect(result).toBe(updatedWallet);
    });

    it("reverts an expense by crediting the wallet back", async () => {
        const wallet = buildWallet({ balance: 40 });
        const updatedWallet = buildWallet({ balance: 65, updatedAt: 2 });

        walletRepositoryMocks.updateWalletBalance.mockResolvedValue(updatedWallet);
        walletRepositoryMocks.createWalletLog.mockResolvedValue(undefined);

        const result = await applyTransactionEffectToWallet(
            wallet,
            "expense",
            25,
            "revert",
        );

        expect(walletRepositoryMocks.updateWalletBalance).toHaveBeenCalledWith(
            "user-1",
            "wallet-1",
            65,
            undefined,
        );
        expect(walletRepositoryMocks.createWalletLog).toHaveBeenCalledWith(
            expect.objectContaining({
                action: "credit",
                balanceBefore: 40,
                balanceAfter: 65,
            }),
            undefined,
        );
        expect(result).toBe(updatedWallet);
    });

    it("throws when an operation would make the balance negative", async () => {
        const wallet = buildWallet({ balance: 20 });

        try {
            await applyTransactionEffectToWallet(wallet, "expense", 30, "apply");
            throw new Error("Expected applyTransactionEffectToWallet to throw");
        } catch (error) {
            expect(error).toBeInstanceOf(Error);
            expect((error as Error).message).toBe("Không có tiền mà mua tùm lum dị cha nội, nạp tiền dô!!");
            expect(error).toHaveProperty("statusCode", 400);
        }

        expect(walletRepositoryMocks.updateWalletBalance).not.toHaveBeenCalled();
        expect(walletRepositoryMocks.createWalletLog).not.toHaveBeenCalled();
    });

    it("returns the updated wallet even if wallet log creation fails", async () => {
        const wallet = buildWallet({ balance: 10 });
        const updatedWallet = buildWallet({ balance: 30, updatedAt: 2 });

        walletRepositoryMocks.updateWalletBalance.mockResolvedValue(updatedWallet);
        walletRepositoryMocks.createWalletLog.mockRejectedValue(new Error("log write failed"));

        await expect(
            applyTransactionEffectToWallet(wallet, "income", 20, "apply"),
        ).resolves.toBe(updatedWallet);
    });
});