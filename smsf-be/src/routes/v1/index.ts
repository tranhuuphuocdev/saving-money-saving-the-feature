import express from "express";
import authRoutes from "./auth.routes";
import walletRoutes from "./wallet.routes";
import transactionRoutes from "./transaction.routes";
import categoryRoutes from "./category.routes";
import budgetRoutes from "./budget.routes";
import { authMiddleware } from "../../middlewares";

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/wallets", authMiddleware, walletRoutes);
router.use("/transactions", authMiddleware, transactionRoutes);
router.use("/categories", authMiddleware, categoryRoutes);
router.use("/budgets", authMiddleware, budgetRoutes);

export default router;
