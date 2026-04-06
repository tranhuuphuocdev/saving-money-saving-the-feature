import { TypeTransactionKind } from "../interfaces/transaction.interface";

const WALLET_LOG_ACTION = {
    INITIAL_SETUP: "initial-setup",
    CREDIT: "credit",
    DEBIT: "debit",
    TRANSFER_IN: "transfer-in",
    TRANSFER_OUT: "transfer-out",
    BALANCE_SET: "balance-set",
    WALLET_UNAVAILABLE: "wallet-unavailable",
} as const;

type TypeWalletLogAction =
    (typeof WALLET_LOG_ACTION)[keyof typeof WALLET_LOG_ACTION];

const resolveWalletBalanceAction = (
    transactionType: TypeTransactionKind,
    mode: "apply" | "revert",
): TypeWalletLogAction => {
    if (mode === "apply") {
        return transactionType === "income"
            ? WALLET_LOG_ACTION.CREDIT
            : WALLET_LOG_ACTION.DEBIT;
    }

    return transactionType === "income"
        ? WALLET_LOG_ACTION.DEBIT
        : WALLET_LOG_ACTION.CREDIT;
};

export {
    WALLET_LOG_ACTION,
    resolveWalletBalanceAction,
};

export type { TypeWalletLogAction };