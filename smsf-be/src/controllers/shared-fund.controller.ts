import { Request, Response } from "express";
import { IApiResponse } from "../interfaces/common.interface";
import { emitToUser } from "../lib/socket";
import {
    acceptSharedFundInvite,
    createSharedFundWalletForUser,
    getSharedFundContributionStats,
    leaveSharedFund,
    listIncomingSharedFundInvites,
    listOutgoingSharedFundInvites,
    listSharedFundMemberIds,
    listSharedFundMembers,
    rejectSharedFundInvite,
    sendSharedFundInvite,
    transferSharedFundOwnership,
    withdrawSharedFundToWallet,
} from "../services/shared-fund.service";

interface IAuthRequest extends Request {
    user?: { id: string };
}

export async function createSharedFundWallet(req: IAuthRequest, res: Response) {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const { name, balance, sourceWalletId } = req.body as { name: string; balance?: number; sourceWalletId?: string };
        const wallet = await createSharedFundWalletForUser(userId, { name, balance, sourceWalletId });

        return res.status(201).json({
            data: wallet,
        } as IApiResponse);
    } catch (error) {
        const statusCode = (error as Error & { statusCode?: number }).statusCode || 400;
        return res.status(statusCode).json({ message: (error as Error).message || "Không thể tạo quỹ chung." });
    }
}

export async function createSharedFundInvite(req: IAuthRequest, res: Response) {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const { walletId, receiverId } = req.body as { walletId: string; receiverId: string };

        if (!walletId || !receiverId) {
            return res.status(400).json({ message: "walletId và receiverId là bắt buộc." });
        }

        const invite = await sendSharedFundInvite(userId, walletId, receiverId);

        emitToUser(receiverId, "shared_fund_invite_received", invite);

        return res.status(201).json({
            data: invite,
        } as IApiResponse);
    } catch (error) {
        const statusCode = (error as Error & { statusCode?: number }).statusCode || 400;
        return res.status(statusCode).json({ message: (error as Error).message || "Không thể gửi lời mời quỹ chung." });
    }
}

export async function listIncomingInvites(req: IAuthRequest, res: Response) {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const invites = await listIncomingSharedFundInvites(userId);
        return res.json({ data: invites } as IApiResponse);
    } catch (error) {
        return res.status(400).json({ message: (error as Error).message || "Không thể lấy danh sách lời mời quỹ chung." });
    }
}

export async function listOutgoingInvites(req: IAuthRequest, res: Response) {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const invites = await listOutgoingSharedFundInvites(userId);
        return res.json({ data: invites } as IApiResponse);
    } catch (error) {
        return res.status(400).json({ message: (error as Error).message || "Không thể lấy danh sách lời mời đã gửi." });
    }
}

export async function listSharedFundMembersController(req: IAuthRequest, res: Response) {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const walletIdParam = req.params.walletId;
        const walletId = Array.isArray(walletIdParam) ? walletIdParam[0] : walletIdParam;
        if (!walletId) {
            return res.status(400).json({ message: "walletId là bắt buộc." });
        }

        const members = await listSharedFundMembers(userId, walletId);
        return res.json({ data: members } as IApiResponse);
    } catch (error) {
        const statusCode = (error as Error & { statusCode?: number }).statusCode || 400;
        return res.status(statusCode).json({ message: (error as Error).message || "Không thể lấy danh sách thành viên quỹ chung." });
    }
}

export async function acceptInvite(req: IAuthRequest, res: Response) {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const { inviteId } = req.body as { inviteId: string };
        if (!inviteId) {
            return res.status(400).json({ message: "inviteId là bắt buộc." });
        }

        const invite = await acceptSharedFundInvite(inviteId, userId);

        emitToUser(invite.senderId, "shared_fund_invite_resolved", {
            inviteId: invite.inviteId,
            status: "accepted",
            walletId: invite.walletId,
            walletName: invite.walletName,
            receiverId: invite.receiverId,
            receiverName: invite.receiverName,
        });

        emitToUser(invite.receiverId, "shared_fund_membership_updated", {
            status: "joined",
            walletId: invite.walletId,
            walletName: invite.walletName,
        });

        return res.json({ data: invite } as IApiResponse);
    } catch (error) {
        const statusCode = (error as Error & { statusCode?: number }).statusCode || 400;
        return res.status(statusCode).json({ message: (error as Error).message || "Không thể chấp nhận lời mời quỹ chung." });
    }
}

export async function rejectInvite(req: IAuthRequest, res: Response) {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const { inviteId } = req.body as { inviteId: string };
        if (!inviteId) {
            return res.status(400).json({ message: "inviteId là bắt buộc." });
        }

        const invite = await rejectSharedFundInvite(inviteId, userId);

        emitToUser(invite.senderId, "shared_fund_invite_resolved", {
            inviteId: invite.inviteId,
            status: "rejected",
            walletId: invite.walletId,
            walletName: invite.walletName,
            receiverId: invite.receiverId,
            receiverName: invite.receiverName,
        });

        return res.json({ data: invite } as IApiResponse);
    } catch (error) {
        const statusCode = (error as Error & { statusCode?: number }).statusCode || 400;
        return res.status(statusCode).json({ message: (error as Error).message || "Không thể từ chối lời mời quỹ chung." });
    }
}

export async function leaveSharedFundController(req: IAuthRequest, res: Response) {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const walletId = String(req.body?.walletId || "").trim();
        if (!walletId) {
            return res.status(400).json({ message: "walletId là bắt buộc." });
        }

        const result = await leaveSharedFund(userId, walletId);
        const memberIds = await listSharedFundMemberIds(walletId);

        for (const memberId of memberIds) {
            emitToUser(memberId, "shared_fund_membership_updated", {
                status: "left",
                walletId,
                userId,
            });
        }

        emitToUser(userId, "shared_fund_membership_updated", {
            status: "left-self",
            walletId,
            userId,
        });

        return res.json({
            data: {
                ...result,
                memberIds,
            },
        } as IApiResponse);
    } catch (error) {
        const statusCode = (error as Error & { statusCode?: number }).statusCode || 400;
        return res.status(statusCode).json({ message: (error as Error).message || "Không thể rời quỹ chung." });
    }
}

export async function withdrawSharedFundController(req: IAuthRequest, res: Response) {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const walletId = String(req.body?.walletId || "").trim();
        const targetWalletId = String(req.body?.targetWalletId || "").trim();
        const amount = Number(req.body?.amount || 0);

        const result = await withdrawSharedFundToWallet(userId, {
            walletId,
            targetWalletId,
            amount,
            description: req.body?.description,
        });

        const memberIds = await listSharedFundMemberIds(walletId);

        const actorName = 'Thành viên';
        const message = `${actorName} đã rút ${result.amount.toLocaleString("vi-VN")} từ quỹ ${result.walletName}`;
        const createdAt = Date.now();

        for (const memberId of memberIds) {
            emitToUser(memberId, "shared_fund_activity", {
                id: `${walletId}:${createdAt}:${memberId}`,
                walletId,
                walletName: result.walletName,
                actorId: userId,
                actorName,
                action: "withdraw",
                amount: result.amount,
                description: message,
                createdAt,
                message,
            });
        }

        return res.json({
            data: {
                ...result,
                memberIds,
            },
        } as IApiResponse);
    } catch (error) {
        const statusCode = (error as Error & { statusCode?: number }).statusCode || 400;
        return res.status(statusCode).json({ message: (error as Error).message || "Không thể rút quỹ về ví." });
    }
}

export async function getSharedFundContributionStatsController(req: IAuthRequest, res: Response) {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const walletIdParam = req.params.walletId;
        const walletId = Array.isArray(walletIdParam) ? walletIdParam[0] : walletIdParam;
        if (!walletId) {
            return res.status(400).json({ message: "walletId là bắt buộc." });
        }

        const items = await getSharedFundContributionStats(userId, walletId);
        return res.json({
            data: {
                walletId,
                items,
            },
        } as IApiResponse);
    } catch (error) {
        const statusCode = (error as Error & { statusCode?: number }).statusCode || 400;
        return res.status(statusCode).json({ message: (error as Error).message || "Không thể lấy thống kê quỹ chung." });
    }
}

export async function transferSharedFundOwnershipController(req: IAuthRequest, res: Response) {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const walletId = String(req.body?.walletId || "").trim();
        const nextOwnerId = String(req.body?.nextOwnerId || "").trim();

        const result = await transferSharedFundOwnership(userId, { walletId, nextOwnerId });
        const memberIds = await listSharedFundMemberIds(walletId);

        for (const memberId of memberIds) {
            emitToUser(memberId, "shared_fund_membership_updated", {
                status: "ownership-transferred",
                walletId,
                previousOwnerId: result.previousOwnerId,
                nextOwnerId: result.nextOwnerId,
            });
        }

        return res.json({ data: { ...result, memberIds } } as IApiResponse);
    } catch (error) {
        const statusCode = (error as Error & { statusCode?: number }).statusCode || 400;
        return res.status(statusCode).json({ message: (error as Error).message || "Không thể chuyển quyền chủ quỹ." });
    }
}
