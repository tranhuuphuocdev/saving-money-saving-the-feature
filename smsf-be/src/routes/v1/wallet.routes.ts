import express from "express";
import { createWallet, getWalletLogs, getWallets, initializeWallets, patchWallet, reorderWallet } from "../../controllers/wallet.controller";
import {
	acceptInvite,
	createSharedFundInvite,
	createSharedFundWallet,
	getSharedFundContributionStatsController,
	leaveSharedFundController,
	listIncomingInvites,
	listOutgoingInvites,
	listSharedFundMembersController,
	rejectInvite,
	transferSharedFundOwnershipController,
	withdrawSharedFundController,
} from "../../controllers/shared-fund.controller";

const router = express.Router();

router.get("/", getWallets);
router.post("/", createWallet);
router.post("/initial-setup", initializeWallets);
router.patch("/:id", patchWallet);
router.patch("/:id/reorder", reorderWallet);
router.get("/:id/logs", getWalletLogs);

router.post("/shared-funds", createSharedFundWallet);
router.post("/shared-funds/invites", createSharedFundInvite);
router.get("/shared-funds/invites/incoming", listIncomingInvites);
router.get("/shared-funds/invites/outgoing", listOutgoingInvites);
router.post("/shared-funds/invites/accept", acceptInvite);
router.post("/shared-funds/invites/reject", rejectInvite);
router.get("/shared-funds/:walletId/members", listSharedFundMembersController);
router.get("/shared-funds/:walletId/contributions", getSharedFundContributionStatsController);
router.post("/shared-funds/leave", leaveSharedFundController);
router.post("/shared-funds/transfer-ownership", transferSharedFundOwnershipController);
router.post("/shared-funds/withdraw", withdrawSharedFundController);

export default router;
