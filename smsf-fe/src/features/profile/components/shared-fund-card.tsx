'use client';

import { Check, ChevronDown, ChevronUp, Download, GripVertical, LoaderCircle, LogOut, Plus, TrendingDown, TrendingUp, UserPlus, Users2, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
    offSharedFundActivity,
    offSharedFundInviteReceived,
    offSharedFundInviteResolved,
    offSharedFundMembershipUpdated,
    onSharedFundActivity,
    onSharedFundInviteReceived,
    onSharedFundInviteResolved,
    onSharedFundMembershipUpdated,
} from '@/lib/socket-io';
import { useAuth } from '@/providers/auth-provider';
import { formatCurrencyVND } from '@/lib/formatters';
import { getWalletTypeLabel } from '@/lib/wallet-type-label';
import { getWalletLogLabel, isWalletLogCredit } from '@/lib/wallet-log-label';
import { IFriendListItem } from '@/types/messages';
import { ISharedFundInviteItem, ISharedFundMemberItem, ISharedFundContributionItem } from '@/types/shared-fund';
import { IWalletLogItem, transferWalletBalanceRequest } from '@/lib/calendar/api';

export function SharedFundCard() {
    const { user, wallets, refreshWallets, totalWalletBalance, updateWalletActive, updateWalletName, dragReorderWallets } = useAuth();

    const [friends, setFriends] = useState<IFriendListItem[]>([]);
    const [incomingInvites, setIncomingInvites] = useState<ISharedFundInviteItem[]>([]);
    const [outgoingInvites, setOutgoingInvites] = useState<ISharedFundInviteItem[]>([]);
    const [members, setMembers] = useState<ISharedFundMemberItem[]>([]);

    const [fundName, setFundName] = useState('');
    const [fundBalance, setFundBalance] = useState('');
    const [sourceWalletId, setSourceWalletId] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [renameFundValue, setRenameFundValue] = useState('');
    const [isRenamingFund, setIsRenamingFund] = useState(false);

    const [selectedWalletId, setSelectedWalletId] = useState('');
    const [isLoadingMembers, setIsLoadingMembers] = useState(false);
    const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
    const [inviteSearchKeyword, setInviteSearchKeyword] = useState('');
    const [invitingFriendId, setInvitingFriendId] = useState('');
    const [togglingFundId, setTogglingFundId] = useState<string | null>(null);
    const [draggingFundIndex, setDraggingFundIndex] = useState<number | null>(null);
    const [dragOverFundIndex, setDragOverFundIndex] = useState<number | null>(null);
    const suppressFundExpandRef = useRef(false);

    const [contributionStats, setContributionStats] = useState<ISharedFundContributionItem[]>([]);
    const [isLoadingStats, setIsLoadingStats] = useState(false);
    const [recentHistory, setRecentHistory] = useState<IWalletLogItem[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [historyLoadedPage, setHistoryLoadedPage] = useState(1);
    const [historyHasMore, setHistoryHasMore] = useState(false);
    const [isLoadingMoreHistory, setIsLoadingMoreHistory] = useState(false);
    const [isRefreshingOverview, setIsRefreshingOverview] = useState(false);
    const [isMounted, setIsMounted] = useState(false);
    const [withdrawDialog, setWithdrawDialog] = useState<{ isOpen: boolean; targetWalletId: string; amount: string }>({ isOpen: false, targetWalletId: '', amount: '' });
    const [isWithdrawing, setIsWithdrawing] = useState(false);
    const [depositSourceWalletId, setDepositSourceWalletId] = useState('');
    const [depositAmount, setDepositAmount] = useState('');
    const [depositDescription, setDepositDescription] = useState('');
    const [isDepositing, setIsDepositing] = useState(false);
    const [nextOwnerId, setNextOwnerId] = useState('');
    const [isStatsOpen, setIsStatsOpen] = useState(false);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [isLeaveConfirmOpen, setIsLeaveConfirmOpen] = useState(false);

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

    const contributionSummary = useMemo(() => {
        const totalIncome = contributionStats.reduce((sum, item) => sum + item.incomeTotal, 0);
        const totalExpense = contributionStats.reduce((sum, item) => sum + item.expenseTotal, 0);
        return {
            totalIncome,
            totalExpense,
            totalFlow: totalIncome + totalExpense,
        };
    }, [contributionStats]);

    const actorDisplayNameByUsername = useMemo(() => {
        const map: Record<string, string> = {};

        for (const member of members) {
            const key = member.username.trim().toLowerCase();
            if (key && member.displayName) {
                map[key] = member.displayName;
            }
        }

        for (const friend of friends) {
            const key = friend.friendUsername.trim().toLowerCase();
            if (key && friend.friendName) {
                map[key] = friend.friendName;
            }
        }

        const selfUsername = user?.username?.trim().toLowerCase() || '';
        if (selfUsername && user?.displayName) {
            map[selfUsername] = user.displayName;
        }

        return map;
    }, [friends, members, user?.displayName, user?.username]);

    const loadData = useCallback(async () => {
        setIsRefreshingOverview(true);
        try {
            const [friendItems, incomingItems, outgoingItems] = await Promise.all([
                getFriendsRequest(),
                getIncomingSharedFundInvitesRequest(),
                getOutgoingSharedFundInvitesRequest(),
            ]);

            setFriends(friendItems);
            setIncomingInvites(incomingItems);
            setOutgoingInvites(outgoingItems);
        } finally {
            setIsRefreshingOverview(false);
        }
    }, []);

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
            setHistoryLoadedPage(1);
            setHistoryHasMore(false);
            return;
        }

        setIsLoadingHistory(true);
        try {
            const result = await getSharedFundRecentHistoryRequest(walletId, 5, 1);
            setRecentHistory(result.items);
            setHistoryLoadedPage(1);
            setHistoryHasMore(result.hasMore);
        } catch {
            setRecentHistory([]);
            setHistoryHasMore(false);
        } finally {
            setIsLoadingHistory(false);
        }
    }, []);

    const loadMoreHistory = useCallback(async () => {
        if (!selectedWalletId || !historyHasMore || isLoadingMoreHistory) return;

        const nextPage = historyLoadedPage + 1;
        setIsLoadingMoreHistory(true);
        try {
            const result = await getSharedFundRecentHistoryRequest(selectedWalletId, 5, nextPage);
            setRecentHistory((prev) => [...prev, ...result.items]);
            setHistoryLoadedPage(nextPage);
            setHistoryHasMore(result.hasMore);
        } catch {
            // silent
        } finally {
            setIsLoadingMoreHistory(false);
        }
    }, [selectedWalletId, historyHasMore, isLoadingMoreHistory, historyLoadedPage]);

    useEffect(() => {
        void loadData();
    }, [loadData]);

    useEffect(() => {
        const sharedWalletIds = sharedWallets.map((wallet) => wallet.id);

        setSelectedWalletId((current) => {
            if (!current) {
                return '';
            }

            if (sharedWalletIds.includes(current)) {
                return current;
            }

            return '';
        });
    }, [sharedWallets]);

    useEffect(() => {
        setRenameFundValue(selectedWallet?.name || '');
    }, [selectedWallet?.name]);

    useEffect(() => {
        setIsStatsOpen(false);
        setIsHistoryOpen(false);
    }, [selectedWalletId]);

    useEffect(() => {
        setSourceWalletId((current) => {
            if (current && fundingWalletOptions.some((wallet) => wallet.id === current)) {
                return current;
            }

            return fundingWalletOptions[0]?.id || '';
        });
    }, [fundingWalletOptions]);

    useEffect(() => {
        setDepositSourceWalletId((current) => {
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
        setIsMounted(true);
    }, []);

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

    useEffect(() => {
        const activityHandler = () => {
            if (selectedWalletId) {
                void loadContributionStats(selectedWalletId);
                void loadRecentHistory(selectedWalletId);
            }
        };

        onSharedFundActivity(activityHandler);
        return () => {
            offSharedFundActivity(activityHandler);
        };
    }, [selectedWalletId, loadContributionStats, loadRecentHistory]);

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
            setIsLeaveConfirmOpen(false);
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

    const handleDepositSharedFund = useCallback(async () => {
        const amount = Number(depositAmount.replace(/\D/g, '') || 0);

        if (!selectedWalletId || !depositSourceWalletId || amount <= 0) {
            setErrorMessage('Vui lòng chọn ví nguồn và nhập số tiền hợp lệ để nạp quỹ.');
            return;
        }

        setIsDepositing(true);
        setErrorMessage('');
        setSuccessMessage('');

        try {
            await transferWalletBalanceRequest({
                fromWalletId: depositSourceWalletId,
                toWalletId: selectedWalletId,
                amount,
                description: depositDescription.trim() || `Nạp tiền vào quỹ ${selectedWallet?.name || ''}`.trim(),
            });
            await refreshWallets();
            await loadRecentHistory(selectedWalletId);
            setDepositAmount('');
            setDepositDescription('');
            setSuccessMessage('Đã nạp tiền vào quỹ.');
        } catch (error) {
            const responseMessage =
                (error as { response?: { data?: { message?: string } } })?.response?.data?.message
                || 'Không thể nạp tiền vào quỹ.';
            setErrorMessage(responseMessage);
        } finally {
            setIsDepositing(false);
        }
    }, [depositAmount, depositDescription, depositSourceWalletId, loadRecentHistory, refreshWallets, selectedWallet?.name, selectedWalletId]);

    const handleRenameFund = useCallback(async () => {
        const nextName = renameFundValue.trim();

        if (!selectedWalletId) {
            setErrorMessage('Vui lòng chọn quỹ cần đổi tên.');
            return;
        }

        if (selectedMembership?.role !== 'owner') {
            setErrorMessage('Chỉ chủ quỹ mới có thể đổi tên quỹ.');
            return;
        }

        if (!nextName) {
            setErrorMessage('Vui lòng nhập tên quỹ mới.');
            return;
        }

        if (nextName.length > 40) {
            setErrorMessage('Tên quỹ tối đa 40 ký tự.');
            return;
        }

        setIsRenamingFund(true);
        setErrorMessage('');
        setSuccessMessage('');

        try {
            await updateWalletName(selectedWalletId, nextName);
            await loadData();
            setSuccessMessage('Đã cập nhật tên quỹ.');
        } catch (error) {
            const responseMessage =
                (error as { response?: { data?: { message?: string } } })?.response?.data?.message
                || 'Không thể cập nhật tên quỹ.';
            setErrorMessage(responseMessage);
        } finally {
            setIsRenamingFund(false);
        }
    }, [loadData, renameFundValue, selectedMembership?.role, selectedWalletId, updateWalletName]);

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

    const handleToggleFundActive = useCallback(async (walletId: string, current: boolean) => {
        setTogglingFundId(walletId);
        setErrorMessage('');
        setSuccessMessage('');

        try {
            await updateWalletActive(walletId, !current);
            setSuccessMessage(!current ? 'Đã bật sử dụng quỹ trong giao dịch.' : 'Đã tắt sử dụng quỹ trong giao dịch.');
        } catch (error) {
            const responseMessage =
                (error as { response?: { data?: { message?: string } } })?.response?.data?.message
                || 'Không thể cập nhật trạng thái quỹ.';
            setErrorMessage(responseMessage);
        } finally {
            setTogglingFundId(null);
        }
    }, [updateWalletActive]);

    const handleFundDragStart = useCallback((walletIndex: number) => {
        suppressFundExpandRef.current = true;
        setDraggingFundIndex(walletIndex);
    }, []);

    const handleFundDragOver = useCallback((walletIndex: number) => {
        setDragOverFundIndex(walletIndex);
    }, []);

    const handleFundDrop = useCallback(async (targetIndex: number) => {
        if (draggingFundIndex === null || draggingFundIndex === targetIndex) {
            setDraggingFundIndex(null);
            setDragOverFundIndex(null);
            return;
        }

        await dragReorderWallets(
            draggingFundIndex,
            targetIndex,
            sharedWallets.map((wallet) => wallet.id),
        );
        setDraggingFundIndex(null);
        setDragOverFundIndex(null);
    }, [dragReorderWallets, draggingFundIndex, sharedWallets]);

    const handleFundDragEnd = useCallback(() => {
        suppressFundExpandRef.current = true;
        setDraggingFundIndex(null);
        setDragOverFundIndex(null);
    }, []);

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
                </div>

                {sharedWallets.length === 0 ? (
                    <div style={{ color: 'var(--muted)', fontSize: 12.5 }}>Bạn chưa có quỹ chung nào.</div>
                ) : (
                    <div style={{ display: 'grid', gap: 8 }}>
                        {sharedWallets.map((wallet, walletIndex) => {
                            const isSelected = wallet.id === selectedWalletId;
                            const isDragOver = dragOverFundIndex === walletIndex;
                            const isDragging = draggingFundIndex === walletIndex;
                            const pendingInvites = outgoingInvites.filter((invite) => invite.walletId === wallet.id && invite.status === 'pending');
                            return (
                                <div
                                    key={wallet.id}
                                    draggable
                                    onDragStart={() => handleFundDragStart(walletIndex)}
                                    onDragOver={(event) => {
                                        event.preventDefault();
                                        handleFundDragOver(walletIndex);
                                    }}
                                    onDrop={(event) => {
                                        event.preventDefault();
                                        void handleFundDrop(walletIndex);
                                    }}
                                    onDragEnd={handleFundDragEnd}
                                    style={{ borderRadius: 12, border: isDragOver ? '1px dashed var(--accent)' : (isSelected ? '1px solid var(--chip-border)' : '1px solid var(--surface-border)'), background: 'var(--surface-strong)', overflow: 'hidden', boxShadow: isSelected ? '0 10px 24px rgba(15, 23, 42, 0.08)' : 'none', opacity: wallet.isActive === false ? 0.55 : 1, transform: isDragging ? 'scale(0.99)' : 'translateY(0)', transition: 'border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease' }}
                                >
                                    <div
                                        role='button'
                                        tabIndex={0}
                                        onClick={() => {
                                            if (suppressFundExpandRef.current) {
                                                suppressFundExpandRef.current = false;
                                                return;
                                            }

                                            setSelectedWalletId((current) => current === wallet.id ? '' : wallet.id);
                                        }}
                                        onKeyDown={(event) => {
                                            if (event.key === 'Enter' || event.key === ' ') {
                                                event.preventDefault();
                                                setSelectedWalletId((current) => current === wallet.id ? '' : wallet.id);
                                            }
                                        }}
                                        style={{ width: '100%', padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, background: 'transparent', color: 'var(--foreground)', textAlign: 'left', cursor: 'pointer' }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <span
                                                title='Kéo để sắp xếp'
                                                onPointerDown={(event) => event.stopPropagation()}
                                                onClick={(event) => event.stopPropagation()}
                                                style={{ width: 24, height: 24, borderRadius: 6, border: '1px solid var(--surface-border)', color: 'var(--muted)', display: 'grid', placeItems: 'center', cursor: 'grab', flexShrink: 0 }}
                                            >
                                                <GripVertical size={13} />
                                            </span>
                                            <div>
                                                <div style={{ fontWeight: 700, fontSize: 13.5 }}>{wallet.name}</div>
                                                <div style={{ fontSize: 11.5, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    {getWalletTypeLabel(wallet.type)}
                                                    {wallet.isActive === false ? <span style={{ color: '#ef4444', fontWeight: 700, textTransform: 'none' }}>· Không dùng</span> : null}
                                                </div>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <div style={{ fontWeight: 800, fontSize: 13.5 }}>{formatCurrencyVND(wallet.balance)}</div>
                                            <button
                                                type='button'
                                                disabled={togglingFundId === wallet.id}
                                                onPointerDown={(event) => event.stopPropagation()}
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    void handleToggleFundActive(wallet.id, wallet.isActive !== false);
                                                }}
                                                title={wallet.isActive === false ? 'Bật sử dụng quỹ' : 'Tắt sử dụng quỹ'}
                                                style={{ width: 44, height: 26, borderRadius: 999, border: wallet.isActive === false ? '1px solid var(--surface-border)' : '1px solid color-mix(in srgb, var(--theme-gradient-start) 65%, var(--surface-border))', background: wallet.isActive === false ? 'var(--surface-strong)' : 'color-mix(in srgb, var(--theme-gradient-start) 32%, var(--surface-soft))', padding: 2, display: 'flex', alignItems: 'center', justifyContent: wallet.isActive === false ? 'flex-start' : 'flex-end', transition: 'all 180ms ease', opacity: togglingFundId === wallet.id ? 0.6 : 1 }}
                                            >
                                                <span style={{ width: 20, height: 20, borderRadius: 999, background: wallet.isActive === false ? 'var(--muted)' : 'var(--theme-gradient-start)', boxShadow: wallet.isActive === false ? 'none' : '0 0 0 2px color-mix(in srgb, var(--theme-gradient-start) 18%, transparent)', transition: 'all 180ms ease' }} />
                                            </button>
                                            {isSelected ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                        </div>
                                    </div>

                                    {isSelected ? (
                                        <div style={{ borderTop: '1px solid var(--surface-border)', padding: 12, display: 'grid', gap: 12 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                                                <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>Điều khiển quỹ</div>
                                                <button type='button' onClick={handleOpenInviteModal} style={{ borderRadius: 10, border: '1px solid var(--surface-border)', background: 'var(--surface-soft)', color: 'var(--foreground)', minHeight: 34, padding: '0 10px', display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700 }}>
                                                    <UserPlus size={14} /> Mời bạn
                                                </button>
                                            </div>

                                            {selectedMembership?.role === 'owner' ? (
                                                <div style={{ borderRadius: 10, border: '1px solid var(--surface-border)', background: 'var(--surface-soft)', padding: 10, display: 'grid', gap: 8 }}>
                                                    <div style={{ fontSize: 11.5, color: 'var(--muted)', fontWeight: 700 }}>Đổi tên quỹ</div>
                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
                                                        <input value={renameFundValue} onChange={(event) => setRenameFundValue(event.target.value)} placeholder='Tên quỹ mới' style={{ width: '100%', borderRadius: 10, border: '1px solid var(--surface-border)', background: 'var(--surface-strong)', color: 'var(--foreground)', minHeight: 38, padding: '0 10px', fontSize: 13 }} />
                                                        <PrimaryButton onClick={() => void handleRenameFund()} disabled={isRenamingFund} style={{ justifyContent: 'center', minWidth: 120 }}>
                                                            {isRenamingFund ? 'Đang đổi...' : 'Đổi tên'}
                                                        </PrimaryButton>
                                                    </div>
                                                </div>
                                            ) : null}

                                            <div style={{ borderRadius: 10, border: '1px solid var(--surface-border)', background: 'var(--surface-soft)', padding: 10, display: 'grid', gap: 8 }}>
                                                <div style={{ fontSize: 11.5, color: 'var(--muted)', fontWeight: 700 }}>Nạp tiền vào quỹ</div>
                                                <CustomSelect
                                                    value={depositSourceWalletId}
                                                    onChange={setDepositSourceWalletId}
                                                    options={sourceWalletSelectOptions}
                                                    placeholder='Chọn ví nguồn'
                                                />
                                                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.2fr)', gap: 8 }}>
                                                    <input
                                                        inputMode='numeric'
                                                        value={depositAmount ? new Intl.NumberFormat('vi-VN').format(Number(depositAmount.replace(/\D/g, '') || 0)) : ''}
                                                        onChange={(event) => setDepositAmount(event.target.value.replace(/\D/g, ''))}
                                                        placeholder='Số tiền nạp'
                                                        style={{ width: '100%', borderRadius: 10, border: '1px solid var(--surface-border)', background: 'var(--surface-strong)', color: 'var(--foreground)', minHeight: 38, padding: '0 10px', fontSize: 13 }}
                                                    />
                                                    <input
                                                        value={depositDescription}
                                                        onChange={(event) => setDepositDescription(event.target.value)}
                                                        placeholder='Ghi chú nạp tiền'
                                                        style={{ width: '100%', borderRadius: 10, border: '1px solid var(--surface-border)', background: 'var(--surface-strong)', color: 'var(--foreground)', minHeight: 38, padding: '0 10px', fontSize: 13 }}
                                                    />
                                                </div>
                                                <PrimaryButton onClick={() => void handleDepositSharedFund()} disabled={isDepositing || fundingWalletOptions.length === 0} style={{ justifyContent: 'center' }}>
                                                    {isDepositing ? 'Đang nạp...' : 'Nạp vào quỹ'}
                                                </PrimaryButton>
                                                {fundingWalletOptions.length === 0 ? <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>Bạn cần ít nhất một ví cá nhân đang hoạt động để nạp tiền vào quỹ.</div> : null}
                                            </div>

                                            {selectedMembership?.role === 'owner' ? (
                                                <div style={{ display: 'grid', gap: 8 }}>
                                                    <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>Chuyển quyền chủ quỹ trước khi rời quỹ</div>
                                                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 8 }}>
                                                        <CustomSelect value={nextOwnerId} onChange={setNextOwnerId} options={transferOwnerOptions} placeholder='Chọn thành viên nhận quyền' />
                                                        <button type='button' onClick={() => void handleTransferOwnership()} disabled={!nextOwnerId || Boolean(actionLoadingMap[`transfer-${wallet.id}`])} style={{ minHeight: 38, borderRadius: 10, border: '1px solid color-mix(in srgb, #16a34a 35%, var(--surface-border))', background: 'color-mix(in srgb, #16a34a 10%, var(--surface-strong))', color: '#15803d', padding: '0 12px', fontWeight: 800, opacity: !nextOwnerId ? 0.55 : 1 }}>
                                                            {actionLoadingMap[`transfer-${wallet.id}`] ? 'Đang chuyển...' : 'Chuyển quyền'}
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : null}

                                            <div style={{ borderRadius: 10, border: '1px solid var(--surface-border)', background: 'var(--surface-soft)', padding: 10, display: 'grid', gap: 8, minHeight: 180 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                                                    <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>Thành viên quỹ</div>
                                                    <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>{members.length} thành viên</span>
                                                </div>
                                                {members.length === 0 ? <div style={{ color: 'var(--muted)', fontSize: 12.5 }}>Quỹ này chưa có thành viên nào.</div> : (
                                                    <div style={{ display: 'grid', gap: 8, maxHeight: 230, overflowY: 'auto', opacity: isLoadingMembers ? 0.55 : 1, transform: isLoadingMembers ? 'translateY(3px)' : 'translateY(0)', transition: 'opacity 180ms ease, transform 180ms ease' }}>
                                                        {members.map((member) => (
                                                            <div key={member.userId} style={{ borderRadius: 10, border: '1px solid var(--surface-border)', background: 'var(--surface-strong)', padding: '8px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                                                                    <UserAvatar src={member.avatarUrl || undefined} alt={member.displayName} size={30} />
                                                                    <div style={{ minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{member.displayName}</div><div style={{ fontSize: 11.5, color: 'var(--muted)' }}>@{member.username}</div></div>
                                                                </div>
                                                                <div style={{ textAlign: 'right', flexShrink: 0 }}><div style={{ fontSize: 11.5, fontWeight: 700, color: member.role === 'owner' ? '#16a34a' : 'var(--muted)' }}>{member.role === 'owner' ? 'Chủ quỹ' : 'Thành viên'}</div><div style={{ fontSize: 10.5, color: 'var(--muted)' }}>{formatInviteDate(member.joinedAt)}</div></div>
                                                            </div>
                                                        ))}
                                                        {pendingInvites.map((invite) => (
                                                            <div key={invite.inviteId} style={{ borderRadius: 10, border: '1px solid color-mix(in srgb, var(--surface-border) 70%, transparent)', background: 'var(--surface-strong)', padding: '8px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, opacity: 0.75 }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                                                                    <UserAvatar src={invite.receiverAvatarUrl || undefined} alt={invite.receiverName} size={30} />
                                                                    <div style={{ minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{invite.receiverName}</div><div style={{ fontSize: 11.5, color: 'var(--muted)' }}>@{invite.receiverUsername}</div></div>
                                                                </div>
                                                                <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--muted)', flexShrink: 0 }}>Đã mời</div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                                {isLoadingMembers ? <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--muted)', fontSize: 12 }}><LoaderCircle size={12} className='spin' /> Đang cập nhật thành viên...</div> : null}
                                            </div>

                                            <div style={{ borderRadius: 10, border: '1px solid var(--surface-border)', background: 'var(--surface-soft)', overflow: 'hidden', opacity: isRefreshingOverview ? 0.86 : 1, transform: isRefreshingOverview ? 'translateY(2px)' : 'translateY(0)', transition: 'opacity 220ms ease, transform 220ms ease' }}>
                                                <button type='button' onClick={() => setIsStatsOpen((current) => !current)} style={{ width: '100%', padding: '10px 12px', border: 'none', background: 'transparent', color: 'var(--foreground)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                                                    <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>Thống kê nhập và chi theo người</span>
                                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--muted)', fontSize: 11.5 }}>{contributionStats.length} thành viên {isStatsOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</span>
                                                </button>
                                                {isStatsOpen ? (
                                                    <div style={{ borderTop: '1px solid var(--surface-border)', padding: 10, display: 'grid', gap: 8 }}>
                                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
                                                            <div style={{ borderRadius: 10, border: '1px solid color-mix(in srgb, #16a34a 25%, var(--surface-border))', background: 'color-mix(in srgb, #16a34a 8%, var(--surface-base))', padding: '8px 10px' }}><div style={{ fontSize: 10.5, color: '#15803d', fontWeight: 800 }}>Tổng nhập</div><div style={{ fontSize: 12.5, fontWeight: 800, marginTop: 2 }}>{formatCurrencyVND(contributionSummary.totalIncome)}</div></div>
                                                            <div style={{ borderRadius: 10, border: '1px solid color-mix(in srgb, #ef4444 25%, var(--surface-border))', background: 'color-mix(in srgb, #ef4444 7%, var(--surface-base))', padding: '8px 10px' }}><div style={{ fontSize: 10.5, color: '#dc2626', fontWeight: 800 }}>Tổng chi</div><div style={{ fontSize: 12.5, fontWeight: 800, marginTop: 2 }}>{formatCurrencyVND(contributionSummary.totalExpense)}</div></div>
                                                            <div style={{ borderRadius: 10, border: '1px solid color-mix(in srgb, var(--theme-gradient-start) 22%, var(--surface-border))', background: 'color-mix(in srgb, var(--theme-gradient-start) 8%, var(--surface-base))', padding: '8px 10px' }}><div style={{ fontSize: 10.5, color: 'var(--muted)', fontWeight: 800 }}>Tổng luân chuyển</div><div style={{ fontSize: 12.5, fontWeight: 800, marginTop: 2 }}>{formatCurrencyVND(contributionSummary.totalFlow)}</div></div>
                                                        </div>
                                                        {contributionStats.length === 0 && !isLoadingStats ? <div style={{ color: 'var(--muted)', fontSize: 12.5 }}>Chưa có giao dịch nào để thống kê.</div> : (
                                                            <div style={{ display: 'grid', gap: 8, opacity: isLoadingStats ? 0.72 : 1, transition: 'opacity 160ms ease' }}>
                                                                {contributionStats.map((item) => (
                                                                    <div key={item.userId} style={{ borderRadius: 12, border: '1px solid var(--surface-border)', background: 'var(--surface-strong)', padding: '10px 12px', display: 'grid', gap: 8 }}>
                                                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}><div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}><UserAvatar src={item.avatarUrl || undefined} alt={item.displayName} size={30} /><div style={{ minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.displayName}</div><div style={{ fontSize: 11.5, color: 'var(--muted)' }}>@{item.username}</div></div></div><div style={{ fontSize: 12, fontWeight: 800, color: item.net >= 0 ? '#16a34a' : '#dc2626' }}>{item.net >= 0 ? '+' : ''}{formatCurrencyVND(item.net)}</div></div>
                                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}><div style={{ borderRadius: 999, border: '1px solid color-mix(in srgb, #16a34a 30%, var(--surface-border))', background: 'color-mix(in srgb, #16a34a 10%, var(--surface-base))', padding: '5px 10px', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 800 }}><TrendingUp size={13} color='#15803d' /> Nhập {formatCurrencyVND(item.incomeTotal)}</div><div style={{ borderRadius: 999, border: '1px solid color-mix(in srgb, #ef4444 30%, var(--surface-border))', background: 'color-mix(in srgb, #ef4444 8%, var(--surface-base))', padding: '5px 10px', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 800 }}><TrendingDown size={13} color='#dc2626' /> Chi {formatCurrencyVND(item.expenseTotal)}</div><div style={{ borderRadius: 999, border: '1px solid color-mix(in srgb, var(--theme-gradient-start) 26%, var(--surface-border))', background: 'color-mix(in srgb, var(--theme-gradient-start) 8%, var(--surface-base))', padding: '5px 10px', fontSize: 11.5, fontWeight: 800, color: 'var(--muted)' }}>Tỷ trọng {contributionSummary.totalFlow > 0 ? `${Math.round(((item.incomeTotal + item.expenseTotal) * 100) / contributionSummary.totalFlow)}%` : '0%'}</div></div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                        {isLoadingStats ? <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--muted)', fontSize: 11.5 }}><LoaderCircle size={12} className='spin' /> Đang cập nhật thống kê thành viên...</div> : null}
                                                    </div>
                                                ) : null}
                                            </div>

                                            <div style={{ borderRadius: 10, border: '1px solid var(--surface-border)', background: 'var(--surface-soft)', overflow: 'hidden', opacity: isRefreshingOverview ? 0.86 : 1, transform: isRefreshingOverview ? 'translateY(2px)' : 'translateY(0)', transition: 'opacity 220ms ease, transform 220ms ease' }}>
                                                <button type='button' onClick={() => setIsHistoryOpen((current) => !current)} style={{ width: '100%', padding: '10px 12px', border: 'none', background: 'transparent', color: 'var(--foreground)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                                                    <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>Lịch sử quỹ gần nhất</span>
                                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--muted)', fontSize: 11.5 }}>{wallet.name} {isHistoryOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</span>
                                                </button>
                                                {isHistoryOpen ? (
                                                    <div style={{ borderTop: '1px solid var(--surface-border)', padding: 10, display: 'grid', gap: 8 }}>
                                                        {recentHistory.length === 0 && !isLoadingHistory ? <div style={{ color: 'var(--muted)', fontSize: 12.5 }}>Quỹ này chưa có lịch sử biến động.</div> : (
                                                            <div style={{ display: 'grid', gap: 6, opacity: isLoadingHistory ? 0.72 : 1, transition: 'opacity 160ms ease' }}>
                                                                {recentHistory.map((log) => {
                                                                    const isCredit = isWalletLogCredit(log.action);
                                                                    const normalizedActorUsername = log.actorUsername?.trim().toLowerCase() || '';
                                                                    const mappedActorDisplayName = normalizedActorUsername ? actorDisplayNameByUsername[normalizedActorUsername] : '';
                                                                    const rawActorDisplayName = log.actorDisplayName?.trim() || '';
                                                                    const actorDisplayName = mappedActorDisplayName || (rawActorDisplayName && rawActorDisplayName.toLowerCase() !== normalizedActorUsername ? rawActorDisplayName : '') || (log.actorUsername?.trim() || '') || 'Không rõ';
                                                                    return <div key={log.id} style={{ borderRadius: 10, border: '1px solid var(--surface-border)', background: 'var(--surface-strong)', padding: '8px 10px', display: 'grid', gap: 4 }}><div style={{ display: 'flex', alignItems: 'center', gap: 7 }}><span style={{ borderRadius: 999, border: '1px solid var(--surface-border)', background: isCredit ? 'color-mix(in srgb, #16a34a 10%, var(--surface-base))' : 'color-mix(in srgb, #f97316 10%, var(--surface-base))', padding: '2px 7px', fontSize: 11, fontWeight: 800, color: isCredit ? '#16a34a' : '#f97316', flexShrink: 0 }}>{getWalletLogLabel(log.action)}</span><span style={{ fontSize: 13.5, fontWeight: 800, color: isCredit ? '#16a34a' : '#f97316', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{isCredit ? '+' : '-'}{formatCurrencyVND(log.amount)}</span><span style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>{formatInviteDate(log.createdAt)}</span></div><div style={{ fontSize: 11.5, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4 }}><span>{formatCurrencyVND(log.balanceBefore)}</span><span>→</span><span style={{ color: 'var(--foreground)', fontWeight: 700 }}>{formatCurrencyVND(log.balanceAfter)}</span></div>{(log.description || actorDisplayName) ? <div style={{ fontSize: 11.5, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.description ? <span style={{ marginRight: 6 }}>{log.description}</span> : null}{actorDisplayName ? <span>bởi <span style={{ color: 'var(--foreground)', fontWeight: 700 }}>{actorDisplayName}</span>{log.actorUsername && actorDisplayName.toLowerCase() !== normalizedActorUsername ? ` @${log.actorUsername}` : ''}</span> : null}</div> : null}</div>;
                                                                })}
                                                                {historyHasMore ? <button type='button' onClick={() => void loadMoreHistory()} disabled={isLoadingMoreHistory} style={{ borderRadius: 8, border: '1px solid var(--surface-border)', background: 'transparent', color: 'var(--muted)', padding: '6px 12px', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>{isLoadingMoreHistory ? <LoaderCircle size={12} className='spin' /> : null}{isLoadingMoreHistory ? 'Đang tải...' : 'Hiển thị thêm'}</button> : null}
                                                            </div>
                                                        )}
                                                        {isLoadingHistory ? <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--muted)', fontSize: 11.5 }}><LoaderCircle size={12} className='spin' /> Đang tải lịch sử quỹ...</div> : null}
                                                    </div>
                                                ) : null}
                                            </div>

                                            {fundingWalletOptions.length === 0 ? <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>Bạn cần ít nhất một ví cá nhân đang hoạt động để nhận tiền rút từ quỹ.</div> : null}

                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginTop: 4 }}>
                                                <button type='button' onClick={() => setWithdrawDialog((current) => ({ ...current, isOpen: true }))} disabled={fundingWalletOptions.length === 0} style={{ minHeight: 38, borderRadius: 10, border: '1px solid color-mix(in srgb, #2563eb 35%, var(--surface-border))', background: 'color-mix(in srgb, #2563eb 12%, var(--surface-strong))', color: '#1d4ed8', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontWeight: 800, opacity: fundingWalletOptions.length === 0 ? 0.55 : 1 }}>
                                                    <Download size={14} /> Rút về ví
                                                </button>
                                                <button type='button' onClick={() => setIsLeaveConfirmOpen(true)} disabled={selectedMembership?.role === 'owner' || Boolean(actionLoadingMap[`leave-${wallet.id}`])} style={{ minHeight: 38, borderRadius: 10, border: '1px solid color-mix(in srgb, #ef4444 35%, var(--surface-border))', background: 'color-mix(in srgb, #ef4444 10%, var(--surface-strong))', color: '#dc2626', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontWeight: 800, opacity: selectedMembership?.role === 'owner' ? 0.55 : 1 }}>
                                                    <LogOut size={14} /> {actionLoadingMap[`leave-${wallet.id}`] ? 'Đang rời...' : 'Rời quỹ'}
                                                </button>
                                            </div>
                                        </div>
                                    ) : null}
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

            {errorMessage ? <div style={{ color: '#ef4444', fontSize: 12 }}>{errorMessage}</div> : null}
            {successMessage ? <div style={{ color: '#16a34a', fontSize: 12 }}>{successMessage}</div> : null}

            {user?.id ? null : <div style={{ fontSize: 12, color: 'var(--muted)' }}>Đăng nhập để dùng quỹ chung.</div>}

            {isMounted && isInviteModalOpen ? createPortal(
                <>
                    <div
                        role='presentation'
                        onClick={closeInviteModal}
                        style={{
                            position: 'fixed',
                            inset: 0,
                            background: 'rgba(2, 8, 23, 0.5)',
                            zIndex: 9000,
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
                            zIndex: 9001,
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
                </>,
                document.body,
            ) : null}

            {isLeaveConfirmOpen ? (
                <>
                    <div
                        role='presentation'
                        onClick={() => setIsLeaveConfirmOpen(false)}
                        style={{
                            position: 'fixed',
                            inset: 0,
                            background: 'rgba(2, 8, 23, 0.5)',
                            zIndex: 62,
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
                            zIndex: 63,
                            display: 'grid',
                            gap: 12,
                            padding: 16,
                        }}
                    >
                        <div>
                            <div style={{ fontWeight: 800 }}>Xác nhận rời quỹ</div>
                            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                                Bạn có chắc muốn rời quỹ {selectedWallet?.name || 'này'} không?
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
                            <button
                                type='button'
                                onClick={() => setIsLeaveConfirmOpen(false)}
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
                            <button
                                type='button'
                                onClick={() => void handleLeaveSharedFund()}
                                disabled={Boolean(selectedWalletId && actionLoadingMap[`leave-${selectedWalletId}`])}
                                style={{
                                    minHeight: 38,
                                    borderRadius: 10,
                                    border: '1px solid color-mix(in srgb, #ef4444 35%, var(--surface-border))',
                                    background: 'color-mix(in srgb, #ef4444 10%, var(--surface-strong))',
                                    color: '#dc2626',
                                    fontWeight: 800,
                                    opacity: selectedWalletId && actionLoadingMap[`leave-${selectedWalletId}`] ? 0.6 : 1,
                                }}
                            >
                                {selectedWalletId && actionLoadingMap[`leave-${selectedWalletId}`] ? 'Đang rời...' : 'Xác nhận rời quỹ'}
                            </button>
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
