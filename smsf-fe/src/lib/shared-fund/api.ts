import { api } from '@/lib/auth/api';
import { IWalletItem } from '@/types/calendar';
import {
    ISharedFundContributionItem,
    ISharedFundInviteItem,
    ISharedFundMemberItem,
    ISharedFundTransferOwnershipResult,
    ISharedFundWithdrawResult,
} from '@/types/shared-fund';
import { IWalletLogPage } from '@/lib/calendar/api';

interface IApiResponse<T> {
    data?: T;
    message?: string;
}

export async function createSharedFundWalletRequest(payload: {
    name: string;
    balance?: number;
    sourceWalletId?: string;
}): Promise<IWalletItem> {
    const response = await api.post<IApiResponse<IWalletItem>>('/wallets/shared-funds', payload);
    return response.data.data!;
}

export async function sendSharedFundInviteRequest(payload: {
    walletId: string;
    receiverId: string;
}): Promise<ISharedFundInviteItem> {
    const response = await api.post<IApiResponse<ISharedFundInviteItem>>('/wallets/shared-funds/invites', payload);
    return response.data.data!;
}

export async function getIncomingSharedFundInvitesRequest(): Promise<ISharedFundInviteItem[]> {
    const response = await api.get<IApiResponse<ISharedFundInviteItem[]>>('/wallets/shared-funds/invites/incoming');
    return response.data.data || [];
}

export async function getOutgoingSharedFundInvitesRequest(): Promise<ISharedFundInviteItem[]> {
    const response = await api.get<IApiResponse<ISharedFundInviteItem[]>>('/wallets/shared-funds/invites/outgoing');
    return response.data.data || [];
}

export async function acceptSharedFundInviteRequest(inviteId: string): Promise<ISharedFundInviteItem> {
    const response = await api.post<IApiResponse<ISharedFundInviteItem>>('/wallets/shared-funds/invites/accept', { inviteId });
    return response.data.data!;
}

export async function rejectSharedFundInviteRequest(inviteId: string): Promise<ISharedFundInviteItem> {
    const response = await api.post<IApiResponse<ISharedFundInviteItem>>('/wallets/shared-funds/invites/reject', { inviteId });
    return response.data.data!;
}

export async function getSharedFundMembersRequest(walletId: string): Promise<ISharedFundMemberItem[]> {
    const response = await api.get<IApiResponse<ISharedFundMemberItem[]>>(`/wallets/shared-funds/${walletId}/members`);
    return response.data.data || [];
}

export async function getSharedFundContributionStatsRequest(walletId: string): Promise<ISharedFundContributionItem[]> {
    const response = await api.get<IApiResponse<{ walletId: string; items: ISharedFundContributionItem[] }>>(
        `/wallets/shared-funds/${walletId}/contributions`,
    );
    return response.data.data?.items || [];
}

export async function leaveSharedFundRequest(walletId: string): Promise<{ walletId: string; leftUserId: string; memberIds: string[] }> {
    const response = await api.post<IApiResponse<{ walletId: string; leftUserId: string; memberIds: string[] }>>(
        '/wallets/shared-funds/leave',
        { walletId },
    );
    return response.data.data!;
}

export async function withdrawSharedFundRequest(payload: {
    walletId: string;
    targetWalletId: string;
    amount: number;
    description?: string;
}): Promise<ISharedFundWithdrawResult> {
    const response = await api.post<IApiResponse<ISharedFundWithdrawResult>>('/wallets/shared-funds/withdraw', payload);
    return response.data.data!;
}

export async function getSharedFundRecentHistoryRequest(walletId: string, limit = 5, page = 1): Promise<IWalletLogPage> {
    const response = await api.get<IApiResponse<IWalletLogPage>>(
        `/wallets/${walletId}/logs`,
        { params: { page, limit } },
    );
    return response.data.data!;
}

export async function transferSharedFundOwnershipRequest(payload: {
    walletId: string;
    nextOwnerId: string;
}): Promise<ISharedFundTransferOwnershipResult> {
    const response = await api.post<IApiResponse<ISharedFundTransferOwnershipResult>>('/wallets/shared-funds/transfer-ownership', payload);
    return response.data.data!;
}
