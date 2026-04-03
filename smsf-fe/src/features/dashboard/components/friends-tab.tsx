'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Check, Loader2, Search, Send, UserPlus, X } from 'lucide-react';
import { AppCard } from '@/components/common/app-card';
import { UserAvatar } from '@/components/common/user-avatar';
import {
	acceptFriendRequestRequest,
	getConversationsRequest,
	getFriendsRequest,
	getMessagesRequest,
	getPendingFriendRequestsRequest,
	rejectFriendRequestRequest,
	searchFriendsRequest,
	sendFriendRequestRequest,
	sendMessageRequest,
} from '@/lib/messages/api';
import {
	markMessagesAsRead,
	offFriendRequestReceived,
	offFriendRequestResolved,
	offFriendshipUpdated,
	offMessageReceived,
	offMessageSent,
	offMessagesRead,
	offUserTyping,
	onFriendRequestReceived,
	onFriendRequestResolved,
	onFriendshipUpdated,
	onMessageReceived,
	onMessageSent,
	onMessagesRead,
	onUserTyping,
} from '@/lib/socket-io';
import { useSocket } from '@/lib/socket-context';
import { useAuth } from '@/providers/auth-provider';
import { IConversation, IDirectMessage, IFriend, IFriendListItem, IFriendRequest } from '@/types/messages';

const formatDateTime = (value: number): string => {
	if (!value) return '';

	const date = new Date(value);
	return new Intl.DateTimeFormat('vi-VN', {
		hour: '2-digit',
		minute: '2-digit',
		day: '2-digit',
		month: '2-digit',
	}).format(date);
};

const truncateText = (text: string, maxLength = 28): string => {
	const cleaned = String(text || '').trim();
	if (cleaned.length <= maxLength) return cleaned;
	return `${cleaned.slice(0, maxLength).trimEnd()}...`;
};

const upsertConversation = (
	previous: IConversation[],
	patch: IConversation,
): IConversation[] => {
	const foundIndex = previous.findIndex((item) => item.friendId === patch.friendId);
	if (foundIndex < 0) {
		return [patch, ...previous].sort((left, right) => right.lastMessageTime - left.lastMessageTime);
	}

	const next = [...previous];
	next[foundIndex] = { ...next[foundIndex], ...patch };
	next.sort((left, right) => right.lastMessageTime - left.lastMessageTime);
	return next;
};

export function FriendsTab() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const { user } = useAuth();
	const { sendMessage, isConnected, markTyping } = useSocket();

	const [searchKeyword, setSearchKeyword] = useState('');
	const [searchResults, setSearchResults] = useState<IFriend[]>([]);
	const [friends, setFriends] = useState<IFriendListItem[]>([]);
	const [pendingRequests, setPendingRequests] = useState<IFriendRequest[]>([]);
	const [conversations, setConversations] = useState<IConversation[]>([]);
	const [selectedFriendId, setSelectedFriendId] = useState('');
	const [messages, setMessages] = useState<IDirectMessage[]>([]);
	const [messageInput, setMessageInput] = useState('');
	const [typingFriendIds, setTypingFriendIds] = useState<Record<string, boolean>>({});
	const [errorMessage, setErrorMessage] = useState('');
	const [isLoadingOverview, setIsLoadingOverview] = useState(false);
	const [isSearching, setIsSearching] = useState(false);
	const [isSendingRequestMap, setIsSendingRequestMap] = useState<Record<string, boolean>>({});
	const [isResolvingRequestMap, setIsResolvingRequestMap] = useState<Record<string, boolean>>({});
	const [isLoadingMessages, setIsLoadingMessages] = useState(false);
	const [isSendingMessage, setIsSendingMessage] = useState(false);
	const [visibleTimestampMessageId, setVisibleTimestampMessageId] = useState('');
	const chatScrollRef = useRef<HTMLDivElement | null>(null);
	const touchHoldTimerRef = useRef<number | null>(null);
	const requestedFriendId = searchParams.get('friendId') || '';

	const selectedFriend = useMemo(() => {
		const fromFriend = friends.find((item) => item.friendId === selectedFriendId);
		if (fromFriend) {
			return {
				id: fromFriend.friendId,
				name: fromFriend.friendName,
				username: fromFriend.friendUsername,
				avatarUrl: fromFriend.friendAvatarUrl,
			};
		}

		const fromConversation = conversations.find((item) => item.friendId === selectedFriendId);
		if (fromConversation) {
			return {
				id: fromConversation.friendId,
				name: fromConversation.friendName,
				username: fromConversation.friendUsername,
				avatarUrl: fromConversation.friendAvatarUrl,
			};
		}

		return null;
	}, [conversations, friends, selectedFriendId]);

	const loadOverview = useCallback(async () => {
		setIsLoadingOverview(true);
		setErrorMessage('');

		const [friendsResult, pendingResult, conversationsResult] = await Promise.allSettled([
			getFriendsRequest(),
			getPendingFriendRequestsRequest(),
			getConversationsRequest(),
		]);

		const friendItems = friendsResult.status === 'fulfilled' ? friendsResult.value : [];
		const pendingItems = pendingResult.status === 'fulfilled' ? pendingResult.value : [];
		const conversationItems = conversationsResult.status === 'fulfilled' ? conversationsResult.value : [];

		setFriends(friendItems);
		setPendingRequests(pendingItems);
		setConversations(conversationItems);

		setSelectedFriendId((current) => {
			if (
				current
				&& (
					friendItems.some((item) => item.friendId === current)
					|| conversationItems.some((item) => item.friendId === current)
				)
			) {
				return current;
			}

			return friendItems[0]?.friendId || conversationItems[0]?.friendId || '';
		});

		if (
			friendsResult.status === 'rejected'
			&& pendingResult.status === 'rejected'
			&& conversationsResult.status === 'rejected'
		) {
			setErrorMessage('Không tải được dữ liệu bạn bè. Thử lại sau.');
		}

		setIsLoadingOverview(false);
	}, []);

	const loadMessages = useCallback(async (friendId: string) => {
		if (!friendId) {
			setMessages([]);
			return;
		}

		setIsLoadingMessages(true);

		try {
			const items = await getMessagesRequest(friendId, 100, 0);
			setMessages(items);
			markMessagesAsRead(friendId);
			setConversations((previous) => {
				const target = previous.find((item) => item.friendId === friendId);
				if (!target) return previous;

				return upsertConversation(previous, {
					...target,
					unreadCount: 0,
				});
			});
		} catch {
			setErrorMessage('Không tải được tin nhắn cuộc trò chuyện này.');
		} finally {
			setIsLoadingMessages(false);
		}
	}, []);

	useEffect(() => {
		void loadOverview();
	}, [loadOverview]);

	useEffect(() => {
		void loadMessages(selectedFriendId);
	}, [loadMessages, selectedFriendId]);

	useEffect(() => {
		if (!requestedFriendId) {
			return;
		}

		setSelectedFriendId(requestedFriendId);
	}, [requestedFriendId]);

	useEffect(() => {
		const viewport = chatScrollRef.current;
		if (!viewport) return;
		viewport.scrollTop = viewport.scrollHeight;
	}, [messages, selectedFriendId, isLoadingMessages]);

	useEffect(() => {
		const handleMessage = (message: IDirectMessage) => {
			const isCurrentConversation =
				message.senderId === selectedFriendId || message.receiverId === selectedFriendId;

			if (isCurrentConversation) {
				setMessages((previous) => {
					if (previous.some((item) => item.id === message.id)) {
						return previous;
					}

					return [...previous, message].sort((left, right) => left.createdAt - right.createdAt);
				});
			}

			const otherUserId = message.senderId === user?.id ? message.receiverId : message.senderId;
			if (!otherUserId) {
				return;
			}

			if (message.senderId !== user?.id && selectedFriendId === otherUserId) {
				markMessagesAsRead(otherUserId);
			}

			const friendMeta = friends.find((item) => item.friendId === otherUserId);
			setConversations((previous) => upsertConversation(previous, {
				friendId: otherUserId,
				friendName: friendMeta?.friendName || 'Bạn bè',
				friendUsername: friendMeta?.friendUsername || '',
				friendAvatarUrl: friendMeta?.friendAvatarUrl || null,
				lastMessage: message.content,
				lastMessageTime: message.createdAt,
				unreadCount:
					message.senderId !== user?.id && selectedFriendId !== otherUserId
						? (previous.find((item) => item.friendId === otherUserId)?.unreadCount || 0) + 1
						: 0,
			}));
		};

		const handleTyping = (payload: { userId: string; isTyping: boolean }) => {
			if (!payload?.userId) return;
			setTypingFriendIds((previous) => ({
				...previous,
				[payload.userId]: Boolean(payload.isTyping),
			}));
		};

		const handleMessagesRead = (payload: { readBy?: string }) => {
			if (!payload?.readBy) return;

			setMessages((previous) => previous.map((item) => (
				item.senderId === user?.id && item.receiverId === payload.readBy
					? { ...item, isRead: true }
					: item
			)));
		};

		const handleFriendshipRefresh = () => {
			void loadOverview();
		};

		onMessageReceived(handleMessage);
		onMessageSent(handleMessage);
		onMessagesRead(handleMessagesRead);
		onUserTyping(handleTyping);
		onFriendRequestReceived(handleFriendshipRefresh);
		onFriendRequestResolved(handleFriendshipRefresh);
		onFriendshipUpdated(handleFriendshipRefresh);

		return () => {
			offMessageReceived(handleMessage);
			offMessageSent(handleMessage);
			offMessagesRead(handleMessagesRead);
			offUserTyping(handleTyping);
			offFriendRequestReceived(handleFriendshipRefresh);
			offFriendRequestResolved(handleFriendshipRefresh);
			offFriendshipUpdated(handleFriendshipRefresh);
		};
	}, [friends, loadOverview, selectedFriendId, user?.id]);

	const handleSearch = useCallback(async () => {
		const keyword = searchKeyword.trim();
		if (!keyword) {
			setSearchResults([]);
			return;
		}

		setIsSearching(true);
		setErrorMessage('');

		try {
			const items = await searchFriendsRequest(keyword);
			setSearchResults(items);
		} catch {
			setErrorMessage('Không tìm kiếm được người dùng.');
		} finally {
			setIsSearching(false);
		}
	}, [searchKeyword]);

	const handleSendFriendRequest = useCallback(async (friendId: string) => {
		setIsSendingRequestMap((previous) => ({ ...previous, [friendId]: true }));
		setErrorMessage('');

		try {
			await sendFriendRequestRequest(friendId);
			setSearchResults((previous) => previous.map((item) => (
				item.userId === friendId
					? { ...item, hasRequest: true, requestDirection: 'outgoing' }
					: item
			)));
			await loadOverview();
		} catch (error) {
			const responseMessage =
				(error as { response?: { data?: { message?: string } } })?.response?.data?.message
				|| 'Gửi yêu cầu kết bạn thất bại.';
			setErrorMessage(responseMessage);
		} finally {
			setIsSendingRequestMap((previous) => ({ ...previous, [friendId]: false }));
		}
	}, [loadOverview]);

	const handleAcceptRequest = useCallback(async (requestId: string) => {
		setIsResolvingRequestMap((previous) => ({ ...previous, [requestId]: true }));
		setErrorMessage('');

		try {
			await acceptFriendRequestRequest(requestId);
			await loadOverview();
		} catch {
			setErrorMessage('Chấp nhận yêu cầu thất bại.');
		} finally {
			setIsResolvingRequestMap((previous) => ({ ...previous, [requestId]: false }));
		}
	}, [loadOverview]);

	const handleRejectRequest = useCallback(async (requestId: string) => {
		setIsResolvingRequestMap((previous) => ({ ...previous, [requestId]: true }));
		setErrorMessage('');

		try {
			await rejectFriendRequestRequest(requestId);
			await loadOverview();
		} catch {
			setErrorMessage('Từ chối yêu cầu thất bại.');
		} finally {
			setIsResolvingRequestMap((previous) => ({ ...previous, [requestId]: false }));
		}
	}, [loadOverview]);

	const handleSubmitMessage = useCallback(async (event: FormEvent) => {
		event.preventDefault();

		if (!selectedFriendId) return;
		const content = messageInput.trim();
		if (!content) return;

		setIsSendingMessage(true);
		setErrorMessage('');
		setMessageInput('');

		try {
			if (isConnected) {
				sendMessage(selectedFriendId, content);
			} else {
				const sent = await sendMessageRequest(selectedFriendId, content);
				setMessages((previous) => [...previous, sent]);
			}

			markTyping(selectedFriendId, false);
		} catch (error) {
			const responseMessage =
				(error as { response?: { data?: { message?: string } } })?.response?.data?.message
				|| 'Gửi tin nhắn thất bại.';
			setErrorMessage(responseMessage);
			setMessageInput(content);
		} finally {
			setIsSendingMessage(false);
		}
	}, [isConnected, markTyping, messageInput, selectedFriendId, sendMessage]);

	const selectedFriendTyping = selectedFriendId ? typingFriendIds[selectedFriendId] : false;

	const handleSelectFriend = useCallback((friendId: string) => {
		setSelectedFriendId(friendId);
		const nextSearchParams = new URLSearchParams(searchParams.toString());
		nextSearchParams.set('tab', 'friends');
		nextSearchParams.set('friendId', friendId);
		router.replace(`/dashboard?${nextSearchParams.toString()}`);
	}, [router, searchParams]);

	const clearTouchHoldTimer = useCallback(() => {
		if (touchHoldTimerRef.current) {
			window.clearTimeout(touchHoldTimerRef.current);
			touchHoldTimerRef.current = null;
		}
	}, []);

	useEffect(() => () => {
		clearTouchHoldTimer();
	}, [clearTouchHoldTimer]);

	return (
		<div style={{ display: 'grid', gap: 12 }}>
			<AppCard strong style={{ padding: 16, display: 'grid', gap: 10 }}>
				<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
					<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
						<Loader2 size={16} color="var(--accent)" />
						<span style={{ fontSize: 16, fontWeight: 800 }}>Bạn bè</span>
					</div>
					<button
						type="button"
						onClick={() => void loadOverview()}
						disabled={isLoadingOverview}
						style={{
							border: '1px solid var(--surface-border)',
							borderRadius: 10,
							background: 'transparent',
							color: 'var(--muted)',
							padding: '6px 10px',
							fontSize: 12,
							fontWeight: 700,
							cursor: isLoadingOverview ? 'not-allowed' : 'pointer',
						}}
					>
						Làm mới
					</button>
				</div>

				<div style={{ display: 'grid', gap: 8 }}>
					<div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>Tìm người dùng</div>
					<div style={{ display: 'flex', gap: 8 }}>
						<input
							value={searchKeyword}
							onChange={(event) => setSearchKeyword(event.target.value)}
							placeholder="Nhập username hoặc tên hiển thị"
							style={{
								flex: 1,
								height: 40,
								borderRadius: 10,
								border: '1px solid var(--surface-border)',
								background: 'var(--surface)',
								color: 'var(--foreground)',
								padding: '0 12px',
							}}
						/>
						<button
							type="button"
							onClick={() => void handleSearch()}
							disabled={isSearching}
							style={{
								height: 40,
								width: 40,
								borderRadius: 10,
								border: '1px solid var(--surface-border)',
								background: 'transparent',
								color: 'var(--foreground)',
								display: 'grid',
								placeItems: 'center',
								cursor: isSearching ? 'not-allowed' : 'pointer',
							}}
						>
							<Search size={16} />
						</button>
					</div>

					{searchResults.length > 0 ? (
						<div style={{ display: 'grid', gap: 8 }}>
							{searchResults.map((item) => {
								const disabled = item.isFriend || item.hasRequest || isSendingRequestMap[item.userId];
								const actionLabel = item.isFriend
									? 'Đã là bạn'
									: item.hasRequest
										? item.requestDirection === 'incoming'
											? 'Đã nhận lời mời'
											: 'Đã gửi lời mời'
										: '';

								return (
									<div
										key={item.userId}
										style={{
											display: 'flex',
											alignItems: 'center',
											justifyContent: 'space-between',
											gap: 10,
											border: '1px solid var(--surface-border)',
											borderRadius: 12,
											padding: 10,
										}}
									>
										<div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
											<UserAvatar src={item.avatarUrl || undefined} alt={item.displayName} size={34} />
											<div>
												<div style={{ fontSize: 13, fontWeight: 700 }}>{item.displayName}</div>
												<div style={{ fontSize: 12, color: 'var(--muted)' }}>@{item.username}</div>
											</div>
										</div>
										<button
											type="button"
											onClick={() => void handleSendFriendRequest(item.userId)}
											disabled={disabled}
											style={{
												border: '1px solid var(--surface-border)',
												borderRadius: 10,
												background: 'transparent',
												color: 'var(--foreground)',
												height: 34,
												minWidth: 96,
												padding: '0 10px',
												fontWeight: 700,
												fontSize: 12,
												cursor: disabled ? 'not-allowed' : 'pointer',
												opacity: disabled ? 0.6 : 1,
											}}
										>
											{actionLabel || <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><UserPlus size={14} /> Kết bạn</span>}
										</button>
									</div>
								);
							})}
						</div>
					) : null}
				</div>

				{pendingRequests.length > 0 ? (
					<div style={{ display: 'grid', gap: 8 }}>
						<div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>Lời mời kết bạn ({pendingRequests.length})</div>
						{pendingRequests.map((item) => {
							const isBusy = Boolean(isResolvingRequestMap[item.requestId]);

							return (
								<div
									key={item.requestId}
									style={{
										display: 'flex',
										alignItems: 'center',
										justifyContent: 'space-between',
										gap: 10,
										border: '1px solid var(--surface-border)',
										borderRadius: 12,
										padding: 10,
									}}
								>
									<div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
										<UserAvatar src={item.senderAvatarUrl || undefined} alt={item.senderName} size={34} />
										<div>
											<div style={{ fontSize: 13, fontWeight: 700 }}>{item.senderName}</div>
											<div style={{ fontSize: 12, color: 'var(--muted)' }}>@{item.senderUsername}</div>
										</div>
									</div>
									<div style={{ display: 'flex', gap: 6 }}>
										<button
											type="button"
											onClick={() => void handleAcceptRequest(item.requestId)}
											disabled={isBusy}
											style={{
												width: 34,
												height: 34,
												borderRadius: 10,
												border: '1px solid color-mix(in srgb, #22c55e 42%, var(--surface-border))',
												background: 'transparent',
												color: '#22c55e',
												display: 'grid',
												placeItems: 'center',
												cursor: isBusy ? 'not-allowed' : 'pointer',
											}}
										>
											<Check size={16} />
										</button>
										<button
											type="button"
											onClick={() => void handleRejectRequest(item.requestId)}
											disabled={isBusy}
											style={{
												width: 34,
												height: 34,
												borderRadius: 10,
												border: '1px solid color-mix(in srgb, #ef4444 42%, var(--surface-border))',
												background: 'transparent',
												color: '#ef4444',
												display: 'grid',
												placeItems: 'center',
												cursor: isBusy ? 'not-allowed' : 'pointer',
											}}
										>
											<X size={16} />
										</button>
									</div>
								</div>
							);
						})}
					</div>
				) : null}

				{errorMessage ? (
					<div style={{ fontSize: 12, color: '#ef4444' }}>{errorMessage}</div>
				) : null}
			</AppCard>

			<div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 12 }}>
				<AppCard strong style={{ padding: 14, display: 'grid', gap: 10 }}>
					<div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>Danh sách bạn bè</div>
					{friends.length === 0 ? (
						<div style={{ fontSize: 13, color: 'var(--muted)' }}>Bạn chưa có bạn bè nào.</div>
					) : (
						<div style={{ display: 'grid', gap: 8 }}>
							{friends.map((item) => {
								const conversation = conversations.find((conv) => conv.friendId === item.friendId);
								const isActive = item.friendId === selectedFriendId;

								return (
									<button
										key={item.friendId}
										type="button"
										onClick={() => handleSelectFriend(item.friendId)}
										style={{
											textAlign: 'left',
											width: '100%',
											border: '1px solid var(--surface-border)',
											borderRadius: 12,
											background: isActive ? 'color-mix(in srgb, var(--accent) 16%, transparent)' : 'transparent',
											color: 'var(--foreground)',
											padding: 10,
											display: 'flex',
											alignItems: 'center',
											justifyContent: 'space-between',
											gap: 10,
											cursor: 'pointer',
										}}
									>
										<div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
											<UserAvatar src={item.friendAvatarUrl || undefined} alt={item.friendName} size={34} />
											<div style={{ minWidth: 0 }}>
												<div style={{ fontSize: 13, fontWeight: 700 }}>{item.friendName}</div>
												<div style={{ fontSize: 12, color: 'var(--muted)' }}>
													{truncateText(conversation?.lastMessage || `@${item.friendUsername}`)}
												</div>
											</div>
										</div>
										<div style={{ textAlign: 'right', display: 'grid', gap: 4 }}>
											<div style={{ fontSize: 11, color: 'var(--muted)' }}>
												{conversation?.lastMessageTime ? formatDateTime(conversation.lastMessageTime) : ''}
											</div>
											{conversation?.unreadCount ? (
												<div style={{ justifySelf: 'end', minWidth: 20, height: 20, borderRadius: 999, background: 'var(--accent)', color: '#041018', fontWeight: 800, fontSize: 11, display: 'grid', placeItems: 'center', padding: '0 6px' }}>
													{conversation.unreadCount}
												</div>
											) : null}
										</div>
									</button>
								);
							})}
						</div>
					)}
				</AppCard>

				<AppCard strong style={{ padding: 14, display: 'grid', gap: 10 }}>
					<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
						<div>
							<div style={{ fontSize: 14, fontWeight: 800 }}>{selectedFriend?.name || 'Chọn bạn bè để nhắn tin'}</div>
							<div style={{ fontSize: 12, color: 'var(--muted)' }}>{selectedFriend ? `@${selectedFriend.username}` : 'Danh sách bạn ở bên trên'}</div>
						</div>
						<div style={{ fontSize: 11.5, color: isConnected ? '#22c55e' : 'var(--muted)', fontWeight: 700 }}>
							{isConnected ? 'Đang online' : 'Đang kết nối'}
						</div>
					</div>

					<div
						ref={chatScrollRef}
						style={{
							borderRadius: 12,
							border: '1px solid var(--surface-border)',
							background:
								'linear-gradient(180deg, color-mix(in srgb, var(--theme-gradient-start) 7%, var(--surface-base)), var(--surface-base) 25%, var(--surface-base))',
							height: 'clamp(280px, 46vh, 460px)',
							overflowY: 'auto',
							padding: 10,
							display: 'flex',
							flexDirection: 'column',
							gap: 10,
						}}
					>
						{!selectedFriend ? (
							<div style={{ fontSize: 13, color: 'var(--muted)' }}>Chọn một người bạn để bắt đầu cuộc trò chuyện.</div>
						) : null}

						{selectedFriend && isLoadingMessages ? (
							<div style={{ fontSize: 13, color: 'var(--muted)' }}>Đang tải tin nhắn...</div>
						) : null}

						{selectedFriend && !isLoadingMessages && messages.length === 0 ? (
							<div style={{ fontSize: 13, color: 'var(--muted)' }}>Chưa có tin nhắn nào. Hãy nhắn câu đầu tiên.</div>
						) : null}

						{messages.map((item) => {
							const isMe = item.senderId === user?.id;
							const isTimestampVisible = visibleTimestampMessageId === item.id;
							const avatarSrc = isMe ? user?.avatarUrl : selectedFriend?.avatarUrl;
							const avatarAlt = isMe ? (user?.displayName || user?.username || 'Bạn') : (selectedFriend?.name || 'Bạn bè');
							return (
								<div
									key={item.id}
									style={{
										alignSelf: isMe ? 'flex-end' : 'flex-start',
										maxWidth: 'min(92%, 620px)',
										position: 'relative',
										paddingLeft: isMe ? 0 : 12,
										paddingRight: isMe ? 12 : 0,
									}}
									onMouseEnter={() => setVisibleTimestampMessageId(item.id)}
									onMouseLeave={() => setVisibleTimestampMessageId((current) => (current === item.id ? '' : current))}
									onTouchStart={() => {
										clearTouchHoldTimer();
										touchHoldTimerRef.current = window.setTimeout(() => {
											setVisibleTimestampMessageId(item.id);
										}, 320);
									}}
									onTouchEnd={() => {
										clearTouchHoldTimer();
										setVisibleTimestampMessageId((current) => (current === item.id ? '' : current));
									}}
									onTouchCancel={() => {
										clearTouchHoldTimer();
										setVisibleTimestampMessageId((current) => (current === item.id ? '' : current));
									}}
								>
									<div
										style={{
											borderRadius: 10,
											border: isMe ? 'none' : '1px solid color-mix(in srgb, var(--theme-gradient-start) 22%, var(--surface-border))',
											background: isMe
												? 'linear-gradient(135deg, color-mix(in srgb, var(--theme-gradient-start) 42%, var(--chip-bg)), color-mix(in srgb, var(--theme-gradient-end) 42%, var(--chip-bg)))'
												: 'linear-gradient(135deg, color-mix(in srgb, var(--surface-strong) 80%, #ffffff), var(--surface-strong))',
											color: isMe ? 'var(--theme-nav-active)' : 'var(--foreground)',
											padding: '7px 10px',
											boxShadow: isMe
												? '0 12px 24px color-mix(in srgb, var(--theme-gradient-start) 25%, transparent)'
												: '0 8px 20px rgba(15, 23, 42, 0.08)',
											display: 'grid',
											gap: 3,
										}}
									>
										<div style={{ fontSize: 11.4, lineHeight: 1.35, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{item.content}</div>
										<div
											style={{
												fontSize: 10,
												opacity: isTimestampVisible ? 0.78 : 0,
												textAlign: 'right',
												minHeight: 12,
												pointerEvents: 'none',
												transition: 'opacity 130ms ease',
											}}
										>
											{formatDateTime(item.createdAt)}
										</div>
									</div>
									<UserAvatar
										src={avatarSrc || undefined}
										alt={avatarAlt}
										size={26}
										radius="50%"
										style={{
											position: 'absolute',
											bottom: -10,
											left: isMe ? 'auto' : -10,
											right: isMe ? -10 : 'auto',
											border: isMe
												? '2px solid color-mix(in srgb, var(--theme-gradient-start) 62%, #ffffff)'
												: '2px solid color-mix(in srgb, var(--theme-gradient-end) 58%, #ffffff)',
											boxShadow: isMe
												? '0 10px 20px rgba(37, 99, 235, 0.26), 0 0 0 3px color-mix(in srgb, var(--surface-strong) 82%, transparent)'
												: '0 10px 20px rgba(14, 165, 233, 0.22), 0 0 0 3px color-mix(in srgb, var(--surface-strong) 82%, transparent)',
											background: isMe
												? 'linear-gradient(135deg, rgba(59, 130, 246, 0.28), rgba(15, 23, 42, 0.95))'
												: 'linear-gradient(135deg, rgba(56, 189, 248, 0.24), rgba(15, 23, 42, 0.95))',
											zIndex: 2,
										}}
									/>
								</div>
							);
						})}
					</div>

					{selectedFriendTyping ? (
						<div style={{ fontSize: 12, color: 'var(--muted)' }}>{selectedFriend?.name} đang nhập...</div>
					) : null}

					<form onSubmit={handleSubmitMessage} style={{ display: 'flex', gap: 8 }}>
						<input
							value={messageInput}
							onChange={(event) => {
								const nextValue = event.target.value;
								setMessageInput(nextValue);

								if (!selectedFriendId) return;
								markTyping(selectedFriendId, nextValue.trim().length > 0);
							}}
							onBlur={() => {
								if (!selectedFriendId) return;
								markTyping(selectedFriendId, false);
							}}
							disabled={!selectedFriend || isSendingMessage}
							placeholder={selectedFriend ? 'Nhập tin nhắn...' : 'Chọn bạn bè trước'}
							style={{
								flex: 1,
								height: 42,
								borderRadius: 10,
								border: '1px solid var(--surface-border)',
								background: 'var(--surface)',
								color: 'var(--foreground)',
								padding: '0 12px',
							}}
						/>
						<button
							type="submit"
							disabled={!selectedFriend || isSendingMessage || !messageInput.trim()}
							style={{
								width: 42,
								height: 42,
								borderRadius: 10,
								border: '1px solid var(--surface-border)',
								background: 'transparent',
								color: 'var(--foreground)',
								display: 'grid',
								placeItems: 'center',
								cursor: !selectedFriend || isSendingMessage || !messageInput.trim() ? 'not-allowed' : 'pointer',
							}}
						>
							<Send size={16} />
						</button>
					</form>
				</AppCard>
			</div>
		</div>
	);
}