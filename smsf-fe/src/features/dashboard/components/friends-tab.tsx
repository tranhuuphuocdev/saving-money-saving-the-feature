'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowDown, Check, Loader2, Search, Send, Smile, UserPlus, X } from 'lucide-react';
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

const QUICK_EMOJIS = [
	'😀', '😂', '😍', '🥰', '👍',
	'🙏', '🔥', '🎉', '💸', '❤️',
	'😎', '🤔', '🤯', '😢', '😡',
	'🤗', '🤩',
];
const MESSAGE_PAGE_SIZE = 25;

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
	const [isLoadingOlderMessages, setIsLoadingOlderMessages] = useState(false);
	const [isSendingMessage, setIsSendingMessage] = useState(false);
	const [isScrolledUp, setIsScrolledUp] = useState(false);
	const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
	const [hasMoreMessages, setHasMoreMessages] = useState(false);
	const [messageOffset, setMessageOffset] = useState(0);
	const chatScrollRef = useRef<HTMLDivElement | null>(null);
	const isPrependingMessagesRef = useRef(false);
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
			setMessageOffset(0);
			setHasMoreMessages(false);
			return;
		}

		setIsLoadingMessages(true);

		try {
			const items = await getMessagesRequest(friendId, MESSAGE_PAGE_SIZE, 0);
			setMessages(items);
			setMessageOffset(items.length);
			setHasMoreMessages(items.length === MESSAGE_PAGE_SIZE);
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
		if (isPrependingMessagesRef.current) return;
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
		setIsEmojiPickerOpen(false);

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

	const loadOlderMessages = useCallback(async () => {
		if (!selectedFriendId || isLoadingMessages || isLoadingOlderMessages || !hasMoreMessages) {
			return;
		}

		const viewport = chatScrollRef.current;
		const previousScrollHeight = viewport?.scrollHeight || 0;
		const previousScrollTop = viewport?.scrollTop || 0;

		setIsLoadingOlderMessages(true);
		try {
			const olderItems = await getMessagesRequest(selectedFriendId, MESSAGE_PAGE_SIZE, messageOffset);
			setMessages((previous) => {
				const existingIds = new Set(previous.map((item) => item.id));
				const prepended = olderItems.filter((item) => !existingIds.has(item.id));
				if (prepended.length === 0) {
					return previous;
				}

				isPrependingMessagesRef.current = true;
				return [...prepended, ...previous];
			});

			setMessageOffset((previous) => previous + olderItems.length);
			setHasMoreMessages(olderItems.length === MESSAGE_PAGE_SIZE);

			window.requestAnimationFrame(() => {
				const nextViewport = chatScrollRef.current;
				if (nextViewport && olderItems.length > 0) {
					const nextScrollHeight = nextViewport.scrollHeight;
					nextViewport.scrollTop = nextScrollHeight - previousScrollHeight + previousScrollTop;
				}
				isPrependingMessagesRef.current = false;
			});
		} catch {
			setErrorMessage('Không tải thêm được tin nhắn cũ.');
		} finally {
			setIsLoadingOlderMessages(false);
		}
	}, [hasMoreMessages, isLoadingMessages, isLoadingOlderMessages, messageOffset, selectedFriendId]);

	const appendEmojiToMessage = useCallback((emoji: string) => {
		if (!selectedFriendId || isSendingMessage) return;

		setMessageInput((previous) => {
			const next = `${previous}${emoji}`;
			markTyping(selectedFriendId, next.trim().length > 0);
			return next;
		});
	}, [isSendingMessage, markTyping, selectedFriendId]);

	const selectedFriendTyping = selectedFriendId ? typingFriendIds[selectedFriendId] : false;

	const handleSelectFriend = useCallback((friendId: string) => {
		setSelectedFriendId(friendId);
		setIsEmojiPickerOpen(false);
		const nextSearchParams = new URLSearchParams(searchParams.toString());
		nextSearchParams.set('tab', 'friends');
		nextSearchParams.set('friendId', friendId);
		router.replace(`/dashboard?${nextSearchParams.toString()}`);
	}, [router, searchParams]);

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
						style={{
							position: 'relative',
							borderRadius: 16,
							border: '1px solid color-mix(in srgb, var(--theme-gradient-start) 16%, var(--surface-border))',
							background: 'linear-gradient(180deg, color-mix(in srgb, var(--theme-gradient-start) 10%, var(--surface-base)), color-mix(in srgb, var(--theme-gradient-end) 6%, var(--surface-base)))',
							overflow: 'hidden',
						}}
					>
					<div
						ref={chatScrollRef}
						onScroll={(e) => {
							const el = e.currentTarget;
							setIsScrolledUp(el.scrollHeight - el.scrollTop - el.clientHeight > 50);
							if (el.scrollTop <= 24 && hasMoreMessages && !isLoadingOlderMessages && !isLoadingMessages) {
								void loadOlderMessages();
							}
						}}
						style={{
							height: 'clamp(320px, 54vh, 560px)',
							overflowY: 'auto',
							padding: 16,
							display: 'flex',
							flexDirection: 'column',
							gap: 12,
							backgroundImage: 'radial-gradient(circle at 18% 22%, color-mix(in srgb, var(--theme-gradient-start) 14%, transparent) 0px, transparent 130px), radial-gradient(circle at 82% 74%, color-mix(in srgb, var(--theme-gradient-end) 12%, transparent) 0px, transparent 160px)',
						}}
					>
						{isLoadingOlderMessages ? (
							<div style={{ display: 'flex', justifyContent: 'center', padding: '2px 0 6px' }}>
								<div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999, border: '1px solid var(--surface-border)', background: 'color-mix(in srgb, var(--surface-base) 90%, #ffffff)', fontSize: 11.5, color: 'var(--muted)' }}>
									<Loader2 size={12} className='spin' /> Đang tải tin nhắn cũ...
								</div>
							</div>
						) : null}
						{!selectedFriend ? (
							<div style={{ fontSize: 13, color: 'var(--muted)' }}>Chọn một người bạn để bắt đầu cuộc trò chuyện.</div>
						) : null}

						{selectedFriend && isLoadingMessages ? (
							<div style={{ fontSize: 13, color: 'var(--muted)' }}>Đang tải tin nhắn...</div>
						) : null}

						{selectedFriend && !isLoadingMessages && messages.length === 0 ? (
							<div style={{ fontSize: 13, color: 'var(--muted)' }}>Chưa có tin nhắn nào. Hãy nhắn câu đầu tiên.</div>
						) : null}

						{messages.map((item, index) => {
							const isMe = item.senderId === user?.id;
							const isLast = index === messages.length - 1;
							const nextMessage = messages[index + 1];
							const showAvatar = !nextMessage || nextMessage.senderId !== item.senderId;
							const avatarSrc = isMe ? user?.avatarUrl : selectedFriend?.avatarUrl;
							const avatarAlt = isMe ? (user?.displayName || user?.username || 'Bạn') : (selectedFriend?.name || 'Bạn bè');
							return (
								<div
									key={item.id}
									style={{
										alignSelf: isMe ? 'flex-end' : 'flex-start',
										maxWidth: 'min(88%, 620px)',
										position: 'relative',
										paddingLeft: isMe ? 0 : showAvatar ? 12 : 0,
										paddingRight: isMe ? (showAvatar ? 12 : 0) : 0,
										paddingBottom: isLast ? 14 : 0,
									}}
								>
									<div
										style={{
											borderRadius: 18,
											border: isMe ? '1px solid color-mix(in srgb, var(--theme-gradient-end) 40%, transparent)' : '1px solid color-mix(in srgb, var(--surface-border) 85%, #ffffff)',
											background: isMe
												? 'linear-gradient(135deg, color-mix(in srgb, var(--theme-gradient-start) 58%, #2563eb), color-mix(in srgb, var(--theme-gradient-end) 54%, #7c3aed))'
												: 'linear-gradient(160deg, color-mix(in srgb, var(--surface-strong) 92%, #ffffff), color-mix(in srgb, #ffffff 66%, var(--surface-strong)))',
											color: isMe ? 'var(--theme-nav-active)' : 'var(--foreground)',
											padding: '9px 13px',
											boxShadow: isMe
												? '0 12px 24px color-mix(in srgb, var(--theme-gradient-start) 32%, transparent)'
												: '0 8px 18px rgba(15, 23, 42, 0.11)',
										}}
									>
										<div style={{ fontSize: 13, lineHeight: 1.45, fontWeight: 560, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{item.content}</div>
									</div>
									{isLast ? (
										<div
											style={{
												position: 'absolute',
												bottom: 0,
												[isMe ? 'right' : 'left']: 12,
												fontSize: 10,
												color: 'var(--muted)',
												opacity: 0.75,
												whiteSpace: 'nowrap',
											}}
										>
											{formatDateTime(item.createdAt)}
										</div>
									) : null}
									{showAvatar ? (
										<UserAvatar
											src={avatarSrc || undefined}
											alt={avatarAlt}
											size={26}
											radius="50%"
											style={{
												position: 'absolute',
												bottom: isLast ? 14 : -10,
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
									) : null}
								</div>
							);
						})}
						{selectedFriend && selectedFriendTyping ? (
							<div style={{ alignSelf: 'flex-start', marginLeft: 2 }}>
								<div
									style={{
										borderRadius: 999,
										padding: '7px 12px',
										fontSize: 12,
										color: 'var(--muted)',
										background: 'color-mix(in srgb, var(--surface-strong) 86%, #ffffff)',
										border: '1px solid color-mix(in srgb, var(--surface-border) 88%, #ffffff)',
									}}
								>
									{selectedFriend.name} đang nhập...
								</div>
							</div>
						) : null}
					</div>
					{isScrolledUp && messages.length > 0 ? (
						<button
							type='button'
							onClick={() => { chatScrollRef.current?.scrollTo({ top: chatScrollRef.current.scrollHeight, behavior: 'smooth' }); }}
							style={{
								position: 'absolute',
								bottom: 8,
								right: 8,
								zIndex: 10,
								width: 28,
								height: 28,
								borderRadius: '50%',
								border: 'none',
								background: 'linear-gradient(135deg, var(--theme-gradient-start), var(--theme-gradient-end))',
								boxShadow: '0 4px 12px color-mix(in srgb, var(--theme-gradient-start) 40%, transparent)',
								color: '#fff',
								display: 'grid',
								placeItems: 'center',
								cursor: 'pointer',
							}}
						>
							<ArrowDown size={13} strokeWidth={2.5} />
						</button>
					) : null}
				</div>

					<form onSubmit={handleSubmitMessage} style={{ position: 'relative', display: 'grid', gap: 8 }}>
						{isEmojiPickerOpen && selectedFriend ? (
							<div
								style={{
									position: 'absolute',
									bottom: 58,
									left: 0,
									zIndex: 20,
									display: 'grid',
									gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
									gap: 8,
									padding: 10,
									borderRadius: 14,
									border: '1px solid var(--surface-border)',
									background: 'linear-gradient(180deg, color-mix(in srgb, var(--surface-base) 90%, #ffffff), var(--surface-base))',
									boxShadow: '0 18px 35px rgba(15, 23, 42, 0.18)',
								}}
							>
								{QUICK_EMOJIS.map((emoji) => (
									<button
										key={emoji}
										type="button"
										onClick={() => appendEmojiToMessage(emoji)}
										style={{
											width: 32,
											height: 32,
											borderRadius: 10,
											border: '1px solid transparent',
											background: 'color-mix(in srgb, var(--theme-gradient-start) 8%, transparent)',
											fontSize: 18,
											cursor: 'pointer',
										}}
									>
										{emoji}
									</button>
								))}
							</div>
						) : null}

						<div
							style={{
								display: 'flex',
								gap: 8,
								padding: 6,
								borderRadius: 14,
								border: '1px solid color-mix(in srgb, var(--theme-gradient-start) 18%, var(--surface-border))',
								background: 'linear-gradient(180deg, color-mix(in srgb, var(--surface-base) 85%, #ffffff), var(--surface-base))',
							}}
						>
							<button
								type="button"
								onClick={() => setIsEmojiPickerOpen((previous) => !previous)}
								disabled={!selectedFriend || isSendingMessage}
								style={{
									width: 42,
									height: 42,
									borderRadius: 10,
									border: '1px solid var(--surface-border)',
									background: isEmojiPickerOpen ? 'color-mix(in srgb, var(--theme-gradient-start) 20%, transparent)' : 'transparent',
									color: 'var(--foreground)',
									display: 'grid',
									placeItems: 'center',
									cursor: !selectedFriend || isSendingMessage ? 'not-allowed' : 'pointer',
								}}
								aria-label="Chọn emoji"
							>
								<Smile size={18} />
							</button>

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
							onFocus={() => {
								if (!selectedFriend) {
									setIsEmojiPickerOpen(false);
								}
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
								padding: '0 14px',
								fontSize: 13,
							}}
						/>
							<button
							type="submit"
							disabled={!selectedFriend || isSendingMessage || !messageInput.trim()}
							style={{
								width: 42,
								height: 42,
								borderRadius: 10,
								border: '1px solid color-mix(in srgb, var(--theme-gradient-start) 24%, var(--surface-border))',
								background: 'linear-gradient(135deg, color-mix(in srgb, var(--theme-gradient-start) 38%, var(--surface-strong)), color-mix(in srgb, var(--theme-gradient-end) 34%, var(--surface-strong)))',
								color: 'var(--theme-nav-active)',
								display: 'grid',
								placeItems: 'center',
								cursor: !selectedFriend || isSendingMessage || !messageInput.trim() ? 'not-allowed' : 'pointer',
								opacity: !selectedFriend || isSendingMessage || !messageInput.trim() ? 0.6 : 1,
							}}
						>
							<Send size={16} />
						</button>
						</div>
					</form>
				</AppCard>
			</div>
		</div>
	);
}