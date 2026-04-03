export type TypeSharedFundInviteStatus = 'pending' | 'accepted' | 'rejected';

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
    status: TypeSharedFundInviteStatus;
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
    memberIds?: string[];
}

export interface ISharedFundTransferOwnershipResult {
    walletId: string;
    previousOwnerId: string;
    nextOwnerId: string;
    memberIds?: string[];
}
