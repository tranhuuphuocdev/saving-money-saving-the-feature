import express from "express";
import { createWallet, getWalletLogs, getWallets, patchWallet, reorderWallet } from "../../controllers/wallet.controller";

const router = express.Router();

router.get("/", getWallets);
router.post("/", createWallet);
router.patch("/:id", patchWallet);
router.patch("/:id/reorder", reorderWallet);
router.get("/:id/logs", getWalletLogs);

export default router;
