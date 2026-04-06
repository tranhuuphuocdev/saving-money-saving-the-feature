import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
    ITransaction,
    IUpdateTransactionPayload,
    IWallet,
} from "../../src/interfaces/transaction.interface";

const mockExecutor = { kind: "tx" };

const prismaMocks = vi.hoisted(() => ({
    withTransaction: vi.fn(),
}));

const transactionRepositoryMocks = vi.hoisted(() => ({
    createTransaction: vi.fn(),
    createTransactionsBulk: vi.fn(),
    deleteTransaction: vi.fn(),
    getTransactionById: vi.fn(),
    getTransactionsByUserAndMonth: vi.fn(),
    getSpendingTrendAggregationByMonth: vi.fn(),
    queryTransactionsByUser: vi.fn(),
    updateTransaction: vi.fn(),
}));

const walletServiceMocks = vi.hoisted(() => ({
    assertWalletAvailableForTransaction: vi.fn(),
    applyTransactionEffectToWallet: vi.fn(),
    findWalletById: vi.fn(),
}));

const categoryServiceMocks = vi.hoisted(() => ({
    getCategoryById: vi.fn(),
}));

const budgetServiceMocks = vi.hoisted(() => ({
    getSavingBudgetByUser: vi.fn(),
    getSavingGoalByUser: vi.fn(),
    syncBudgetJarsByTimestamp: vi.fn(),
}));

vi.mock("../../src/lib/prisma", () => prismaMocks);
vi.mock("../../src/repositories/transaction.repository", () => transactionRepositoryMocks);
vi.mock("../../src/services/wallet.service", () => walletServiceMocks);
vi.mock("../../src/services/category.service", () => categoryServiceMocks);
vi.mock("../../src/services/budget.service", () => budgetServiceMocks);

import {
    deleteTransactionForUser,
    updateTransactionForUser,
} from "../../src/services/transaction.service";

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

const buildTransaction = (overrides: Partial<ITransaction> = {}): ITransaction => ({
    id: "txn-1",
    userId: "user-1",
    walletId: "wallet-1",
    amount: 100,
    category: "cat-1",
    categoryName: "Food",
    budgetName: "Needs",
    description: "Lunch",
    type: "expense",
    timestamp: 1710000000000,
    createdAt: 1710000000000,
    updatedAt: 1710000000000,
    ...overrides,
});

describe("transaction.service rollback flows", () => {
    beforeEach(() => {
        prismaMocks.withTransaction.mockImplementation(async (handler: (executor: unknown) => Promise<unknown>) => {
            return handler(mockExecutor);
        });
        walletServiceMocks.assertWalletAvailableForTransaction.mockResolvedValue(undefined);
        categoryServiceMocks.getCategoryById.mockResolvedValue({ id: "cat-1", name: "Transport" });
        budgetServiceMocks.getSavingBudgetByUser.mockResolvedValue({ name: "Goal Jar" });
        budgetServiceMocks.syncBudgetJarsByTimestamp.mockResolvedValue(undefined);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it("uses the reverted wallet snapshot when updating within the same wallet", async () => {
        const existing = buildTransaction({ amount: 100, walletId: "wallet-1", type: "expense" });
        const currentWallet = buildWallet({ id: "wallet-1", balance: 50 });
        const revertedWallet = buildWallet({ id: "wallet-1", balance: 150, updatedAt: 2 });
        const appliedWallet = buildWallet({ id: "wallet-1", balance: 110, updatedAt: 3 });
        const payload: IUpdateTransactionPayload = {
            amount: 40,
            description: "Bus ticket",
            category: "cat-2",
            timestamp: 1710003600000,
        };
        const updatedTransaction = buildTransaction({
            amount: 40,
            category: "cat-2",
            categoryName: "Transport",
            description: "Bus ticket",
            timestamp: 1710003600000,
        });

        transactionRepositoryMocks.getTransactionById.mockResolvedValue(existing);
        walletServiceMocks.findWalletById
            .mockResolvedValueOnce(currentWallet)
            .mockResolvedValueOnce(currentWallet);
        walletServiceMocks.applyTransactionEffectToWallet
            .mockResolvedValueOnce(revertedWallet)
            .mockResolvedValueOnce(appliedWallet);
        transactionRepositoryMocks.updateTransaction.mockResolvedValue(updatedTransaction);

        const result = await updateTransactionForUser("user-1", "txn-1", payload, "alice");

        expect(walletServiceMocks.applyTransactionEffectToWallet).toHaveBeenNthCalledWith(
            1,
            currentWallet,
            "expense",
            100,
            "revert",
            mockExecutor,
            expect.objectContaining({ transactionId: "txn-1" }),
        );
        expect(walletServiceMocks.applyTransactionEffectToWallet).toHaveBeenNthCalledWith(
            2,
            revertedWallet,
            "expense",
            40,
            "apply",
            mockExecutor,
            expect.objectContaining({
                transactionId: "txn-1",
                description: "Cập nhật giao dịch: Transport: Bus ticket",
            }),
        );
        expect(transactionRepositoryMocks.updateTransaction).toHaveBeenCalledWith(
            "user-1",
            "txn-1",
            payload,
            {
                userDisplayName: "alice",
                categoryName: "Transport",
                budgetName: "Goal Jar",
            },
            mockExecutor,
        );
        expect(result).toEqual({
            transaction: updatedTransaction,
            affectedWalletIds: ["wallet-1"],
        });
    });

    it("reverts the current wallet and applies to the target wallet when wallet changes", async () => {
        const existing = buildTransaction({ amount: 20, walletId: "wallet-1", type: "expense" });
        const currentWallet = buildWallet({ id: "wallet-1", balance: 80 });
        const nextWallet = buildWallet({ id: "wallet-2", balance: 300, name: "Bank" });
        const revertedWallet = buildWallet({ id: "wallet-1", balance: 100, updatedAt: 2 });
        const appliedWallet = buildWallet({ id: "wallet-2", balance: 240, updatedAt: 2 });
        const payload: IUpdateTransactionPayload = {
            walletId: "wallet-2",
            amount: 60,
        };
        const updatedTransaction = buildTransaction({ walletId: "wallet-2", amount: 60 });

        transactionRepositoryMocks.getTransactionById.mockResolvedValue(existing);
        walletServiceMocks.findWalletById
            .mockResolvedValueOnce(currentWallet)
            .mockResolvedValueOnce(nextWallet);
        walletServiceMocks.applyTransactionEffectToWallet
            .mockResolvedValueOnce(revertedWallet)
            .mockResolvedValueOnce(appliedWallet);
        transactionRepositoryMocks.updateTransaction.mockResolvedValue(updatedTransaction);

        const result = await updateTransactionForUser("user-1", "txn-1", payload, "alice");

        expect(walletServiceMocks.applyTransactionEffectToWallet).toHaveBeenNthCalledWith(
            1,
            currentWallet,
            "expense",
            20,
            "revert",
            mockExecutor,
            expect.any(Object),
        );
        expect(walletServiceMocks.applyTransactionEffectToWallet).toHaveBeenNthCalledWith(
            2,
            nextWallet,
            "expense",
            60,
            "apply",
            mockExecutor,
            expect.any(Object),
        );
        expect(result.affectedWalletIds).toEqual(["wallet-1", "wallet-2"]);
    });

    it("deletes a transaction and rolls its amount back into the wallet", async () => {
        const existing = buildTransaction({ amount: 25, walletId: "wallet-9", type: "expense" });
        const wallet = buildWallet({ id: "wallet-9", balance: 75 });
        const updatedWallet = buildWallet({ id: "wallet-9", balance: 100, updatedAt: 2 });

        transactionRepositoryMocks.getTransactionById.mockResolvedValue(existing);
        walletServiceMocks.findWalletById.mockResolvedValue(wallet);
        transactionRepositoryMocks.deleteTransaction.mockResolvedValue(true);
        walletServiceMocks.applyTransactionEffectToWallet.mockResolvedValue(updatedWallet);

        const result = await deleteTransactionForUser("user-1", "txn-1");

        expect(transactionRepositoryMocks.deleteTransaction).toHaveBeenCalledWith(
            "user-1",
            "txn-1",
            mockExecutor,
        );
        expect(walletServiceMocks.applyTransactionEffectToWallet).toHaveBeenCalledWith(
            wallet,
            "expense",
            25,
            "revert",
            mockExecutor,
            expect.objectContaining({
                transactionId: "txn-1",
                description: "Xóa giao dịch: Food: Lunch",
            }),
        );
        expect(budgetServiceMocks.syncBudgetJarsByTimestamp).toHaveBeenCalledWith(
            "user-1",
            existing.timestamp,
            mockExecutor,
        );
        expect(result).toEqual({
            deletedTransactionId: "txn-1",
            walletId: "wallet-9",
            updatedWalletBalance: 100,
        });
    });
});