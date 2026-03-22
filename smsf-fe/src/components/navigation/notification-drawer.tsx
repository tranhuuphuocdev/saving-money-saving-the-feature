'use client';

import { BellRing, CalendarClock, Clock3, X } from 'lucide-react';
import { AppCard } from '@/components/common/app-card';
import { formatCurrencyVND } from '@/lib/formatters';
import { useLockBodyScroll } from '@/lib/ui/use-lock-body-scroll';

interface IRecurringExpenseItem {
    id: string;
    category: string;
    description: string;
    estimatedAmount: number;
    nextDueAt: number;
    remainingDays: number;
    frequencyLabel: string;
}

interface INotificationDrawerProps {
    isOpen: boolean;
    isLoading: boolean;
    items: IRecurringExpenseItem[];
    onClose: () => void;
}

function formatDueDate(timestamp: number): string {
    const date = new Date(timestamp);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
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

export function NotificationDrawer({ isOpen, isLoading, items, onClose }: INotificationDrawerProps) {
    useLockBodyScroll(isOpen);

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
                    width: 'min(88vw, 380px)',
                    padding: 16,
                    background: 'var(--surface-strong)',
                    borderLeft: '1px solid var(--border)',
                    transform: isOpen ? 'translateX(0)' : 'translateX(104%)',
                    transition: 'transform 0.26s ease',
                    zIndex: 45,
                    boxShadow: '0 24px 80px rgba(0,0,0,0.35)',
                    display: 'grid',
                    gridTemplateRows: 'auto 1fr',
                    gap: 14,
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <div style={{ color: 'var(--muted)', fontSize: 12 }}>Thông báo định kỳ</div>
                        <div style={{ marginTop: 3, fontSize: 18, fontWeight: 900 }}>Sắp tới hạn chi tiêu</div>
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

                    {!isLoading && items.length === 0 ? (
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
                            Chưa có mục chi tiêu định kỳ sắp tới hạn.
                        </div>
                    ) : null}

                    {!isLoading
                        ? items.map((item) => (
                              <div
                                  key={item.id}
                                  style={{
                                      display: 'grid',
                                      gridTemplateColumns: '1fr auto',
                                      gap: 10,
                                      padding: '11px 12px',
                                      borderRadius: 14,
                                      border: '1px solid var(--surface-border)',
                                      background: 'var(--surface-soft)',
                                      alignItems: 'center',
                                  }}
                              >
                                  <div style={{ minWidth: 0 }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 800, fontSize: 12.5 }}>
                                              <BellRing size={12} color="var(--accent)" />
                                              {item.category}
                                          </span>
                                      <span
                                          style={{
                                              borderRadius: 999,
                                              padding: '3px 7px',
                                              fontSize: 10,
                                              fontWeight: 800,
                                              color: item.remainingDays < 0 ? '#b91c1c' : 'var(--accent-text)',
                                              background: item.remainingDays < 0 ? 'rgba(239,68,68,0.12)' : 'var(--chip-bg)',
                                          }}
                                      >
                                          {getDueBadgeLabel(item.remainingDays)}
                                      </span>
                                  </div>

                                      <div
                                          style={{
                                              marginTop: 4,
                                              color: 'var(--muted)',
                                              fontSize: 11.5,
                                              whiteSpace: 'nowrap',
                                              overflow: 'hidden',
                                              textOverflow: 'ellipsis',
                                          }}
                                      >
                                          {item.description}
                                      </div>

                                      <div
                                          style={{
                                              marginTop: 4,
                                              display: 'flex',
                                              alignItems: 'center',
                                              gap: 6,
                                              color: 'var(--muted)',
                                              fontSize: 11,
                                          }}
                                      >
                                          <CalendarClock size={12.5} />
                                          {formatDueDate(item.nextDueAt)} · {item.frequencyLabel}
                                      </div>
                                  </div>

                                  <div style={{ textAlign: 'right' }}>
                                      <div
                                          style={{
                                              fontWeight: 900,
                                              fontSize: 12.5,
                                              color: item.remainingDays < 0 ? '#dc2626' : 'var(--accent-text)',
                                              whiteSpace: 'nowrap',
                                          }}
                                      >
                                          {formatCurrencyVND(item.estimatedAmount)}
                                      </div>
                                  </div>
                              </div>
                          ))
                        : null}
                </AppCard>
            </aside>
        </>
    );
}