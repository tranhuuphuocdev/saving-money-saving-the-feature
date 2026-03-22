import express from "express";
import { getWallets } from "../../controllers/wallet.controller";

const router = express.Router();

router.get("/", getWallets);

export default router;
