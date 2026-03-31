import express from "express";
import { createWallet, getWalletLogs, getWallets, patchWallet } from "../../controllers/wallet.controller";

const router = express.Router();

router.get("/", getWallets);
router.post("/", createWallet);
router.patch("/:id", patchWallet);
router.get("/:id/logs", getWalletLogs);

export default router;
