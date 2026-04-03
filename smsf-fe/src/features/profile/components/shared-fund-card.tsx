'use client';

import { Check, LoaderCircle, Plus, UserPlus, Users2, X, TrendingUp, TrendingDown, LogOut, Download } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppCard } from '@/components/common/app-card';
import { CustomSelect } from '@/components/common/custom-select';
import { PrimaryButton } from '@/components/common/primary-button';
import { UserAvatar } from '@/components/common/user-avatar';
import { getFriendsRequest } from '@/lib/messages/api';
import {
    acceptSharedFundInviteRequest,
    createSharedFundWalletRequest,
    getSharedFundMembersRequest,
    getIncomingSharedFundInvitesRequest,
    getOutgoingSharedFundInvitesRequest,
    rejectSharedFundInviteRequest,
    sendSharedFundInviteRequest,
    getSharedFundContributionStatsRequest,
    leaveSharedFundRequest,
    transferSharedFundOwnershipRequest,
    withdrawSharedFundRequest,
    getSharedFundRecentHistoryRequest,
} from '@/lib/shared-fund/api';
import {
    offSharedFundInviteReceived,
    offSharedFundInviteResolved,
    offSharedFundMembershipUpdated,
    onSharedFundInviteReceived,
    onSharedFundInviteResolved,
    onSharedFundMembershipUpdated,
} from '@/lib/socket-io';
import { useAuth } from '@/providers/auth-provider';
import { formatCurrencyVND } from '@/lib/formatters';
import { getWalletLogLabel, isWalletLogCredit } from '@/lib/wallet-log-label';
import { IFriendListItem } from '@/types/messages';
import { ISharedFundInviteItem, ISharedFundMemberItem, ISharedFundContributionItem } from '@/types/shared-fund';
import { IWalletLogItem } from '@/lib/calendar/api';

export function SharedFundCard() {
    const { user, wallets, refreshWallets, totalWalletBalance } = useAuth();

    const [friends, setFriends] = useState<IFriendListItem[]>([]);
    const [incomingInvites, setIncomingInvites] = useState<ISharedFundInviteItem[]>([]);
    const [outgoingInvites, setOutgoingInvites] = useState<ISharedFundInviteItem[]>([]);
    const [members, setMembers] = useState<ISharedFundMemberItem[]>([]);

    const [fundName, setFundName] = useState('');
    const [fundBalance, setFundBalance] = useState('');
    const [sourceWalletId, setSourceWalletId] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    const [selectedWalletId, setSelectedWalletId] = useState('');
    const [isLoadingMembers, setIsLoadingMembers] = useState(false);
    const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
    const [inviteSearchKeyword, setInviteSearchKeyword] = useState('');
    const [invitingFriendId, setInvitingFriendId] = useState('');

    const [contributionStats, setContributionStats] = useState<ISharedFundContributionItem[]>([]);
    const [isLoadingStats, setIsLoadingStats] = useState(false);
    const [recentHistory, setRecentHistory] = useState<IWalletLogItem[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [withdrawDialog, setWithdrawDialog] = useState<{ isOpen: boolean; targetWalletId: string; amount: string }>({ isOpen: false, targetWalletId: '', amount: '' });
    const [isWithdrawing, setIsWithdrawing] = useState(false);
    const [nextOwnerId, setNextOwnerId] = useState('');

    const [actionLoadingMap, setActionLoadingMap] = useState<Record<string, boolean>>({});
    const [errorMessage, setErrorMessage] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    const sharedWallets = useMemo(
        () => wallets.filter((wallet) => wallet.type === 'shared-fund'),
        [wallets],
    );

    const fundingWalletOptions = useMemo(
        () => wallets.filter((wallet) => wallet.type !== 'shared-fund' && wallet.isActive !== false),
        [wallets],
    );

    const selectedWallet = useMemo(
        () => sharedWallets.find((wallet) => wallet.id === selectedWalletId) || null,
        [selectedWalletId, sharedWallets],
    );

    const memberIdSet = useMemo(() => {
        return new Set(members.map((member) => member.userId));
    }, [members]);

    const inviteCandidates = useMemo(() => {
        const keyword = inviteSearchKeyword.trim().toLowerCase();
        return friends
            .filter((friend) => !memberIdSet.has(friend.friendId))
            .filter((friend) => {
                if (!keyword) {
                    return true;
                }

                const searchable = `${friend.friendName} ${friend.friendUsername}`.toLowerCase();
                return searchable.includes(keyword);
            })
            .sort((left, right) => left.friendName.localeCompare(right.friendName, 'vi'));
    }, [friends, inviteSearchKeyword, memberIdSet]);

    const sourceWalletSelectOptions = useMemo(
        () => fundingWalletOptions.map((wallet) => ({
            value: wallet.id,
            label: `${wallet.name} - ${formatCurrencyVND(wallet.balance)}`,
        })),
        [fundingWalletOptions],
    );

    const pendingInviteFriendIds = useMemo(() => {
        return new Set(
            outgoingInvites
                .filter((invite) => invite.walletId === selectedWalletId && invite.status === 'pending')
                .map((invite) => invite.receiverId),
        );
    }, [outgoingInvites, selectedWalletId]);

    const sharedFundsTotalBalance = useMemo(
        () => sharedWallets.reduce((sum, wallet) => sum + wallet.balance, 0),
        [sharedWallets],
    );

    const selectedMembership = useMemo(
        () => members.find((member) => member.userId === user?.id) || null,
        [members, user?.id],
    );

    const transferableMembers = useMemo(
        () => members.filter((member) => member.userId !== user?.id),
        [members, user?.id],
    );

    const transferOwnerOptions = useMemo(
        () => transferableMembers.map((member) => ({ value: member.userId, label: `${member.displayName} (@${member.username})` })),
        [transferableMembers],
    );

    const loadData = useCallback(async () => {
        const [friendItems, incomingItems, outgoingItems] = await Promise.all([
            getFriendsRequest(),
            getIncomingSharedFundInvitesRequest(),
            getOutgoingSharedFundInvitesRequest(),
        ]);

        setFriends(friendItems);
        setIncomingInvites(incomingItems);
        setOutgoingInvites(outgoingItems);

        const sharedWalletIds = wallets
            .filter((wallet) => wallet.type === 'shared-fund')
            .map((wallet) => wallet.id);

        setSelectedWalletId((current) => {
            if (current && sharedWalletIds.includes(current)) {
                return current;
            }

            return sharedWalletIds[0] || '';
        });
    }, [wallets]);

    const loadMembers = useCallback(async (walletId: string) => {
        if (!walletId) {
            setMembers([]);
            return;
        }

        setIsLoadingMembers(true);
        try {
            const memberItems = await getSharedFundMembersRequest(walletId);
            setMembers(memberItems);
        } catch {
            setMembers([]);
        } finally {
            setIsLoadingMembers(false);
        }
    }, []);

    const loadContributionStats = useCallback(async (walletId: string) => {
        if (!walletId) {
            setContributionStats([]);
            return;
        }

        setIsLoadingStats(true);
        try {
            const items = await getSharedFundContributionStatsRequest(walletId);
            setContributionStats(items);
        } catch {
            setContributionStats([]);
        } finally {
            setIsLoadingStats(false);
        }
    }, []);

    const loadRecentHistory = useCallback(async (walletId: string) => {
        if (!walletId) {
            setRecentHistory([]);
            return;
        }

        setIsLoadingHistory(true);
        try {
            const page = await getSharedFundRecentHistoryRequest(walletId, 5);
            setRecentHistory(page.items);
        } catch {
            setRecentHistory([]);
        } finally {
            setIsLoadingHistory(false);
        }
    }, []);

    useEffect(() => {
        void loadData();
    }, [loadData]);

    useEffect(() => {
        setSourceWalletId((current) => {
            if (current && fundingWalletOptions.some((wallet) => wallet.id === current)) {
                return current;
            }

            return fundingWalletOptions[0]?.id || '';
        });
    }, [fundingWalletOptions]);

    useEffect(() => {
        setWithdrawDialog((current) => {
            if (current.targetWalletId && fundingWalletOptions.some((wallet) => wallet.id === current.targetWalletId)) {
                return current;
            }

            return {
                ...current,
                targetWalletId: fundingWalletOptions[0]?.id || '',
            };
        });
    }, [fundingWalletOptions]);

    useEffect(() => {
        setNextOwnerId((current) => {
            if (current && transferableMembers.some((member) => member.userId === current)) {
                return current;
            }

            return transferableMembers[0]?.userId || '';
        });
    }, [transferableMembers]);

    useEffect(() => {
        void loadMembers(selectedWalletId);
        void loadContributionStats(selectedWalletId);
        void loadRecentHistory(selectedWalletId);
    }, [loadMembers, loadContributionStats, loadRecentHistory, selectedWalletId]);

    useEffect(() => {
        const refreshHandler = () => {
            void loadData();
            void refreshWallets();
        };

        onSharedFundInviteReceived(refreshHandler);
        onSharedFundInviteResolved(refreshHandler);
        onSharedFundMembershipUpdated(refreshHandler);

        return () => {
            offSharedFundInviteReceived(refreshHandler);
            offSharedFundInviteResolved(refreshHandler);
            offSharedFundMembershipUpdated(refreshHandler);
        };
    }, [loadData, refreshWallets]);

    const handleCreateFund = useCallback(async () => {
        const name = fundName.trim();
        const initialBalance = Number(fundBalance.replace(/\D/g, '') || 0);
        if (!name) {
            setErrorMessage('Vui lòng nhập tên quỹ chung.');
            return;
        }

        if (initialBalance > 0 && !sourceWalletId) {
            setErrorMessage('Vui lòng chọn ví nguồn để chuyển tiền sang quỹ chung.');
            return;
        }

        setIsCreating(true);
        setErrorMessage('');
        setSuccessMessage('');

        try {
            const created = await createSharedFundWalletRequest({
                name,
                balance: initialBalance,
                sourceWalletId: initialBalance > 0 ? sourceWalletId : undefined,
            });
            await refreshWallets();
            await loadData();
            setFundName('');
            setFundBalance('');
            setSelectedWalletId(created.id);
            setSuccessMessage('Đã tạo quỹ chung mới.');
        } catch (error) {
            const responseMessage =
                (error as { response?: { data?: { message?: string } } })?.response?.data?.message
                || 'Tạo quỹ chung thất bại.';
            setErrorMessage(responseMessage);
        } finally {
            setIsCreating(false);
        }
    }, [fundBalance, fundName, loadData, refreshWallets, sourceWalletId]);

    const handleInviteFriend = useCallback(async (receiverId: string) => {
        if (!selectedWalletId || !receiverId) {
            setErrorMessage('Vui lòng chọn quỹ và bạn bè để mời.');
            return;
        }

        setInvitingFriendId(receiverId);
        setErrorMessage('');
        setSuccessMessage('');

        try {
            await sendSharedFundInviteRequest({
                walletId: selectedWalletId,
                receiverId,
            });
            await Promise.all([loadData(), loadMembers(selectedWalletId)]);
        } catch (error) {
            const responseMessage =
                (error as { response?: { data?: { message?: string } } })?.response?.data?.message
                || 'Gửi lời mời quỹ chung thất bại.';
            setErrorMessage(responseMessage);
        } finally {
            setInvitingFriendId('');
        }
    }, [loadData, loadMembers, selectedWalletId]);

    const handleResolveInvite = useCallback(async (inviteId: string, action: 'accept' | 'reject') => {
        setActionLoadingMap((previous) => ({ ...previous, [inviteId]: true }));
        setErrorMessage('');
        setSuccessMessage('');

        try {
            if (action === 'accept') {
                await acceptSharedFundInviteRequest(inviteId);
                setSuccessMessage('Bạn đã tham gia quỹ chung.');
            } else {
                await rejectSharedFundInviteRequest(inviteId);
                setSuccessMessage('Đã từ chối lời mời quỹ chung.');
            }

            await refreshWallets();
            await Promise.all([loadData(), loadMembers(selectedWalletId)]);
        } catch (error) {
            const responseMessage =
                (error as { response?: { data?: { message?: string } } })?.response?.data?.message
                || 'Không thể xử lý lời mời quỹ chung.';
            setErrorMessage(responseMessage);
        } finally {
            setActionLoadingMap((previous) => ({ ...previous, [inviteId]: false }));
        }
    }, [loadData, loadMembers, refreshWallets, selectedWalletId]);

    const handleLeaveSharedFund = useCallback(async () => {
        if (!selectedWalletId || actionLoadingMap[`leave-${selectedWalletId}`]) {
            return;
        }

        setActionLoadingMap((previous) => ({ ...previous, [`leave-${selectedWalletId}`]: true }));
        setErrorMessage('');
        setSuccessMessage('');

        try {
            await leaveSharedFundRequest(selectedWalletId);
            setSuccessMessage('Bạn đã rời quỹ chung.');
            await refreshWallets();
            await loadData();
        } catch (error) {
            const responseMessage =
                (error as { response?: { data?: { message?: string } } })?.response?.data?.message
                || 'Không thể rời quỹ chung.';
            setErrorMessage(responseMessage);
        } finally {
            setActionLoadingMap((previous) => ({ ...previous, [`leave-${selectedWalletId}`]: false }));
        }
    }, [selectedWalletId, actionLoadingMap, loadData, refreshWallets]);

    const handleWithdrawSharedFund = useCallback(async () => {
        const walletId = withdrawDialog.targetWalletId;
        const amount = Number(withdrawDialog.amount.replace(/\D/g, '') || 0);

        if (!selectedWalletId || !walletId || amount <= 0) {
            setErrorMessage('Vui lòng nhập số tiền và chọn ví hợp lệ.');
            return;
        }

        setIsWithdrawing(true);
        setErrorMessage('');
        setSuccessMessage('');

        try {
            await withdrawSharedFundRequest({
                walletId: selectedWalletId,
                targetWalletId: walletId,
                amount,
            });
            setSuccessMessage('Rút quỹ thành công.');
            setWithdrawDialog({ isOpen: false, targetWalletId: '', amount: '' });
            await refreshWallets();
            await Promise.all([loadData(), loadRecentHistory(selectedWalletId)]);
        } catch (error) {
            const responseMessage =
                (error as { response?: { data?: { message?: string } } })?.response?.data?.message
                || 'Rút quỹ thất bại.';
            setErrorMessage(responseMessage);
        } finally {
            setIsWithdrawing(false);
        }
    }, [withdrawDialog, selectedWalletId, loadData, loadRecentHistory, refreshWallets]);

    const handleTransferOwnership = useCallback(async () => {
        if (!selectedWalletId || !nextOwnerId || actionLoadingMap[`transfer-${selectedWalletId}`]) {
            return;
        }

        setActionLoadingMap((previous) => ({ ...previous, [`transfer-${selectedWalletId}`]: true }));
        setErrorMessage('');
        setSuccessMessage('');

        try {
            await transferSharedFundOwnershipRequest({
                walletId: selectedWalletId,
                nextOwnerId,
            });
            setSuccessMessage('Đã chuyển quyền chủ quỹ.');
            await Promise.all([refreshWallets(), loadData(), loadMembers(selectedWalletId)]);
        } catch (error) {
            const responseMessage =
                (error as { response?: { data?: { message?: string } } })?.response?.data?.message
                || 'Không thể chuyển quyền chủ quỹ.';
            setErrorMessage(responseMessage);
        } finally {
            setActionLoadingMap((previous) => ({ ...previous, [`transfer-${selectedWalletId}`]: false }));
        }
    }, [actionLoadingMap, loadData, loadMembers, nextOwnerId, refreshWallets, selectedWalletId]);

    const closeInviteModal = useCallback(() => {
        setIsInviteModalOpen(false);
        setInviteSearchKeyword('');
    }, []);

    const handleOpenInviteModal = useCallback(() => {
        if (!selectedWalletId) {
            setErrorMessage('Vui lòng chọn quỹ chung trước khi mời bạn bè.');
            return;
        }

        setIsInviteModalOpen(true);
        setInviteSearchKeyword('');
    }, [selectedWalletId]);

    const formatInviteDate = useCallback((timestamp: number) => {
        return new Intl.DateTimeFormat('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
            day: '2-digit',
            month: '2-digit',
        }).format(new Date(timestamp));
    }, []);

    return (
        <AppCard strong style={{ padding: 16, display: 'grid', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Users2 size={17} color='var(--accent)' />
                <span style={{ fontWeight: 800 }}>Quỹ chung</span>
            </div>

            <div style={{ borderRadius: 12, border: '1px solid var(--surface-border)', background: 'var(--surface-soft)', padding: 12, display: 'grid', gap: 8 }}>
                <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>Tạo quỹ chung mới</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 8 }}>
                    <input
                        value={fundName}
                        onChange={(event) => setFundName(event.target.value)}
                        placeholder='Tên quỹ chung'
                        style={{
                            width: '100%',
                            borderRadius: 10,
                            border: '1px solid var(--surface-border)',
                            background: 'var(--surface-strong)',
                            color: 'var(--foreground)',
                            minHeight: 40,
                            padding: '0 10px',
                            fontSize: 13.5,
                        }}
                    />
                    <input
                        inputMode='numeric'
                        value={fundBalance ? new Intl.NumberFormat('vi-VN').format(Number(fundBalance.replace(/\D/g, '') || 0)) : ''}
                        onChange={(event) => setFundBalance(event.target.value.replace(/\D/g, ''))}
                        placeholder='Số dư đầu'
                        style={{
                            width: '100%',
                            borderRadius: 10,
                            border: '1px solid var(--surface-border)',
                            background: 'var(--surface-strong)',
                            color: 'var(--foreground)',
                            minHeight: 40,
                            padding: '0 10px',
                            fontSize: 13.5,
                        }}
                    />
                </div>
                <div style={{ display: 'grid', gap: 6 }}>
                    <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>Ví nguồn (dùng khi nhập số dư ban đầu)</div>
                    <CustomSelect
                        value={sourceWalletId}
                        onChange={setSourceWalletId}
                        options={sourceWalletSelectOptions}
                        placeholder='Chọn ví nguồn'
                    />
                </div>
                <PrimaryButton onClick={handleCreateFund} disabled={isCreating} style={{ justifyContent: 'center' }}>
                    {isCreating ? <LoaderCircle size={15} className='spin' /> : <Plus size={15} />}
                    {isCreating ? 'Đang tạo...' : 'Tạo quỹ chung'}
                </PrimaryButton>
            </div>

            <div style={{ borderRadius: 12, border: '1px solid var(--surface-border)', background: 'var(--surface-soft)', padding: 12, display: 'grid', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div>
                        <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>Danh sách quỹ chung</div>
                        <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>
                            {sharedWallets.length} quỹ · Tổng quỹ {formatCurrencyVND(sharedFundsTotalBalance)} · Ví cá nhân {formatCurrencyVND(totalWalletBalance)}
                        </div>
                    </div>
                    <button
                        type='button'
                        onClick={handleOpenInviteModal}
                        disabled={!selectedWalletId}
                        style={{
                            borderRadius: 10,
                            border: '1px solid var(--surface-border)',
                            background: 'var(--surface-strong)',
                            color: 'var(--foreground)',
                            minHeight: 34,
                            padding: '0 10px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            fontWeight: 700,
                            opacity: selectedWalletId ? 1 : 0.55,
                        }}
                    >
                        <UserPlus size={14} /> Mời bạn
                    </button>
                </div>

                {sharedWallets.length === 0 ? (
                    <div style={{ color: 'var(--muted)', fontSize: 12.5 }}>Bạn chưa có quỹ chung nào.</div>
                ) : (
                    <div style={{ display: 'grid', gap: 8 }}>
                        {sharedWallets.map((wallet) => {
                            const isSelected = wallet.id === selectedWalletId;
                            return (
                                <button
                                    key={wallet.id}
                                    type='button'
                                    onClick={() => setSelectedWalletId(wallet.id)}
                                    style={{
                                        borderRadius: 10,
                                        border: isSelected ? '1px solid var(--chip-border)' : '1px solid var(--surface-border)',
                                        background: isSelected ? 'var(--chip-bg)' : 'var(--surface-strong)',
                                        color: 'var(--foreground)',
                                        minHeight: 44,
                                        padding: '0 12px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        textAlign: 'left',
                                    }}
                                >
                                    <span style={{ fontWeight: 700 }}>{wallet.name}</span>
                                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>{formatCurrencyVND(wallet.balance)}</span>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            <div style={{ borderRadius: 12, border: '1px solid var(--surface-border)', background: 'var(--surface-soft)', padding: 12, display: 'grid', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div>
                        <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>Điều khiển quỹ</div>
                        <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>
                            {selectedWallet ? `${selectedWallet.name} · ${formatCurrencyVND(selectedWallet.balance)}` : 'Chọn một quỹ để thao tác'}
                        </div>
                    </div>
                </div>

                {!selectedWallet ? (
                    <div style={{ color: 'var(--muted)', fontSize: 12.5 }}>Chọn quỹ chung để rút tiền hoặc rời quỹ.</div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
                        <button
                            type='button'
                            onClick={() => setWithdrawDialog((current) => ({ ...current, isOpen: true }))}
                            disabled={fundingWalletOptions.length === 0}
                            style={{
                                minHeight: 38,
                                borderRadius: 10,
                                border: '1px solid color-mix(in srgb, #2563eb 35%, var(--surface-border))',
                                background: 'color-mix(in srgb, #2563eb 12%, var(--surface-strong))',
                                color: '#1d4ed8',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 6,
                                fontWeight: 800,
                                opacity: fundingWalletOptions.length === 0 ? 0.55 : 1,
                            }}
                        >
                            <Download size={14} /> Rút về ví
                        </button>
                        <button
                            type='button'
                            onClick={() => void handleLeaveSharedFund()}
                            disabled={selectedMembership?.role === 'owner' || Boolean(actionLoadingMap[`leave-${selectedWallet.id}`])}
                            style={{
                                minHeight: 38,
                                borderRadius: 10,
                                border: '1px solid color-mix(in srgb, #ef4444 35%, var(--surface-border))',
                                background: 'color-mix(in srgb, #ef4444 10%, var(--surface-strong))',
                                color: '#dc2626',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 6,
                                fontWeight: 800,
                                opacity: selectedMembership?.role === 'owner' ? 0.55 : 1,
                            }}
                        >
                            <LogOut size={14} /> {actionLoadingMap[`leave-${selectedWallet.id}`] ? 'Đang rời...' : 'Rời quỹ'}
                        </button>
                    </div>
                )}

                {selectedWallet && selectedMembership?.role === 'owner' ? (
                    <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>Chủ quỹ hiện chưa thể rời quỹ trực tiếp.</div>
                ) : null}
                {selectedWallet && fundingWalletOptions.length === 0 ? (
                    <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>Bạn cần ít nhất một ví cá nhân đang hoạt động để nhận tiền rút từ quỹ.</div>
                ) : null}
                {selectedWallet && selectedMembership?.role === 'owner' ? (
                    <div style={{ display: 'grid', gap: 8, marginTop: 4 }}>
                        <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>Chuyển quyền chủ quỹ trước khi rời quỹ</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 8 }}>
                            <CustomSelect
                                value={nextOwnerId}
                                onChange={setNextOwnerId}
                                options={transferOwnerOptions}
                                placeholder='Chọn thành viên nhận quyền'
                            />
                            <button
                                type='button'
                                onClick={() => void handleTransferOwnership()}
                                disabled={!nextOwnerId || Boolean(actionLoadingMap[`transfer-${selectedWallet.id}`])}
                                style={{
                                    minHeight: 38,
                                    borderRadius: 10,
                                    border: '1px solid color-mix(in srgb, #16a34a 35%, var(--surface-border))',
                                    background: 'color-mix(in srgb, #16a34a 10%, var(--surface-strong))',
                                    color: '#15803d',
                                    padding: '0 12px',
                                    fontWeight: 800,
                                    opacity: !nextOwnerId ? 0.55 : 1,
                                }}
                            >
                                {actionLoadingMap[`transfer-${selectedWallet.id}`] ? 'Đang chuyển...' : 'Chuyển quyền'}
                            </button>
                        </div>
                    </div>
                ) : null}
            </div>

            <div style={{ borderRadius: 12, border: '1px solid var(--surface-border)', background: 'var(--surface-soft)', padding: 12, display: 'grid', gap: 8, minHeight: 180 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>
                        {selectedWallet ? `Thành viên quỹ: ${selectedWallet.name}` : 'Chọn một quỹ để xem thành viên'}
                    </div>
                    {selectedWallet ? <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>{members.length} thành viên</span> : null}
                </div>

                {!selectedWallet ? (
                    <div style={{ color: 'var(--muted)', fontSize: 12.5 }}>Danh sách thành viên sẽ hiển thị tại đây sau khi bạn chọn quỹ.</div>
                ) : members.length === 0 ? (
                    <div style={{ color: 'var(--muted)', fontSize: 12.5 }}>Quỹ này chưa có thành viên nào.</div>
                ) : (
                    <div
                        style={{
                            display: 'grid',
                            gap: 8,
                            maxHeight: 230,
                            overflowY: 'auto',
                            transition: 'opacity 180ms ease, transform 180ms ease',
                            opacity: isLoadingMembers ? 0.55 : 1,
                            transform: isLoadingMembers ? 'translateY(3px)' : 'translateY(0)',
                        }}
                    >
                        {members.map((member) => (
                            <div key={member.userId} style={{ borderRadius: 10, border: '1px solid var(--surface-border)', background: 'var(--surface-strong)', padding: '8px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                                    <UserAvatar src={member.avatarUrl || undefined} alt={member.displayName} size={30} />
                                    <div style={{ minWidth: 0 }}>
                                        <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{member.displayName}</div>
                                        <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>@{member.username}</div>
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                    <div style={{ fontSize: 11.5, fontWeight: 700, color: member.role === 'owner' ? '#16a34a' : 'var(--muted)' }}>
                                        {member.role === 'owner' ? 'Chủ quỹ' : 'Thành viên'}
                                    </div>
                                    <div style={{ fontSize: 10.5, color: 'var(--muted)' }}>{formatInviteDate(member.joinedAt)}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                {selectedWallet && isLoadingMembers ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--muted)', fontSize: 12 }}>
                        <LoaderCircle size={12} className='spin' /> Đang cập nhật thành viên...
                    </div>
                ) : null}
            </div>

            <div style={{ borderRadius: 12, border: '1px solid var(--surface-border)', background: 'var(--surface-soft)', padding: 12, display: 'grid', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>Thống kê nhập và chi theo người</div>
                    {selectedWallet ? <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>{contributionStats.length} thành viên</span> : null}
                </div>

                {!selectedWallet ? (
                    <div style={{ color: 'var(--muted)', fontSize: 12.5 }}>Chọn quỹ để xem ai đã nạp và sử dụng quỹ.</div>
                ) : contributionStats.length === 0 && !isLoadingStats ? (
                    <div style={{ color: 'var(--muted)', fontSize: 12.5 }}>Chưa có giao dịch nào để thống kê.</div>
                ) : (
                    <div style={{ display: 'grid', gap: 8, opacity: isLoadingStats ? 0.6 : 1, transition: 'opacity 160ms ease' }}>
                        {contributionStats.map((item) => (
                            <div key={item.userId} style={{ borderRadius: 10, border: '1px solid var(--surface-border)', background: 'var(--surface-strong)', padding: '10px 12px', display: 'grid', gap: 8 }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                                        <UserAvatar src={item.avatarUrl || undefined} alt={item.displayName} size={30} />
                                        <div style={{ minWidth: 0 }}>
                                            <div style={{ fontSize: 13, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.displayName}</div>
                                            <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>@{item.username}</div>
                                        </div>
                                    </div>
                                    <div style={{ fontSize: 12, fontWeight: 800, color: item.net >= 0 ? '#16a34a' : '#dc2626' }}>
                                        {item.net >= 0 ? '+' : ''}{formatCurrencyVND(item.net)}
                                    </div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
                                    <div style={{ borderRadius: 8, background: 'color-mix(in srgb, #16a34a 12%, var(--surface-base))', padding: '8px 10px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#15803d', fontWeight: 800 }}><TrendingUp size={13} /> Đã nhập quỹ</div>
                                        <div style={{ marginTop: 4, fontSize: 13, fontWeight: 800 }}>{formatCurrencyVND(item.incomeTotal)}</div>
                                    </div>
                                    <div style={{ borderRadius: 8, background: 'color-mix(in srgb, #ef4444 10%, var(--surface-base))', padding: '8px 10px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#dc2626', fontWeight: 800 }}><TrendingDown size={13} /> Đã chi quỹ</div>
                                        <div style={{ marginTop: 4, fontSize: 13, fontWeight: 800 }}>{formatCurrencyVND(item.expenseTotal)}</div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div style={{ borderRadius: 12, border: '1px solid var(--surface-border)', background: 'var(--surface-soft)', padding: 12, display: 'grid', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>5 lịch sử quỹ gần nhất</div>
                    {selectedWallet ? <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>{selectedWallet.name}</span> : null}
                </div>

                {!selectedWallet ? (
                    <div style={{ color: 'var(--muted)', fontSize: 12.5 }}>Chọn quỹ để xem lịch sử biến động gần nhất.</div>
                ) : recentHistory.length === 0 && !isLoadingHistory ? (
                    <div style={{ color: 'var(--muted)', fontSize: 12.5 }}>Quỹ này chưa có lịch sử biến động.</div>
                ) : (
                    <div style={{ display: 'grid', gap: 8, opacity: isLoadingHistory ? 0.6 : 1, transition: 'opacity 160ms ease' }}>
                        {recentHistory.map((log) => {
                            const isCredit = isWalletLogCredit(log.action);
                            return (
                                <div key={log.id} style={{ borderRadius: 10, border: '1px solid var(--surface-border)', background: 'var(--surface-strong)', padding: '10px 12px', display: 'grid', gap: 4 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                                        <div style={{ fontSize: 12, fontWeight: 800, color: isCredit ? '#16a34a' : '#f97316' }}>
                                            {getWalletLogLabel(log.action)}
                                        </div>
                                        <div style={{ fontSize: 10.5, color: 'var(--muted)' }}>{formatInviteDate(log.createdAt)}</div>
                                    </div>
                                    <div style={{ fontSize: 13, fontWeight: 800 }}>{formatCurrencyVND(log.amount)}</div>
                                    <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                                        {formatCurrencyVND(log.balanceBefore)} → {formatCurrencyVND(log.balanceAfter)}
                                    </div>
                                    {log.description ? <div style={{ fontSize: 11.5, color: 'var(--foreground)' }}>{log.description}</div> : null}
                                    {log.actorDisplayName ? <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>Thực hiện bởi <span style={{ color: 'var(--foreground)', fontWeight: 700 }}>{log.actorDisplayName}</span></div> : null}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {incomingInvites.length > 0 ? (
                <div style={{ display: 'grid', gap: 8 }}>
                    <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>Lời mời quỹ chung ({incomingInvites.length})</div>
                    {incomingInvites.map((invite) => {
                        const isBusy = Boolean(actionLoadingMap[invite.inviteId]);
                        return (
                            <div key={invite.inviteId} style={{ borderRadius: 12, border: '1px solid var(--surface-border)', background: 'var(--surface-soft)', padding: 10, display: 'grid', gap: 8 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <UserAvatar src={invite.senderAvatarUrl || undefined} alt={invite.senderName} size={30} />
                                    <div style={{ minWidth: 0 }}>
                                        <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {invite.senderName} mời bạn vào quỹ {invite.walletName}
                                        </div>
                                        <div style={{ fontSize: 12, color: 'var(--muted)' }}>@{invite.senderUsername}</div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <button
                                        type='button'
                                        disabled={isBusy}
                                        onClick={() => void handleResolveInvite(invite.inviteId, 'accept')}
                                        style={{
                                            flex: 1,
                                            borderRadius: 8,
                                            border: '1px solid color-mix(in srgb, #22c55e 40%, var(--surface-border))',
                                            background: 'transparent',
                                            color: '#16a34a',
                                            minHeight: 30,
                                            fontWeight: 700,
                                            fontSize: 11.5,
                                        }}
                                    >
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Check size={13} /> Chấp nhận</span>
                                    </button>
                                    <button
                                        type='button'
                                        disabled={isBusy}
                                        onClick={() => void handleResolveInvite(invite.inviteId, 'reject')}
                                        style={{
                                            flex: 1,
                                            borderRadius: 8,
                                            border: '1px solid color-mix(in srgb, #ef4444 40%, var(--surface-border))',
                                            background: 'transparent',
                                            color: '#ef4444',
                                            minHeight: 30,
                                            fontWeight: 700,
                                            fontSize: 11.5,
                                        }}
                                    >
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><X size={13} /> Từ chối</span>
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : null}

            {outgoingInvites.length > 0 ? (
                <div style={{ display: 'grid', gap: 8 }}>
                    <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>Lời mời đã gửi</div>
                    {outgoingInvites.slice(0, 4).map((invite) => (
                        <div key={invite.inviteId} style={{ borderRadius: 10, border: '1px solid var(--surface-border)', padding: '8px 10px', background: 'var(--surface-soft)', fontSize: 12.5, color: 'var(--foreground)' }}>
                            {invite.receiverName} - {invite.walletName} ({invite.status === 'pending' ? 'Đang chờ' : invite.status === 'accepted' ? 'Đã tham gia' : 'Đã từ chối'})
                        </div>
                    ))}
                </div>
            ) : null}

            {errorMessage ? <div style={{ color: '#ef4444', fontSize: 12 }}>{errorMessage}</div> : null}
            {successMessage ? <div style={{ color: '#16a34a', fontSize: 12 }}>{successMessage}</div> : null}

            {user?.id ? null : <div style={{ fontSize: 12, color: 'var(--muted)' }}>Đăng nhập để dùng quỹ chung.</div>}

            {isInviteModalOpen ? (
                <>
                    <div
                        role='presentation'
                        onClick={closeInviteModal}
                        style={{
                            position: 'fixed',
                            inset: 0,
                            background: 'rgba(2, 8, 23, 0.5)',
                            zIndex: 60,
                        }}
                    />
                    <div
                        role='dialog'
                        aria-modal='true'
                        style={{
                            position: 'fixed',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            width: 'min(92vw, 420px)',
                            maxHeight: '78vh',
                            borderRadius: 16,
                            border: '1px solid var(--surface-border)',
                            background: 'var(--surface-strong)',
                            boxShadow: '0 24px 80px rgba(0,0,0,0.35)',
                            zIndex: 61,
                            display: 'grid',
                            gridTemplateRows: 'auto auto 1fr',
                            overflow: 'hidden',
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '12px 14px', borderBottom: '1px solid var(--surface-border)' }}>
                            <div>
                                <div style={{ fontWeight: 800 }}>Mời bạn vào quỹ</div>
                                <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>{selectedWallet?.name || 'Quỹ chung'}</div>
                            </div>
                            <button
                                type='button'
                                onClick={closeInviteModal}
                                style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: 10,
                                    border: '1px solid var(--surface-border)',
                                    background: 'var(--surface-soft)',
                                    color: 'var(--foreground)',
                                    display: 'grid',
                                    placeItems: 'center',
                                }}
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--surface-border)' }}>
                            <input
                                value={inviteSearchKeyword}
                                onChange={(event) => setInviteSearchKeyword(event.target.value)}
                                placeholder='Tìm bạn bè theo tên hoặc username'
                                style={{
                                    width: '100%',
                                    borderRadius: 10,
                                    border: '1px solid var(--surface-border)',
                                    background: 'var(--surface-soft)',
                                    color: 'var(--foreground)',
                                    minHeight: 38,
                                    padding: '0 10px',
                                    fontSize: 13,
                                }}
                            />
                        </div>

                        <div style={{ overflowY: 'auto', padding: 12, display: 'grid', gap: 8 }}>
                            {inviteCandidates.length === 0 ? (
                                <div style={{ color: 'var(--muted)', fontSize: 12.5, textAlign: 'center', padding: '8px 0' }}>
                                    Không còn bạn bè nào để mời vào quỹ này.
                                </div>
                            ) : inviteCandidates.map((friend) => {
                                const isInviting = invitingFriendId === friend.friendId;
                                const isInvited = pendingInviteFriendIds.has(friend.friendId);
                                return (
                                    <div key={friend.friendId} style={{ borderRadius: 10, border: '1px solid var(--surface-border)', background: 'var(--surface-soft)', padding: '8px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                                            <UserAvatar src={friend.friendAvatarUrl || undefined} alt={friend.friendName} size={30} />
                                            <div style={{ minWidth: 0 }}>
                                                <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{friend.friendName}</div>
                                                <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>@{friend.friendUsername}</div>
                                            </div>
                                        </div>
                                        <button
                                            type='button'
                                            disabled={isInviting || isInvited}
                                            onClick={() => void handleInviteFriend(friend.friendId)}
                                            style={{
                                                borderRadius: 8,
                                                border: isInvited
                                                    ? '1px solid color-mix(in srgb, #22c55e 42%, var(--surface-border))'
                                                    : '1px solid var(--surface-border)',
                                                background: isInvited
                                                    ? 'color-mix(in srgb, #22c55e 15%, var(--surface-strong))'
                                                    : 'var(--surface-strong)',
                                                color: isInvited ? '#16a34a' : 'var(--foreground)',
                                                minHeight: 30,
                                                padding: '0 10px',
                                                fontSize: 11.5,
                                                fontWeight: 700,
                                                opacity: isInviting ? 0.6 : 1,
                                            }}
                                        >
                                            {isInviting ? 'Đang mời...' : isInvited ? 'Đã mời' : 'Mời'}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </>
            ) : null}

            {withdrawDialog.isOpen ? (
                <>
                    <div
                        role='presentation'
                        onClick={() => setWithdrawDialog((current) => ({ ...current, isOpen: false }))}
                        style={{
                            position: 'fixed',
                            inset: 0,
                            background: 'rgba(2, 8, 23, 0.5)',
                            zIndex: 60,
                        }}
                    />
                    <div
                        role='dialog'
                        aria-modal='true'
                        style={{
                            position: 'fixed',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            width: 'min(92vw, 400px)',
                            borderRadius: 16,
                            border: '1px solid var(--surface-border)',
                            background: 'var(--surface-strong)',
                            boxShadow: '0 24px 80px rgba(0,0,0,0.35)',
                            zIndex: 61,
                            display: 'grid',
                            gap: 12,
                            padding: 16,
                        }}
                    >
                        <div>
                            <div style={{ fontWeight: 800 }}>Rút tiền từ quỹ</div>
                            <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>{selectedWallet?.name || 'Quỹ chung'}</div>
                        </div>

                        <div style={{ display: 'grid', gap: 6 }}>
                            <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>Ví nhận</div>
                            <CustomSelect
                                value={withdrawDialog.targetWalletId}
                                onChange={(value) => setWithdrawDialog((current) => ({ ...current, targetWalletId: value }))}
                                options={sourceWalletSelectOptions}
                                placeholder='Chọn ví nhận'
                            />
                        </div>

                        <div style={{ display: 'grid', gap: 6 }}>
                            <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>Số tiền rút</div>
                            <input
                                inputMode='numeric'
                                value={withdrawDialog.amount ? new Intl.NumberFormat('vi-VN').format(Number(withdrawDialog.amount.replace(/\D/g, '') || 0)) : ''}
                                onChange={(event) => setWithdrawDialog((current) => ({ ...current, amount: event.target.value.replace(/\D/g, '') }))}
                                placeholder='Nhập số tiền'
                                style={{
                                    width: '100%',
                                    borderRadius: 10,
                                    border: '1px solid var(--surface-border)',
                                    background: 'var(--surface-soft)',
                                    color: 'var(--foreground)',
                                    minHeight: 40,
                                    padding: '0 10px',
                                    fontSize: 13.5,
                                }}
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
                            <button
                                type='button'
                                onClick={() => setWithdrawDialog((current) => ({ ...current, isOpen: false }))}
                                style={{
                                    minHeight: 38,
                                    borderRadius: 10,
                                    border: '1px solid var(--surface-border)',
                                    background: 'var(--surface-soft)',
                                    color: 'var(--foreground)',
                                    fontWeight: 700,
                                }}
                            >
                                Hủy
                            </button>
                            <PrimaryButton onClick={handleWithdrawSharedFund} disabled={isWithdrawing} style={{ justifyContent: 'center' }}>
                                {isWithdrawing ? <LoaderCircle size={15} className='spin' /> : <Download size={15} />}
                                {isWithdrawing ? 'Đang rút...' : 'Xác nhận rút'}
                            </PrimaryButton>
                        </div>
                    </div>
                </>
            ) : null}
        </AppCard>
    );
}
