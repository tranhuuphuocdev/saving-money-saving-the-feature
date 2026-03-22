'use client';

import { BellRing, CalendarClock, CheckCircle2, Clock3, Plus, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AppCard } from '@/components/common/app-card';
import { CustomSelect } from '@/components/common/custom-select';
import { PrimaryButton } from '@/components/common/primary-button';
import { formatCurrencyVND } from '@/lib/formatters';
import { useLockBodyScroll } from '@/lib/ui/use-lock-body-scroll';
import { ICategoryItem, IWalletItem } from '@/types/calendar';
import { ICreateNotificationPayload, INotificationItem, IPayNotificationPayload } from '@/types/notification';

interface INotificationDrawerProps {
    isOpen: boolean;
    isLoading: boolean;
    notifications: INotificationItem[];
    wallets: IWalletItem[];
    expenseCategories: ICategoryItem[];
    userTelegramChatId?: string;
    onClose: () => void;
    onCreateNotification: (payload: ICreateNotificationPayload) => Promise<void>;
    onPayNotification: (notificationId: string, payload: IPayNotificationPayload) => Promise<void>;
}

interface INotificationVisualStyle {
    rowBackground: string;
    rowBorder: string;
    badgeBackground: string;
    badgeColor: string;
    amountColor: string;
    titleColor: string;
    iconColor: string;
}

function formatDueDate(timestamp: number): string {
    const date = new Date(timestamp);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}

function formatMonthYear(month: number, year: number): string {
    return `${String(month).padStart(2, '0')}/${year}`;
}

function getDueBadgeLabel(remainingDays: number): string {
    if (remainingDays < 0) {
        return `Quá hạn ${Math.abs(remainingDays)} ngày`;
    }

    if (remainingDays === 0) {
        return 'Đến hạn hôm nay';
    }

    return `Còn ${remainingDays} ngày`;
}

function getRemainingDays(timestamp: number): number {
    const today = new Date();
    const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const target = new Date(timestamp);
    const startTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
    return Math.ceil((startTarget - startToday) / (24 * 60 * 60 * 1000));
}

function getStatusLabel(notification: INotificationItem): string {
    if (
        notification.paymentStatus === 'paid' &&
        notification.paidMonth === notification.currentMonth &&
        notification.paidYear === notification.currentYear
    ) {
        return `Tháng ${formatMonthYear(notification.currentMonth, notification.currentYear)} đã thanh toán`;
    }

    return getDueBadgeLabel(getRemainingDays(notification.nextDueAt));
}

function getNotificationVisualStyle(notification: INotificationItem, remainingDays: number): INotificationVisualStyle {
    if (notification.paymentStatus === 'paid') {
        return {
            rowBackground: 'color-mix(in srgb, #22c55e 14%, var(--surface-soft))',
            rowBorder: 'color-mix(in srgb, #16a34a 40%, var(--surface-border))',
            badgeBackground: 'color-mix(in srgb, #16a34a 22%, transparent)',
            badgeColor: 'var(--bage-color)',
            amountColor: '#166534',
            titleColor: 'color-mix(in srgb, var(--foreground) 88%, #14532d)',
            iconColor: '#16a34a',
        };
    }

    if (remainingDays < 0) {
        return {
            rowBackground: 'color-mix(in srgb, #ef4444 10%, var(--surface-soft))',
            rowBorder: 'color-mix(in srgb, #dc2626 46%, var(--surface-border))',
            badgeBackground: 'color-mix(in srgb, #dc2626 16%, transparent)',
            badgeColor: 'var(--bage-color)',
            amountColor: '#dc2626',
            titleColor: 'color-mix(in srgb, var(--foreground) 90%, #991b1b)',
            iconColor: '#ef4444',
        };
    }

    return {
        rowBackground: 'var(--surface-soft)',
        rowBorder: 'var(--surface-border)',
        badgeBackground: 'var(--chip-bg)',
        badgeColor: 'var(--bage-color)',
        amountColor: 'var(--accent-text)',
        titleColor: 'var(--foreground)',
        iconColor: 'var(--accent)',
    };
}

export function NotificationDrawer({
    isOpen,
    isLoading,
    notifications,
    wallets,
    expenseCategories,
    userTelegramChatId,
    onClose,
    onCreateNotification,
    onPayNotification,
}: INotificationDrawerProps) {
    useLockBodyScroll(isOpen);

    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [createCategoryId, setCreateCategoryId] = useState('');
    const [createAmount, setCreateAmount] = useState('');
    const [createDueDay, setCreateDueDay] = useState('1');
    const [createDescription, setCreateDescription] = useState('');
    const [createTelegramChatId, setCreateTelegramChatId] = useState('');
    const [createError, setCreateError] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    const [selectedNotification, setSelectedNotification] = useState<INotificationItem | null>(null);
    const [payWalletId, setPayWalletId] = useState('');
    const [payError, setPayError] = useState('');
    const [isPaying, setIsPaying] = useState(false);

    const richestWalletId = useMemo(() => {
        if (wallets.length === 0) {
            return '';
        }

        return wallets.reduce((bestWallet, wallet) => {
            if (!bestWallet || wallet.balance > bestWallet.balance) {
                return wallet;
            }

            return bestWallet;
        }, wallets[0]).id;
    }, [wallets]);

    const sortedNotifications = useMemo(() => {
        return [...notifications].sort((left, right) => {
            const leftPriority = left.paymentStatus === 'unpaid' ? 0 : 1;
            const rightPriority = right.paymentStatus === 'unpaid' ? 0 : 1;

            if (leftPriority !== rightPriority) {
                return leftPriority - rightPriority;
            }

            if (left.nextDueAt !== right.nextDueAt) {
                return left.nextDueAt - right.nextDueAt;
            }

            return right.updatedAt - left.updatedAt;
        });
    }, [notifications]);

    useEffect(() => {
        if (!createCategoryId) {
            setCreateCategoryId(expenseCategories[0]?.id || '');
        }
    }, [createCategoryId, expenseCategories]);

    useEffect(() => {
        if (!payWalletId) {
            setPayWalletId(richestWalletId);
        }
    }, [payWalletId, richestWalletId]);

    const resetCreateModal = () => {
        setCreateCategoryId(expenseCategories[0]?.id || '');
        setCreateAmount('');
        setCreateDueDay('1');
        setCreateDescription('');
        setCreateTelegramChatId('');
        setCreateError('');
        setIsCreateModalOpen(false);
    };

    const closePayModal = () => {
        setSelectedNotification(null);
        setPayWalletId(richestWalletId);
        setPayError('');
    };

    const submitCreateNotification = async () => {
        const amountValue = parseInt(createAmount.replace(/\D/g, ''), 10) || 0;
        const dueDayValue = parseInt(createDueDay, 10);

        if (!createCategoryId) {
            setCreateError('Vui lòng chọn danh mục chi tiêu.');
            return;
        }

        if (!Number.isFinite(amountValue) || amountValue <= 0) {
            setCreateError('Số tiền phải lớn hơn 0.');
            return;
        }

        if (!Number.isInteger(dueDayValue) || dueDayValue < 1 || dueDayValue > 31) {
            setCreateError('Ngày định kỳ phải từ 1 đến 31.');
            return;
        }

        setCreateError('');
        setIsCreating(true);

        try {
            await onCreateNotification({
                categoryId: createCategoryId,
                amount: amountValue,
                dueDay: dueDayValue,
                description: createDescription.trim() || undefined,
                telegramChatId: userTelegramChatId?.trim() || createTelegramChatId.trim() || undefined,
            });
            resetCreateModal();
        } catch (error) {
            const responseData = (error as { response?: { data?: { message?: string; errors?: string[] } } })?.response?.data;
            setCreateError(
                responseData?.errors?.join(' ') || responseData?.message || 'Tạo nhắc lịch thanh toán thất bại.',
            );
        } finally {
            setIsCreating(false);
        }
    };

    const submitPayNotification = async () => {
        if (!selectedNotification) {
            return;
        }

        if (!payWalletId) {
            setPayError('Vui lòng chọn ví thanh toán.');
            return;
        }

        setPayError('');
        setIsPaying(true);

        try {
            await onPayNotification(selectedNotification.id, { walletId: payWalletId });
            closePayModal();
        } catch (error) {
            setPayError(
                (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
                    'Thanh toán nhắc lịch thất bại.',
            );
        } finally {
            setIsPaying(false);
        }
    };

    return (
        <>
            <div
                onClick={onClose}
                style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(2, 8, 23, 0.5)',
                    backdropFilter: 'blur(4px)',
                    opacity: isOpen ? 1 : 0,
                    pointerEvents: isOpen ? 'auto' : 'none',
                    transition: 'opacity 0.22s ease',
                    zIndex: 44,
                }}
            />

            <aside
                style={{
                    position: 'fixed',
                    right: 0,
                    top: 0,
                    bottom: 0,
                    height: '100dvh',
                    width: 'min(90vw, 400px)',
                    padding: 16,
                    background: 'var(--surface-strong)',
                    borderLeft: '1px solid var(--border)',
                    transform: isOpen ? 'translateX(0)' : 'translateX(104%)',
                    transition: 'transform 0.26s ease',
                    zIndex: 45,
                    boxShadow: '0 24px 80px rgba(0,0,0,0.35)',
                    display: 'grid',
                    gridTemplateRows: 'auto 1fr auto',
                    gap: 12,
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <div style={{ color: 'var(--muted)', fontSize: 12 }}>Thông báo định kỳ</div>
                        <div style={{ marginTop: 3, fontSize: 18, fontWeight: 900 }}>Nhắc lịch thanh toán</div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            width: 38,
                            height: 38,
                            borderRadius: 12,
                            border: '1px solid var(--border)',
                            background: 'var(--surface-soft)',
                            color: 'var(--foreground)',
                        }}
                    >
                        <X size={18} />
                    </button>
                </div>

                <AppCard
                    strong
                    style={{
                        padding: 12,
                        overflowY: 'auto',
                        display: 'grid',
                        gap: 10,
                        gridAutoRows: 'max-content',
                        alignContent: 'start',
                    }}
                >
                    {isLoading ? (
                        <div style={{ display: 'grid', gap: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--muted)', fontSize: 13 }}>
                                <Clock3 size={14} /> Đang tải danh sách nhắc hạn...
                            </div>
                            {Array.from({ length: 3 }).map((_, index) => (
                                <div
                                    key={`noti-skeleton-${index}`}
                                    style={{
                                        height: 68,
                                        borderRadius: 12,
                                        border: '1px solid var(--surface-border)',
                                        background: 'linear-gradient(90deg, color-mix(in srgb, var(--surface-soft) 84%, transparent) 0%, color-mix(in srgb, var(--surface-soft) 56%, var(--foreground)) 50%, color-mix(in srgb, var(--surface-soft) 84%, transparent) 100%)',
                                        backgroundSize: '220% 100%',
                                        animation: 'list-shimmer 0.95s ease infinite',
                                    }}
                                />
                            ))}
                        </div>
                    ) : null}

                    {!isLoading && sortedNotifications.length === 0 ? (
                        <div
                            style={{
                                borderRadius: 12,
                                border: '1px dashed var(--surface-border)',
                                padding: '16px 12px',
                                color: 'var(--muted)',
                                fontSize: 12.5,
                                textAlign: 'center',
                            }}
                        >
                            Chưa có nhắc lịch thanh toán trong tháng.
                        </div>
                    ) : null}

                    {!isLoading
                        ? sortedNotifications.map((item) => {
                              const isPaid = item.paymentStatus === 'paid';
                              const remainingDays = getRemainingDays(item.nextDueAt);
                            const visualStyle = getNotificationVisualStyle(item, remainingDays);

                              return (
                                  <button
                                      key={item.id}
                                      type="button"
                                      disabled={isPaid}
                                      onClick={() => {
                                          setSelectedNotification(item);
                                          setPayWalletId(richestWalletId);
                                          setPayError('');
                                      }}
                                      style={{
                                          display: 'grid',
                                          gridTemplateColumns: '1fr auto',
                                          gap: 10,
                                          padding: '11px 12px',
                                          borderRadius: 14,
                                          border: `1px solid ${visualStyle.rowBorder}`,
                                          background: visualStyle.rowBackground,
                                          alignItems: 'center',
                                          color: visualStyle.titleColor,
                                          textAlign: 'left',
                                          opacity: isPaid ? 0.94 : 1,
                                      }}
                                  >
                                      <div style={{ minWidth: 0 }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 800, fontSize: 12.5, color: visualStyle.titleColor }}>
                                                  <BellRing size={12} color={visualStyle.iconColor} />
                                                  {item.categoryName}
                                              </span>
                                              <span
                                                  style={{
                                                      borderRadius: 999,
                                                      padding: '3px 7px',
                                                      fontSize: 10,
                                                      fontWeight: 800,
                                                      color: visualStyle.badgeColor,
                                                      background: visualStyle.badgeBackground,
                                                  }}
                                              >
                                                  {getStatusLabel(item)}
                                              </span>
                                          </div>

                                          <div
                                              style={{
                                                  marginTop: 4,
                                                  color: 'color-mix(in srgb, var(--muted) 88%, var(--foreground))',
                                                  fontSize: 11.5,
                                                  whiteSpace: 'nowrap',
                                                  overflow: 'hidden',
                                                  textOverflow: 'ellipsis',
                                              }}
                                          >
                                              {item.description || item.categoryName}
                                          </div>

                                          <div
                                              style={{
                                                  marginTop: 4,
                                                  display: 'flex',
                                                  alignItems: 'center',
                                                  gap: 6,
                                                  color: 'color-mix(in srgb, var(--muted) 86%, var(--foreground))',
                                                  fontSize: 11,
                                              }}
                                          >
                                              <CalendarClock size={12.5} />
                                              {formatDueDate(item.nextDueAt)} · ngày định kỳ {String(item.dueDay).padStart(2, '0')}
                                          </div>
                                      </div>

                                      <div style={{ textAlign: 'right' }}>
                                          <div
                                              style={{
                                                  fontWeight: 900,
                                                  fontSize: 12.5,
                                                  color: visualStyle.amountColor,
                                                  whiteSpace: 'nowrap',
                                              }}
                                          >
                                              {formatCurrencyVND(item.amount)}
                                          </div>
                                      </div>
                                  </button>
                              );
                          })
                        : null}
                </AppCard>

                <PrimaryButton
                    onClick={() => {
                        setCreateCategoryId(expenseCategories[0]?.id || '');
                        setCreateDueDay('1');
                        setCreateAmount('');
                        setCreateDescription('');
                        setCreateTelegramChatId('');
                        setCreateError('');
                        setIsCreateModalOpen(true);
                    }}
                    style={{ justifyContent: 'center', minHeight: 44 }}
                >
                    <Plus size={16} /> Tạo nhắc lịch
                </PrimaryButton>
            </aside>

            {isCreateModalOpen ? (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 70,
                        background: 'rgba(2, 6, 23, 0.56)',
                        backdropFilter: 'blur(2px)',
                        display: 'grid',
                        placeItems: 'center',
                        padding: 16,
                    }}
                >
                    <AppCard strong style={{ width: 'min(100%, 380px)', padding: 16, borderRadius: 16, display: 'grid', gap: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                            <div>
                                <div style={{ fontSize: 15, fontWeight: 900 }}>Tạo nhắc lịch thanh toán</div>
                                <div style={{ marginTop: 3, color: 'var(--muted)', fontSize: 12.5 }}>Thiết lập khoản chi cố định theo tháng.</div>
                            </div>
                            <button
                                type="button"
                                onClick={resetCreateModal}
                                style={{
                                    width: 34,
                                    height: 34,
                                    borderRadius: 10,
                                    border: '1px solid var(--border)',
                                    background: 'var(--surface-soft)',
                                    color: 'var(--foreground)',
                                }}
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {createError ? (
                            <div style={{ color: '#ef4444', fontSize: 12, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)', borderRadius: 10, padding: '8px 10px' }}>
                                {createError}
                            </div>
                        ) : null}

                        <div style={{ display: 'grid', gap: 8 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>Danh mục chi tiêu</div>
                            <CustomSelect
                                value={createCategoryId}
                                onChange={setCreateCategoryId}
                                options={expenseCategories.map((category) => ({ value: category.id, label: category.name }))}
                                placeholder="Chọn danh mục"
                            />
                        </div>

                        <div style={{ display: 'grid', gap: 8 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>Số tiền</div>
                            <input
                                type="text"
                                inputMode="numeric"
                                value={
                                    createAmount
                                        ? new Intl.NumberFormat('vi-VN').format(parseInt(createAmount.replace(/\D/g, ''), 10) || 0)
                                        : ''
                                }
                                onChange={(event) => setCreateAmount(event.target.value.replace(/\D/g, ''))}
                                placeholder="0"
                                style={{
                                    padding: '10px 12px',
                                    borderRadius: 10,
                                    border: '1px solid var(--surface-border)',
                                    background: 'var(--surface-soft)',
                                    color: 'var(--foreground)',
                                    fontSize: 14,
                                }}
                            />
                        </div>

                        <div style={{ display: 'grid', gap: 8 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>Ngày định kỳ mỗi tháng</div>
                            <CustomSelect
                                value={createDueDay}
                                onChange={setCreateDueDay}
                                options={Array.from({ length: 31 }).map((_, index) => ({
                                    value: String(index + 1),
                                    label: `Ngày ${String(index + 1).padStart(2, '0')}`,
                                }))}
                            />
                        </div>

                        <div style={{ display: 'grid', gap: 8 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>Mô tả (tuỳ chọn)</div>
                            <input
                                type="text"
                                value={createDescription}
                                onChange={(event) => setCreateDescription(event.target.value)}
                                placeholder="Ví dụ: Thanh toán internet tháng"
                                style={{
                                    padding: '10px 12px',
                                    borderRadius: 10,
                                    border: '1px solid var(--surface-border)',
                                    background: 'var(--surface-soft)',
                                    color: 'var(--foreground)',
                                    fontSize: 14,
                                }}
                            />
                        </div>

                        {userTelegramChatId?.trim() ? (
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    borderRadius: 10,
                                    padding: '10px 12px',
                                    border: '1px solid color-mix(in srgb, #16a34a 48%, var(--surface-border))',
                                    background: 'color-mix(in srgb, #22c55e 10%, var(--surface-soft))',
                                    color: 'var(--foreground)',
                                    fontSize: 12.5,
                                    fontWeight: 700,
                                }}
                            >
                                <CheckCircle2 size={15} color="#16a34a" />
                                Telegram ID đã lưu trong hồ sơ người dùng.
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gap: 8 }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>Telegram chat id (tuỳ chọn)</div>
                                <input
                                    type="text"
                                    value={createTelegramChatId}
                                    onChange={(event) => setCreateTelegramChatId(event.target.value)}
                                    placeholder="Ví dụ: 123456789 hoặc -1001234567890"
                                    style={{
                                        padding: '10px 12px',
                                        borderRadius: 10,
                                        border: '1px solid var(--surface-border)',
                                        background: 'var(--surface-soft)',
                                        color: 'var(--foreground)',
                                        fontSize: 14,
                                    }}
                                />
                            </div>
                        )}

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                            <button
                                type="button"
                                onClick={resetCreateModal}
                                disabled={isCreating}
                                style={{
                                    minHeight: 42,
                                    borderRadius: 12,
                                    border: '1px solid var(--border)',
                                    background: 'transparent',
                                    color: 'var(--foreground)',
                                    fontWeight: 700,
                                }}
                            >
                                Hủy
                            </button>
                            <PrimaryButton onClick={submitCreateNotification} disabled={isCreating} style={{ justifyContent: 'center', minHeight: 42 }}>
                                {isCreating ? 'Đang tạo...' : 'Tạo nhắc lịch'}
                            </PrimaryButton>
                        </div>
                    </AppCard>
                </div>
            ) : null}

            {selectedNotification ? (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 71,
                        background: 'rgba(2, 6, 23, 0.56)',
                        backdropFilter: 'blur(2px)',
                        display: 'grid',
                        placeItems: 'center',
                        padding: 16,
                    }}
                >
                    <AppCard strong style={{ width: 'min(100%, 380px)', padding: 16, borderRadius: 16, display: 'grid', gap: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                            <div>
                                <div style={{ fontSize: 15, fontWeight: 900 }}>Bạn đã thanh toán khoản chi này?</div>
                                <div style={{ marginTop: 3, color: 'var(--muted)', fontSize: 12.5 }}>Xác nhận để tạo giao dịch chi tiêu tương ứng.</div>
                            </div>
                            <button
                                type="button"
                                onClick={closePayModal}
                                style={{
                                    width: 34,
                                    height: 34,
                                    borderRadius: 10,
                                    border: '1px solid var(--border)',
                                    background: 'var(--surface-soft)',
                                    color: 'var(--foreground)',
                                }}
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <div style={{ borderRadius: 12, border: '1px solid var(--surface-border)', background: 'var(--surface-soft)', padding: '12px 14px', display: 'grid', gap: 6 }}>
                            <div style={{ fontWeight: 800, fontSize: 14 }}>{selectedNotification.categoryName}</div>
                            <div style={{ color: 'var(--muted)', fontSize: 12 }}>{selectedNotification.description || selectedNotification.categoryName}</div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', fontSize: 12 }}>
                                <span style={{ color: 'var(--muted)' }}>Hạn tháng này: ngày {String(selectedNotification.dueDay).padStart(2, '0')}</span>
                                <span style={{ fontWeight: 800 }}>{formatCurrencyVND(selectedNotification.amount)}</span>
                            </div>
                        </div>

                        {payError ? (
                            <div style={{ color: '#ef4444', fontSize: 12, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)', borderRadius: 10, padding: '8px 10px' }}>
                                {payError}
                            </div>
                        ) : null}

                        <div style={{ display: 'grid', gap: 8 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>Chọn ví thanh toán</div>
                            <CustomSelect
                                value={payWalletId}
                                onChange={setPayWalletId}
                                options={wallets.map((wallet) => ({
                                    value: wallet.id,
                                    label: `${wallet.name} • ${formatCurrencyVND(wallet.balance)}`,
                                }))}
                                placeholder="Chọn ví"
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                            <button
                                type="button"
                                onClick={closePayModal}
                                disabled={isPaying}
                                style={{
                                    minHeight: 42,
                                    borderRadius: 12,
                                    border: '1px solid var(--border)',
                                    background: 'transparent',
                                    color: 'var(--foreground)',
                                    fontWeight: 700,
                                }}
                            >
                                Chưa thanh toán
                            </button>
                            <PrimaryButton onClick={submitPayNotification} disabled={isPaying} style={{ justifyContent: 'center', minHeight: 42 }}>
                                {isPaying ? <span>Đang thanh toán...</span> : <><CheckCircle2 size={16} /> Đã thanh toán</>}
                            </PrimaryButton>
                        </div>
                    </AppCard>
                </div>
            ) : null}
        </>
    );
}
