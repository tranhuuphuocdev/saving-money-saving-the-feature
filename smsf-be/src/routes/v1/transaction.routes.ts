import express from "express";
import {
    createTransactionsBulk,
    createTransaction,
    getTransactions,
    queryTransactions,
    removeTransaction,
    updateTransaction,
    getSavingsRate,
} from "../../controllers/transaction.controller";

const router = express.Router();

router.get("/", getTransactions);
router.get("/query", queryTransactions);
router.get("/savings-rate", getSavingsRate);
router.post("/", createTransaction);
router.post("/bulk", createTransactionsBulk);
router.put("/:transactionId", updateTransaction);
router.delete("/:transactionId", removeTransaction);

export default router;
