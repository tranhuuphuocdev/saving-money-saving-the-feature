import express from "express";
import { createWallet, getWallets, patchWallet } from "../../controllers/wallet.controller";

const router = express.Router();

router.get("/", getWallets);
router.post("/", createWallet);
router.patch("/:id", patchWallet);

export default router;
