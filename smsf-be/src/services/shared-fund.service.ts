import { randomUUID } from "node:crypto";
import { prisma, withTransaction } from "../lib/prisma";
import { createWalletForUser } from "./wallet.service";

export interface ISharedFundInviteItem {
    inviteId: string;
    walletId: string;
    walletName: string;
    senderId: string;
    senderName: string;
    senderUsername: string;
    senderAvatarUrl: string | null;
    receiverId: string;
    receiverName: string;
    receiverUsername: string;
    receiverAvatarUrl: string | null;
    status: "pending" | "accepted" | "rejected";
    createdAt: number;
    updatedAt: number;
}

export interface ISharedFundMemberItem {
    userId: string;
    displayName: string;
    username: string;
    avatarUrl: string | null;
    role: string;
    joinedAt: number;
}

export interface ISharedFundContributionItem {
    userId: string;
    displayName: string;
    username: string;
    avatarUrl: string | null;
    incomeTotal: number;
    expenseTotal: number;
    net: number;
}

export interface ISharedFundWithdrawResult {
    walletId: string;
    walletName: string;
    amount: number;
    sourceBalanceAfter: number;
    targetWalletId: string;
    targetWalletName: string;
    targetBalanceAfter: number;
    createdAt: number;
}

export interface ISharedFundTransferOwnershipResult {
    walletId: string;
    previousOwnerId: string;
    nextOwnerId: string;
}

async function ensureInviteTable(): Promise<void> {
    await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS shared_wallet_invites (
            swi_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            wallet_id VARCHAR(255) NOT NULL REFERENCES wallets(w_id) ON DELETE CASCADE,
            sender_u_id UUID NOT NULL REFERENCES users(u_id) ON DELETE CASCADE,
            receiver_u_id UUID NOT NULL REFERENCES users(u_id) ON DELETE CASCADE,
            swi_status VARCHAR(32) NOT NULL DEFAULT 'pending',
            created_at BIGINT NOT NULL,
            updated_at BIGINT NOT NULL
        );
    `);

    await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS idx_swi_sender ON shared_wallet_invites (sender_u_id);
    `);

    await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS idx_swi_receiver ON shared_wallet_invites (receiver_u_id);
    `);

    await prisma.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS uq_swi_pending_wallet_receiver
        ON shared_wallet_invites (wallet_id, receiver_u_id)
        WHERE swi_status = 'pending';
    `);
}

async function assertFriendship(senderId: string, receiverId: string): Promise<void> {
    const relation = await prisma.friendship.findFirst({
        where: {
            status: "accepted",
            OR: [
                { userId: senderId, friendId: receiverId },
                { userId: receiverId, friendId: senderId },
            ],
        },
        select: { id: true },
    });

    if (!relation) {
        const error = new Error("Bạn chỉ có thể mời bạn bè vào quỹ chung.");
        (error as Error & { statusCode?: number }).statusCode = 400;
        throw error;
    }
}

export async function createSharedFundWalletForUser(userId: string, payload: { name: string; balance?: number; sourceWalletId?: string }) {
    const initialBalance = Number(payload.balance || 0);
    const sourceWalletId = String(payload.sourceWalletId || "").trim();

    if (!Number.isFinite(initialBalance) || initialBalance < 0) {
        const error = new Error("Số dư ban đầu phải là số không âm.");
        (error as Error & { statusCode?: number }).statusCode = 400;
        throw error;
    }

    if (initialBalance <= 0) {
        return createWalletForUser(userId, {
            name: payload.name,
            type: "shared-fund",
            balance: 0,
        });
    }

    if (!sourceWalletId) {
        const error = new Error("Vui lòng chọn ví nguồn để tạo quỹ với số dư ban đầu.");
        (error as Error & { statusCode?: number }).statusCode = 400;
        throw error;
    }

    const trimmedName = String(payload.name || "").trim();
    if (!trimmedName) {
        const error = new Error("Tên quỹ chung là bắt buộc.");
        (error as Error & { statusCode?: number }).statusCode = 400;
        throw error;
    }

    const duplicatedWallet = await prisma.userWallet.findFirst({
        where: {
            userId,
            wallet: {
                name: trimmedName,
            },
        },
        select: { id: true },
    });

    if (duplicatedWallet) {
        const error = new Error("Tên ví đã tồn tại.");
        (error as Error & { statusCode?: number }).statusCode = 409;
        throw error;
    }

    const sourceMembership = await prisma.userWallet.findFirst({
        where: {
            userId,
            walletId: sourceWalletId,
        },
        include: {
            wallet: true,
        },
    });

    if (!sourceMembership) {
        const error = new Error("Ví nguồn không hợp lệ.");
        (error as Error & { statusCode?: number }).statusCode = 404;
        throw error;
    }

    if (sourceMembership.wallet.isActive === false) {
        const error = new Error("Ví nguồn đang tắt, vui lòng bật lại để thực hiện giao dịch.");
        (error as Error & { statusCode?: number }).statusCode = 400;
        throw error;
    }

    const sourceBalance = Number(sourceMembership.wallet.amount || 0);
    if (sourceBalance < initialBalance) {
        const error = new Error("Số dư ví nguồn không đủ để tạo quỹ chung.");
        (error as Error & { statusCode?: number }).statusCode = 400;
        throw error;
    }

    const now = Date.now();
    const walletId = randomUUID();
    const sourceAfter = sourceBalance - initialBalance;

    const result = await withTransaction(async (tx) => {
        const createdWallet = await tx.wallet.create({
            data: {
                id: walletId,
                name: trimmedName,
                type: "shared-fund",
                amount: initialBalance,
                createdAt: BigInt(now),
                updatedAt: BigInt(now),
                isActive: true,
            },
        });

        const latestOrder = await tx.userWallet.findFirst({
            where: { userId },
            orderBy: { orderIndex: "desc" },
            select: { orderIndex: true },
        });

        await tx.userWallet.create({
            data: {
                userId,
                walletId,
                role: "owner",
                orderIndex: (latestOrder?.orderIndex ?? -1) + 1,
                createdAt: BigInt(now),
                updatedAt: BigInt(now),
            },
        });

        await tx.wallet.update({
            where: { id: sourceWalletId },
            data: {
                amount: sourceAfter,
                updatedAt: BigInt(now),
            },
        });

        await tx.walletLog.createMany({
            data: [
                {
                    walletId: sourceWalletId,
                    action: "transfer-out",
                    amount: initialBalance,
                    balanceBefore: sourceBalance,
                    balanceAfter: sourceAfter,
                    description: `Chuyển tiền sang quỹ chung ${trimmedName}`,
                    createdAt: BigInt(now),
                },
                {
                    walletId,
                    action: "transfer-in",
                    amount: initialBalance,
                    balanceBefore: 0,
                    balanceAfter: initialBalance,
                    description: `Nhận tiền khởi tạo từ ví ${sourceMembership.wallet.name}`,
                    createdAt: BigInt(now),
                },
            ],
        });

        return createdWallet;
    });

    return {
        id: result.id,
        userId,
        name: result.name,
        type: result.type,
        balance: Number(result.amount || 0),
        createdAt: Number(result.createdAt),
        updatedAt: Number(result.updatedAt),
        isActive: result.isActive !== false,
    };
}

export async function sendSharedFundInvite(
    senderId: string,
    walletId: string,
    receiverId: string,
): Promise<ISharedFundInviteItem> {
    await ensureInviteTable();

    if (senderId === receiverId) {
        const error = new Error("Không thể tự mời chính mình.");
        (error as Error & { statusCode?: number }).statusCode = 400;
        throw error;
    }

    const senderWallet = await prisma.userWallet.findFirst({
        where: {
            userId: senderId,
            walletId,
            role: "owner",
        },
        include: {
            wallet: true,
        },
    });

    if (!senderWallet) {
        const error = new Error("Bạn không có quyền mời vào quỹ này.");
        (error as Error & { statusCode?: number }).statusCode = 403;
        throw error;
    }

    await assertFriendship(senderId, receiverId);

    const existingMember = await prisma.userWallet.findFirst({
        where: {
            userId: receiverId,
            walletId,
        },
        select: { id: true },
    });

    if (existingMember) {
        const error = new Error("Bạn này đã có trong quỹ chung.");
        (error as Error & { statusCode?: number }).statusCode = 409;
        throw error;
    }

    const now = Date.now();

    try {
        await prisma.$executeRawUnsafe(
            `
            INSERT INTO shared_wallet_invites (swi_id, wallet_id, sender_u_id, receiver_u_id, swi_status, created_at, updated_at)
            VALUES ($1::uuid, $2, $3::uuid, $4::uuid, 'pending', $5, $6)
            `,
            randomUUID(),
            walletId,
            senderId,
            receiverId,
            now,
            now,
        );
    } catch (error) {
        const message = String((error as Error).message || "");
        if (message.includes("uq_swi_pending_wallet_receiver")) {
            const conflictError = new Error("Lời mời vào quỹ đang chờ phản hồi.");
            (conflictError as Error & { statusCode?: number }).statusCode = 409;
            throw conflictError;
        }

        throw error;
    }

    const [sender, receiver] = await prisma.$transaction([
        prisma.user.findUnique({
            where: { id: senderId },
            select: { id: true, displayName: true, username: true, avatarUrl: true },
        }),
        prisma.user.findUnique({
            where: { id: receiverId },
            select: { id: true, displayName: true, username: true, avatarUrl: true },
        }),
    ]);

    const [inviteRow] = await prisma.$queryRaw<Array<{
        invite_id: string;
        created_at: bigint;
        updated_at: bigint;
    }>>`
        SELECT swi_id as invite_id, created_at, updated_at
        FROM shared_wallet_invites
        WHERE wallet_id = ${walletId}
          AND sender_u_id = ${senderId}::uuid
          AND receiver_u_id = ${receiverId}::uuid
          AND swi_status = 'pending'
        ORDER BY created_at DESC
        LIMIT 1
    `;

    if (!inviteRow || !sender || !receiver) {
        throw new Error("Không thể tạo lời mời vào quỹ.");
    }

    return {
        inviteId: inviteRow.invite_id,
        walletId,
        walletName: senderWallet.wallet.name,
        senderId: sender.id,
        senderName: sender.displayName || sender.username,
        senderUsername: sender.username,
        senderAvatarUrl: sender.avatarUrl,
        receiverId: receiver.id,
        receiverName: receiver.displayName || receiver.username,
        receiverUsername: receiver.username,
        receiverAvatarUrl: receiver.avatarUrl,
        status: "pending",
        createdAt: Number(inviteRow.created_at),
        updatedAt: Number(inviteRow.updated_at),
    };
}

async function listInvites(whereClause: string, userId: string): Promise<ISharedFundInviteItem[]> {
    await ensureInviteTable();

    const rows = await prisma.$queryRawUnsafe<Array<{
        invite_id: string;
        wallet_id: string;
        wallet_name: string;
        sender_id: string;
        sender_name: string | null;
        sender_username: string;
        sender_avatar_url: string | null;
        receiver_id: string;
        receiver_name: string | null;
        receiver_username: string;
        receiver_avatar_url: string | null;
        status: "pending" | "accepted" | "rejected";
        created_at: bigint;
        updated_at: bigint;
    }>>(
        `
        SELECT
            swi.swi_id as invite_id,
            swi.wallet_id,
            w.w_name as wallet_name,
            sender.u_id as sender_id,
            sender.dn as sender_name,
            sender.username as sender_username,
            sender.avatar_url as sender_avatar_url,
            receiver.u_id as receiver_id,
            receiver.dn as receiver_name,
            receiver.username as receiver_username,
            receiver.avatar_url as receiver_avatar_url,
            swi.swi_status as status,
            swi.created_at,
            swi.updated_at
        FROM shared_wallet_invites swi
        INNER JOIN wallets w ON w.w_id = swi.wallet_id
        INNER JOIN users sender ON sender.u_id = swi.sender_u_id
        INNER JOIN users receiver ON receiver.u_id = swi.receiver_u_id
        WHERE ${whereClause}
        ORDER BY swi.created_at DESC
        `,
        userId,
    );

    return rows.map((row) => ({
        inviteId: row.invite_id,
        walletId: row.wallet_id,
        walletName: row.wallet_name,
        senderId: row.sender_id,
        senderName: row.sender_name || row.sender_username,
        senderUsername: row.sender_username,
        senderAvatarUrl: row.sender_avatar_url,
        receiverId: row.receiver_id,
        receiverName: row.receiver_name || row.receiver_username,
        receiverUsername: row.receiver_username,
        receiverAvatarUrl: row.receiver_avatar_url,
        status: row.status,
        createdAt: Number(row.created_at),
        updatedAt: Number(row.updated_at),
    }));
}

export async function listIncomingSharedFundInvites(userId: string): Promise<ISharedFundInviteItem[]> {
    return listInvites("swi.receiver_u_id = $1::uuid AND swi.swi_status = 'pending'", userId);
}

export async function listOutgoingSharedFundInvites(userId: string): Promise<ISharedFundInviteItem[]> {
    return listInvites("swi.sender_u_id = $1::uuid", userId);
}

async function getInviteById(inviteId: string) {
    await ensureInviteTable();

    const [invite] = await prisma.$queryRaw<Array<{
        invite_id: string;
        wallet_id: string;
        sender_id: string;
        receiver_id: string;
        status: "pending" | "accepted" | "rejected";
    }>>`
        SELECT
            swi_id as invite_id,
            wallet_id,
            sender_u_id as sender_id,
            receiver_u_id as receiver_id,
            swi_status as status
        FROM shared_wallet_invites
        WHERE swi_id = ${inviteId}::uuid
        LIMIT 1
    `;

    return invite;
}

export async function acceptSharedFundInvite(inviteId: string, userId: string): Promise<ISharedFundInviteItem> {
    const invite = await getInviteById(inviteId);

    if (!invite || invite.receiver_id !== userId || invite.status !== "pending") {
        const error = new Error("Lời mời quỹ chung không hợp lệ.");
        (error as Error & { statusCode?: number }).statusCode = 400;
        throw error;
    }

    await withTransaction(async (tx) => {
        await tx.$executeRawUnsafe(
            `
            UPDATE shared_wallet_invites
            SET swi_status = 'accepted', updated_at = $2
            WHERE swi_id = $1::uuid
            `,
            inviteId,
            Date.now(),
        );

        await tx.userWallet.upsert({
            where: {
                userId_walletId: {
                    userId,
                    walletId: invite.wallet_id,
                },
            },
            create: {
                userId,
                walletId: invite.wallet_id,
                role: "contributor",
                orderIndex: 999,
                createdAt: BigInt(Date.now()),
                updatedAt: BigInt(Date.now()),
            },
            update: {
                role: "contributor",
                updatedAt: BigInt(Date.now()),
            },
        });
    });

    const updated = await listInvites("swi.swi_id = $1::uuid", inviteId);
    if (!updated[0]) {
        throw new Error("Không thể cập nhật lời mời quỹ chung.");
    }

    return updated[0];
}

export async function rejectSharedFundInvite(inviteId: string, userId: string): Promise<ISharedFundInviteItem> {
    const invite = await getInviteById(inviteId);

    if (!invite || invite.receiver_id !== userId || invite.status !== "pending") {
        const error = new Error("Lời mời quỹ chung không hợp lệ.");
        (error as Error & { statusCode?: number }).statusCode = 400;
        throw error;
    }

    await prisma.$executeRawUnsafe(
        `
        UPDATE shared_wallet_invites
        SET swi_status = 'rejected', updated_at = $2
        WHERE swi_id = $1::uuid
        `,
        inviteId,
        Date.now(),
    );

    const updated = await listInvites("swi.swi_id = $1::uuid", inviteId);
    if (!updated[0]) {
        throw new Error("Không thể cập nhật lời mời quỹ chung.");
    }

    return updated[0];
}

export async function listSharedFundMembers(userId: string, walletId: string): Promise<ISharedFundMemberItem[]> {
    const access = await prisma.userWallet.findFirst({
        where: {
            userId,
            walletId,
        },
        include: {
            wallet: {
                select: {
                    id: true,
                    type: true,
                },
            },
        },
    });

    if (!access || access.wallet.type !== "shared-fund") {
        const error = new Error("Bạn không có quyền xem thành viên của quỹ này.");
        (error as Error & { statusCode?: number }).statusCode = 403;
        throw error;
    }

    const memberships = await prisma.userWallet.findMany({
        where: { walletId },
        include: {
            user: {
                select: {
                    id: true,
                    displayName: true,
                    username: true,
                    avatarUrl: true,
                },
            },
        },
        orderBy: [
            { role: "asc" },
            { createdAt: "asc" },
        ],
    });

    return memberships.map((membership) => ({
        userId: membership.user.id,
        displayName: membership.user.displayName || membership.user.username,
        username: membership.user.username,
        avatarUrl: membership.user.avatarUrl,
        role: membership.role,
        joinedAt: Number(membership.createdAt),
    }));
}

export async function listSharedFundMemberIds(walletId: string): Promise<string[]> {
    const memberships = await prisma.userWallet.findMany({
        where: { walletId },
        select: { userId: true },
    });

    return memberships.map((item) => item.userId);
}

export async function leaveSharedFund(userId: string, walletId: string): Promise<{ walletId: string; leftUserId: string }> {
    const membership = await prisma.userWallet.findFirst({
        where: {
            userId,
            walletId,
        },
        include: {
            wallet: {
                select: {
                    id: true,
                    type: true,
                },
            },
        },
    });

    if (!membership || membership.wallet.type !== "shared-fund") {
        const error = new Error("Bạn không nằm trong quỹ chung này.");
        (error as Error & { statusCode?: number }).statusCode = 404;
        throw error;
    }

    if (membership.role === "owner") {
        const error = new Error("Chủ quỹ chưa thể rời quỹ. Hãy chuyển quyền sở hữu trước.");
        (error as Error & { statusCode?: number }).statusCode = 400;
        throw error;
    }

    await prisma.userWallet.delete({
        where: {
            userId_walletId: {
                userId,
                walletId,
            },
        },
    });

    return {
        walletId,
        leftUserId: userId,
    };
}

export async function transferSharedFundOwnership(userId: string, payload: {
    walletId: string;
    nextOwnerId: string;
}): Promise<ISharedFundTransferOwnershipResult> {
    const walletId = String(payload.walletId || "").trim();
    const nextOwnerId = String(payload.nextOwnerId || "").trim();

    if (!walletId || !nextOwnerId) {
        const error = new Error("walletId và nextOwnerId là bắt buộc.");
        (error as Error & { statusCode?: number }).statusCode = 400;
        throw error;
    }

    if (userId === nextOwnerId) {
        const error = new Error("Người nhận quyền phải khác chủ quỹ hiện tại.");
        (error as Error & { statusCode?: number }).statusCode = 400;
        throw error;
    }

    const [currentOwner, nextOwner] = await Promise.all([
        prisma.userWallet.findFirst({
            where: { userId, walletId, role: "owner" },
            include: { wallet: { select: { type: true } } },
        }),
        prisma.userWallet.findFirst({
            where: { userId: nextOwnerId, walletId },
            select: { userId: true, walletId: true, role: true },
        }),
    ]);

    if (!currentOwner || currentOwner.wallet.type !== "shared-fund") {
        const error = new Error("Bạn không có quyền chuyển chủ quỹ.");
        (error as Error & { statusCode?: number }).statusCode = 403;
        throw error;
    }

    if (!nextOwner) {
        const error = new Error("Người được chọn không thuộc quỹ chung này.");
        (error as Error & { statusCode?: number }).statusCode = 404;
        throw error;
    }

    await withTransaction(async (tx) => {
        await tx.userWallet.update({
            where: {
                userId_walletId: {
                    userId,
                    walletId,
                },
            },
            data: {
                role: "member",
                updatedAt: BigInt(Date.now()),
            },
        });

        await tx.userWallet.update({
            where: {
                userId_walletId: {
                    userId: nextOwnerId,
                    walletId,
                },
            },
            data: {
                role: "owner",
                updatedAt: BigInt(Date.now()),
            },
        });
    });

    return {
        walletId,
        previousOwnerId: userId,
        nextOwnerId,
    };
}

export async function withdrawSharedFundToWallet(userId: string, payload: {
    walletId: string;
    targetWalletId: string;
    amount: number;
    description?: string;
}): Promise<ISharedFundWithdrawResult> {
    const walletId = String(payload.walletId || "").trim();
    const targetWalletId = String(payload.targetWalletId || "").trim();
    const amount = Number(payload.amount || 0);
    const note = String(payload.description || "").trim();

    if (!walletId || !targetWalletId) {
        const error = new Error("walletId và targetWalletId là bắt buộc.");
        (error as Error & { statusCode?: number }).statusCode = 400;
        throw error;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
        const error = new Error("Số tiền rút phải lớn hơn 0.");
        (error as Error & { statusCode?: number }).statusCode = 400;
        throw error;
    }

    if (walletId === targetWalletId) {
        const error = new Error("Ví nhận phải khác ví quỹ.");
        (error as Error & { statusCode?: number }).statusCode = 400;
        throw error;
    }

    const [sourceMembership, targetMembership, actor] = await Promise.all([
        prisma.userWallet.findFirst({
            where: {
                userId,
                walletId,
            },
            include: {
                wallet: true,
            },
        }),
        prisma.userWallet.findFirst({
            where: {
                userId,
                walletId: targetWalletId,
            },
            include: {
                wallet: true,
            },
        }),
        prisma.user.findUnique({
            where: { id: userId },
            select: { displayName: true, username: true },
        }),
    ]);

    if (!sourceMembership || sourceMembership.wallet.type !== "shared-fund") {
        const error = new Error("Quỹ nguồn không hợp lệ.");
        (error as Error & { statusCode?: number }).statusCode = 404;
        throw error;
    }

    if (!targetMembership) {
        const error = new Error("Ví nhận không hợp lệ.");
        (error as Error & { statusCode?: number }).statusCode = 404;
        throw error;
    }

    if (targetMembership.wallet.type === "shared-fund") {
        const error = new Error("Ví nhận phải là ví cá nhân.");
        (error as Error & { statusCode?: number }).statusCode = 400;
        throw error;
    }

    if (sourceMembership.wallet.isActive === false || targetMembership.wallet.isActive === false) {
        const error = new Error("Một trong hai ví đang tắt, vui lòng bật lại để thực hiện giao dịch.");
        (error as Error & { statusCode?: number }).statusCode = 400;
        throw error;
    }

    const sourceBalance = Number(sourceMembership.wallet.amount || 0);
    if (sourceBalance < amount) {
        const error = new Error("Số dư quỹ không đủ để rút.");
        (error as Error & { statusCode?: number }).statusCode = 400;
        throw error;
    }

    const targetBalance = Number(targetMembership.wallet.amount || 0);
    const actorName = actor?.displayName || actor?.username || "Thành viên";
    const now = Date.now();
    const sourceAfter = sourceBalance - amount;
    const targetAfter = targetBalance + amount;
    const reason = note || "rút quỹ";

    await withTransaction(async (tx) => {
        await tx.wallet.update({
            where: { id: walletId },
            data: {
                amount: sourceAfter,
                updatedAt: BigInt(now),
            },
        });

        await tx.wallet.update({
            where: { id: targetWalletId },
            data: {
                amount: targetAfter,
                updatedAt: BigInt(now),
            },
        });

        await tx.walletLog.createMany({
            data: [
                {
                    walletId,
                    action: "transfer-out",
                    amount,
                    balanceBefore: sourceBalance,
                    balanceAfter: sourceAfter,
                    description: `${actorName} rút ${amount.toLocaleString("vi-VN")} cho ${reason}`,
                    createdAt: BigInt(now),
                },
                {
                    walletId: targetWalletId,
                    action: "transfer-in",
                    amount,
                    balanceBefore: targetBalance,
                    balanceAfter: targetAfter,
                    description: `${actorName} nhận tiền từ quỹ ${sourceMembership.wallet.name}`,
                    createdAt: BigInt(now),
                },
            ],
        });
    });

    return {
        walletId,
        walletName: sourceMembership.wallet.name,
        amount,
        sourceBalanceAfter: sourceAfter,
        targetWalletId,
        targetWalletName: targetMembership.wallet.name,
        targetBalanceAfter: targetAfter,
        createdAt: now,
    };
}

export async function getSharedFundContributionStats(userId: string, walletId: string): Promise<ISharedFundContributionItem[]> {
    const members = await listSharedFundMembers(userId, walletId);

    const rows = await prisma.transaction.groupBy({
        by: ["userId", "type"],
        where: {
            walletId,
            isDeleted: false,
        },
        _sum: {
            amount: true,
        },
    });

    const sumMap = rows.reduce<Record<string, { incomeTotal: number; expenseTotal: number }>>((acc, row) => {
        const key = row.userId;
        if (!acc[key]) {
            acc[key] = { incomeTotal: 0, expenseTotal: 0 };
        }

        const amount = Number(row._sum.amount || 0);
        if (row.type === "income") {
            acc[key].incomeTotal += amount;
        } else {
            acc[key].expenseTotal += amount;
        }

        return acc;
    }, {});

    return members.map((member) => {
        const totals = sumMap[member.userId] || { incomeTotal: 0, expenseTotal: 0 };
        return {
            userId: member.userId,
            displayName: member.displayName,
            username: member.username,
            avatarUrl: member.avatarUrl,
            incomeTotal: totals.incomeTotal,
            expenseTotal: totals.expenseTotal,
            net: totals.incomeTotal - totals.expenseTotal,
        };
    });
}
