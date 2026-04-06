'use client';

import { useEffect, useMemo, useState } from 'react';
import { CircleDollarSign, Plus, SlidersHorizontal, Sparkles, Trash2, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { AppCard } from '@/components/common/app-card';
import { PrimaryButton } from '@/components/common/primary-button';
import { formatCurrencyVND } from '@/lib/formatters';
import { useLockBodyScroll } from '@/lib/ui/use-lock-body-scroll';
import {
    getBudgetJarSuggestionsRequest,
    setupBudgetJarsRequest,
} from '@/lib/calendar/api';
import { ICategoryItem } from '@/types/calendar';
import { IBudgetJarItem, IBudgetJarPreset } from '@/types/dashboard';

interface ICalendarBudgetJarsProps {
    month: number;
    year: number;
    totalIncome: number;
    categories: ICategoryItem[];
    jars: IBudgetJarItem[];
    onJarsChanged: () => Promise<void>;
}

type TSetupJarItem = {
    name: string;
    targetPercent: number;
    targetAmount: number;
    categoryIds: string[];
};

const clamp = (value: number, min: number, max: number): number => {
    return Math.min(max, Math.max(min, value));
};

export function CalendarBudgetJars({
    month,
    year,
    totalIncome,
    categories,
    jars,
    onJarsChanged,
}: ICalendarBudgetJarsProps) {
    const [isOpenSetup, setIsOpenSetup] = useState(false);
    const [suggestions, setSuggestions] = useState<IBudgetJarPreset[]>([]);
    const [activePresetCode, setActivePresetCode] = useState('');
    const [incomeInput, setIncomeInput] = useState('');
    const [setupItems, setSetupItems] = useState<TSetupJarItem[]>([]);
    const [pickerBudgetIndex, setPickerBudgetIndex] = useState<number | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isClearingAllJars, setIsClearingAllJars] = useState(false);
    const [isClearAllConfirmOpen, setIsClearAllConfirmOpen] = useState(false);
    const [deleteSetupItemIndex, setDeleteSetupItemIndex] = useState<number | null>(null);
    const [isMounted, setIsMounted] = useState(false);

    useLockBodyScroll(
        isOpenSetup
        || pickerBudgetIndex !== null
        || isClearAllConfirmOpen
        || deleteSetupItemIndex !== null,
    );

    useEffect(() => {
        setIsMounted(true);
    }, []);

    const expenseCategories = useMemo(
        () => categories.filter((item) => item.type === 'expense'),
        [categories],
    );

    useEffect(() => {
        if (!isOpenSetup) {
            return;
        }

        let ignore = false;

        async function loadSuggestions() {
            const result = await getBudgetJarSuggestionsRequest(
                Number(incomeInput.replace(/\D/g, '')) > 0
                    ? { incomeAmount: Number(incomeInput.replace(/\D/g, '')) }
                    : undefined,
            );

            if (!ignore) {
                setSuggestions(result);
                if (!activePresetCode && result.length > 0) {
                    setActivePresetCode(result[0].code);
                }
            }
        }

        void loadSuggestions();

        return () => {
            ignore = true;
        };
    }, [activePresetCode, incomeInput, isOpenSetup]);

    const sortedJars = useMemo(() => {
        return [...jars].sort((left, right) => {
            if (right.spentAmount !== left.spentAmount) {
                return right.spentAmount - left.spentAmount;
            }

            return right.progressPercent - left.progressPercent;
        });
    }, [jars]);

    const jarSummary = useMemo(() => {
        return jars.reduce(
            (summary, jar) => {
                summary.totalTargetAmount += jar.targetAmount;
                summary.totalSpentAmount += jar.spentAmount;
                return summary;
            },
            {
                totalTargetAmount: 0,
                totalSpentAmount: 0,
            },
        );
    }, [jars]);

    const activePreset = useMemo(() => {
        return suggestions.find((item) => item.code === activePresetCode) || suggestions[0];
    }, [activePresetCode, suggestions]);

    useEffect(() => {
        if (!activePreset) {
            return;
        }

        const normalizedIncome = Number(incomeInput.replace(/\D/g, '')) || totalIncome || 0;
        const nextItems: TSetupJarItem[] = activePreset.items.map((item) => {
            const categoryIds = item.categoryNames
                .map((name) => {
                    const matched = expenseCategories.find(
                        (category) => category.name.trim().toLowerCase() === name.trim().toLowerCase(),
                    );

                    return matched?.id || '';
                })
                .filter(Boolean);

            const targetAmount =
                item.targetAmount && item.targetAmount > 0
                    ? item.targetAmount
                    : normalizedIncome > 0
                      ? Math.round((normalizedIncome * item.targetPercent) / 100)
                      : 0;

            return {
                name: item.name,
                targetPercent: item.targetPercent,
                targetAmount,
                categoryIds,
            };
        });

        setSetupItems(nextItems);
    }, [activePresetCode, expenseCategories]);

    const totalTargetAmount = useMemo(
        () => setupItems.reduce((sum, item) => sum + item.targetAmount, 0),
        [setupItems],
    );

    const overBudget = useMemo(() => {
        const normalizedIncome = Number(incomeInput.replace(/\D/g, '')) || totalIncome || 0;
        return normalizedIncome > 0 && totalTargetAmount > normalizedIncome;
    }, [incomeInput, totalIncome, totalTargetAmount]);

    const categoryById = useMemo(() => {
        return expenseCategories.reduce<Record<string, ICategoryItem>>((acc, item) => {
            acc[item.id] = item;
            return acc;
        }, {});
    }, [expenseCategories]);

    const setupIncomeAmount = useMemo(() => {
        return Number(incomeInput.replace(/\D/g, '')) || totalIncome || 0;
    }, [incomeInput, totalIncome]);

    const setupPlannedPercent = useMemo(() => {
        if (setupIncomeAmount <= 0) {
            return 0;
        }

        return clamp((totalTargetAmount / setupIncomeAmount) * 100, 0, 200);
    }, [setupIncomeAmount, totalTargetAmount]);

    const pickerBudget =
        pickerBudgetIndex !== null ? setupItems[pickerBudgetIndex] : undefined;

    function addCustomBudget() {
        setSetupItems((prev) => [
            ...prev,
            {
                name: `Hũ mới ${prev.length + 1}`,
                targetPercent: 5,
                targetAmount: 0,
                categoryIds: [],
            },
        ]);
    }

    async function handleSubmitSetup() {
        setIsSubmitting(true);

        try {
            const payload = {
                month,
                year,
                incomeAmount: Number(incomeInput.replace(/\D/g, '')) || undefined,
                jars: setupItems
                    .filter((item) => item.name.trim() && item.categoryIds.length > 0)
                    .map((item) => ({
                        name: item.name,
                        targetAmount: item.targetAmount,
                        targetPercent: item.targetPercent,
                        categoryIds: item.categoryIds,
                    })),
            };

            await setupBudgetJarsRequest(payload);
            await onJarsChanged();
            setIsOpenSetup(false);
        } finally {
            setIsSubmitting(false);
        }
    }

    async function handleClearAllJars() {
        setIsClearingAllJars(true);
        try {
            await setupBudgetJarsRequest({
                month,
                year,
                jars: [],
            });
            await onJarsChanged();
            setIsOpenSetup(false);
        } finally {
            setIsClearingAllJars(false);
        }
    }

    function handleRequestDeleteSetupItem(index: number) {
        setDeleteSetupItemIndex(index);
    }

    function handleConfirmDeleteSetupItem() {
        if (deleteSetupItemIndex === null) {
            return;
        }

        setSetupItems((prev) => prev.filter((_, currentIndex) => currentIndex !== deleteSetupItemIndex));
        setDeleteSetupItemIndex(null);
    }

    return (
        <div style={{ display: 'grid', gap: 12, marginTop: 14 }}>
            <AppCard style={{ padding: 12, display: 'grid', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <div>
                        <div style={{ fontSize: 13.5, fontWeight: 900 }}>Hũ chi tiêu tháng {String(month).padStart(2, '0')}/{year}</div>
                        <div style={{ color: 'var(--muted)', fontSize: 11, marginTop: 2 }}>
                            Theo dõi đã dùng / tổng ngân sách từng hũ.
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => setIsOpenSetup(true)}
                        style={{
                            borderRadius: 10,
                            border: '1px solid var(--chip-border)',
                            background: 'var(--chip-bg)',
                            padding: '8px 10px',
                            color: 'var(--foreground)',
                            fontWeight: 800,
                            fontSize: 11.5,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                        }}
                    >
                        <SlidersHorizontal size={13} /> Thiết lập hũ
                    </button>
                </div>

                {jars.length > 0 ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
                        <div
                            style={{
                                borderRadius: 10,
                                border: '1px solid var(--surface-border)',
                                background: 'var(--surface-soft)',
                                padding: '8px 10px',
                            }}
                        >
                            <div style={{ color: 'var(--muted)', fontSize: 10.5 }}>Tổng tiền đã tiêu</div>
                            <div style={{ fontSize: 12.5, fontWeight: 900, marginTop: 2 }}>
                                {formatCurrencyVND(jarSummary.totalSpentAmount)}
                            </div>
                        </div>
                        <div
                            style={{
                                borderRadius: 10,
                                border: '1px solid var(--surface-border)',
                                background: 'var(--surface-soft)',
                                padding: '8px 10px',
                            }}
                        >
                            <div style={{ color: 'var(--muted)', fontSize: 10.5 }}>Tổng tiền hũ</div>
                            <div style={{ fontSize: 12.5, fontWeight: 900, marginTop: 2 }}>
                                {formatCurrencyVND(jarSummary.totalTargetAmount)}
                            </div>
                        </div>
                    </div>
                ) : null}

                {jars.length === 0 ? (
                    <div
                        style={{
                            borderRadius: 12,
                            border: '1px dashed var(--chip-border)',
                            background: 'var(--surface-soft)',
                            padding: 10,
                            fontSize: 11.5,
                            color: 'var(--muted)',
                        }}
                    >
                        Tháng này chưa có hũ chi tiêu. Nhấn "Thiết lập hũ tháng này" để tạo theo mẫu đề xuất hoặc tự chỉnh.
                    </div>
                ) : (
                    <div style={{ display: 'grid', gap: 8 }}>
                        {sortedJars.map((jar) => {
                            const clamped = clamp(jar.progressPercent, 0, 140);
                            const danger = clamped > 100;
                            const categoryIcons = jar.categoryIds
                                .slice(0, 4)
                                .map((categoryId) => categoryById[categoryId]?.icon || '🧩');

                            return (
                                <div
                                    key={jar.id}
                                    style={{
                                        borderRadius: 12,
                                        border: '1px solid var(--surface-border)',
                                        background: 'var(--surface-soft)',
                                        padding: 9,
                                        display: 'grid',
                                        gap: 6,
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                                        <div>
                                            <div style={{ fontSize: 12.5, fontWeight: 800 }}>{jar.name}</div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                                                {categoryIcons.map((icon, index) => (
                                                    <span
                                                        key={`${jar.id}-icon-${index}`}
                                                        style={{
                                                            width: 18,
                                                            height: 18,
                                                            borderRadius: 6,
                                                            display: 'grid',
                                                            placeItems: 'center',
                                                            fontSize: 11,
                                                            background: 'var(--chip-bg)',
                                                            border: '1px solid var(--chip-border)',
                                                        }}
                                                    >
                                                        {icon}
                                                    </span>
                                                ))}
                                                <span style={{ fontSize: 10.5, color: 'var(--muted)' }}>
                                                    {jar.categoryNames.length} danh mục
                                                </span>
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontSize: 12, fontWeight: 900 }}>
                                                {formatCurrencyVND(jar.spentAmount)} / {formatCurrencyVND(jar.targetAmount)}
                                            </div>
                                            <div style={{ fontSize: 10.5, color: danger ? '#ef4444' : '#10b981' }}>
                                                {jar.progressPercent.toFixed(1)}%
                                            </div>
                                        </div>
                                    </div>

                                    <div
                                        style={{
                                            position: 'relative',
                                            overflow: 'hidden',
                                            borderRadius: 999,
                                            height: 9,
                                            background: 'color-mix(in srgb, var(--chip-bg) 70%, transparent)',
                                            border: '1px solid var(--chip-border)',
                                        }}
                                    >
                                        <div
                                            className="budget-jar-progress"
                                            style={{
                                                width: `${clamp(clamped, 0, 100)}%`,
                                                height: '100%',
                                                borderRadius: 999,
                                                background: danger
                                                    ? 'linear-gradient(90deg, #f97316, #ef4444)'
                                                    : 'linear-gradient(90deg, #06b6d4, #10b981)',
                                                transition: 'width 420ms cubic-bezier(0.22, 1, 0.36, 1)',
                                            }}
                                        />
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 10.5 }}>
                                        <span style={{ color: 'var(--muted)' }}>Còn lại</span>
                                        <span style={{ color: jar.remainingAmount >= 0 ? '#10b981' : '#ef4444', fontWeight: 800 }}>
                                            {formatCurrencyVND(jar.remainingAmount)}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </AppCard>

            {isMounted && isOpenSetup
                ? createPortal(
                      <div
                          style={{
                              position: 'fixed',
                              inset: 0,
                              zIndex: 70,
                              background: 'rgba(2, 6, 23, 0.52)',
                              backdropFilter: 'blur(2px)',
                              display: 'grid',
                              placeItems: 'center',
                              padding: 8,
                          }}
                      >
                          <AppCard
                              strong
                              style={{
                                  width: 'min(100%, 760px)',
                                  height: 'min(100dvh - 16px, 800px)',
                                  padding: 12,
                                  borderRadius: 14,
                                  display: 'grid',
                                  gridTemplateRows: 'auto minmax(0, 1fr) auto',
                                  gap: 10,
                                  overflow: 'hidden',
                              }}
                          >
                              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, flexShrink: 0 }}>
                                  <div>
                                      <div style={{ fontWeight: 900, fontSize: 14 }}>Thiết lập hũ chi tiêu</div>
                                      <div style={{ color: 'var(--muted)', fontSize: 11, marginTop: 3 }}>
                                          Chọn mẫu theo mức thu nhập rồi tinh chỉnh % hoặc số tiền cho từng hũ.
                                      </div>
                                  </div>
                                  <button
                                      type="button"
                                      onClick={() => setIsOpenSetup(false)}
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

                              <div style={{ display: 'grid', gap: 10, minHeight: 0, overflowY: 'auto', paddingRight: 2 }}>
                                  <label style={{ display: 'grid', gap: 6 }}>
                                      <span style={{ color: 'var(--muted)', fontSize: 11 }}>Thu nhập tháng (để auto tính tiền theo %)</span>
                                      <input
                                          type="text"
                                          inputMode="numeric"
                                          value={incomeInput ? new Intl.NumberFormat('vi-VN').format(Number(incomeInput)) : ''}
                                          onChange={(event) => setIncomeInput(event.target.value.replace(/\D/g, ''))}
                                          placeholder={totalIncome > 0 ? `Gợi ý theo thu tháng hiện tại: ${formatCurrencyVND(totalIncome)}` : 'Ví dụ: 15000000'}
                                          style={{
                                              borderRadius: 10,
                                              border: '1px solid var(--surface-border)',
                                              background: 'var(--background)',
                                              color: 'var(--foreground)',
                                              padding: '8px 10px',
                                              fontSize: 12,
                                          }}
                                      />
                                  </label>

                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 8 }}>
                                      {suggestions.map((preset) => (
                                          <button
                                              key={preset.code}
                                              type="button"
                                              onClick={() => setActivePresetCode(preset.code)}
                                              style={{
                                                  textAlign: 'left',
                                                  borderRadius: 12,
                                                  border: activePreset?.code === preset.code ? '1px solid var(--chip-border)' : '1px solid var(--surface-border)',
                                                  background: activePreset?.code === preset.code ? 'var(--chip-bg)' : 'var(--surface-soft)',
                                                  color: 'var(--foreground)',
                                                  padding: '8px 10px',
                                              }}
                                          >
                                              <div style={{ fontWeight: 800, fontSize: 12 }}>{preset.label}</div>
                                              <div style={{ color: 'var(--muted)', fontSize: 10.5, marginTop: 2 }}>{preset.incomeHint}</div>
                                          </button>
                                      ))}
                                  </div>

                                  <div
                                      style={{
                                          borderRadius: 12,
                                          border: overBudget ? '1px solid rgba(239, 68, 68, 0.55)' : '1px solid var(--surface-border)',
                                          background: overBudget
                                              ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.14), rgba(248, 113, 113, 0.04))'
                                              : 'linear-gradient(135deg, color-mix(in srgb, var(--chip-bg) 78%, transparent), color-mix(in srgb, var(--surface-soft) 82%, transparent))',
                                          padding: 10,
                                          display: 'grid',
                                          gap: 8,
                                      }}
                                  >
                                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                                              <Sparkles size={13} color="var(--accent)" />
                                              <span style={{ fontSize: 11.5, fontWeight: 800 }}>Tổng ngân sách hũ</span>
                                          </div>
                                          <div style={{ fontSize: 12, fontWeight: 900 }}>{formatCurrencyVND(totalTargetAmount)}</div>
                                      </div>
                                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                                          <div style={{ borderRadius: 9, border: '1px solid var(--surface-border)', background: 'var(--background)', padding: '6px 8px' }}>
                                              <div style={{ color: 'var(--muted)', fontSize: 10.5 }}>Thu nhập chuẩn</div>
                                              <div style={{ fontWeight: 800, fontSize: 11.5, marginTop: 2 }}>
                                                  {setupIncomeAmount > 0 ? formatCurrencyVND(setupIncomeAmount) : 'Chưa nhập'}
                                              </div>
                                          </div>
                                          <div style={{ borderRadius: 9, border: '1px solid var(--surface-border)', background: 'var(--background)', padding: '6px 8px' }}>
                                              <div style={{ color: 'var(--muted)', fontSize: 10.5 }}>Tỉ lệ phân bổ</div>
                                              <div style={{ fontWeight: 800, fontSize: 11.5, marginTop: 2 }}>{setupPlannedPercent.toFixed(1)}%</div>
                                          </div>
                                      </div>
                                      <div
                                          style={{
                                              position: 'relative',
                                              overflow: 'hidden',
                                              borderRadius: 999,
                                              height: 8,
                                              background: 'color-mix(in srgb, var(--chip-bg) 65%, transparent)',
                                              border: '1px solid var(--chip-border)',
                                          }}
                                      >
                                          <div
                                              style={{
                                                  width: `${clamp(setupPlannedPercent, 0, 100)}%`,
                                                  height: '100%',
                                                  borderRadius: 999,
                                                  background: overBudget
                                                      ? 'linear-gradient(90deg, #fb923c, #ef4444)'
                                                      : 'linear-gradient(90deg, #22c55e, #06b6d4)',
                                              }}
                                          />
                                      </div>
                                      {overBudget ? (
                                          <div style={{ color: '#ef4444', fontSize: 10.5, fontWeight: 700 }}>
                                              Tổng hũ đang vượt mức thu nhập đã nhập.
                                          </div>
                                      ) : null}
                                  </div>

                                  <div style={{ display: 'grid', gap: 8 }}>
                                      {setupItems.map((item, index) => {
                                          const pickedIcons = item.categoryIds
                                              .slice(0, 4)
                                              .map((categoryId) => categoryById[categoryId]?.icon || '🧩');

                                          return (
                                              <div
                                                  key={index}
                                                  style={{
                                                      borderRadius: 10,
                                                      border: '1px solid var(--surface-border)',
                                                      background: 'var(--surface-soft)',
                                                      padding: 8,
                                                      display: 'grid',
                                                      gap: 6,
                                                  }}
                                              >
                                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                                                      <input
                                                          value={item.name}
                                                          onChange={(event) => {
                                                              const nextName = event.target.value;
                                                              setSetupItems((prev) =>
                                                                  prev.map((current, currentIndex) =>
                                                                      currentIndex === index
                                                                          ? { ...current, name: nextName }
                                                                          : current,
                                                                  ),
                                                              );
                                                          }}
                                                          style={{
                                                              flex: 1,
                                                              borderRadius: 8,
                                                              border: '1px solid var(--surface-border)',
                                                              background: 'var(--background)',
                                                              color: 'var(--foreground)',
                                                              fontSize: 11.5,
                                                              padding: '6px 8px',
                                                              minWidth: 0,
                                                          }}
                                                      />
                                                      <div style={{ color: 'var(--muted)', fontSize: 10.5, whiteSpace: 'nowrap' }}>{item.targetPercent.toFixed(0)}%</div>
                                                      <button
                                                          type="button"
                                                          onClick={() => handleRequestDeleteSetupItem(index)}
                                                          style={{
                                                              width: 26,
                                                              height: 26,
                                                              borderRadius: 8,
                                                              border: '1px solid var(--surface-border)',
                                                              background: 'transparent',
                                                              color: 'var(--muted)',
                                                          }}
                                                      >
                                                          <Trash2 size={12} />
                                                      </button>
                                                  </div>

                                                  <input
                                                      type="range"
                                                      min={0}
                                                      max={80}
                                                      step={1}
                                                      value={item.targetPercent}
                                                      onChange={(event) => {
                                                          const nextPercent = clamp(Number(event.target.value), 0, 80);
                                                          const baseIncome = Number(incomeInput.replace(/\D/g, '')) || totalIncome || 0;

                                                          setSetupItems((prev) =>
                                                              prev.map((current, currentIndex) =>
                                                                  currentIndex === index
                                                                      ? {
                                                                            ...current,
                                                                            targetPercent: nextPercent,
                                                                            targetAmount:
                                                                                baseIncome > 0
                                                                                    ? Math.round((baseIncome * nextPercent) / 100)
                                                                                    : current.targetAmount,
                                                                        }
                                                                      : current,
                                                              ),
                                                          );
                                                      }}
                                                  />

                                                  <label style={{ display: 'grid', gap: 4 }}>
                                                      <span style={{ color: 'var(--muted)', fontSize: 10.5 }}>Số tiền mục tiêu</span>
                                                      <input
                                                          type="text"
                                                          inputMode="numeric"
                                                          value={new Intl.NumberFormat('vi-VN').format(item.targetAmount)}
                                                          onChange={(event) => {
                                                              const nextAmount = Number(event.target.value.replace(/\D/g, '')) || 0;
                                                              const baseIncome = Number(incomeInput.replace(/\D/g, '')) || totalIncome || 0;
                                                              const nextPercent = baseIncome > 0 ? (nextAmount / baseIncome) * 100 : item.targetPercent;

                                                              setSetupItems((prev) =>
                                                                  prev.map((current, currentIndex) =>
                                                                      currentIndex === index
                                                                          ? {
                                                                                ...current,
                                                                                targetAmount: nextAmount,
                                                                                targetPercent: clamp(nextPercent, 0, 200),
                                                                            }
                                                                          : current,
                                                                  ),
                                                              );
                                                          }}
                                                          style={{
                                                              borderRadius: 8,
                                                              border: '1px solid var(--surface-border)',
                                                              background: 'var(--background)',
                                                              color: 'var(--foreground)',
                                                              padding: '7px 9px',
                                                              fontSize: 11.5,
                                                          }}
                                                      />
                                                  </label>

                                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                                                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                                          {pickedIcons.map((icon, iconIndex) => (
                                                              <span
                                                                  key={`${item.name}-picked-${iconIndex}`}
                                                                  style={{
                                                                      width: 18,
                                                                      height: 18,
                                                                      borderRadius: 6,
                                                                      display: 'grid',
                                                                      placeItems: 'center',
                                                                      fontSize: 11,
                                                                      background: 'var(--chip-bg)',
                                                                      border: '1px solid var(--chip-border)',
                                                                  }}
                                                              >
                                                                  {icon}
                                                              </span>
                                                          ))}
                                                          <span style={{ color: 'var(--muted)', fontSize: 10.5 }}>
                                                              {item.categoryIds.length} danh mục
                                                          </span>
                                                      </div>
                                                      <button
                                                          type="button"
                                                          onClick={() => setPickerBudgetIndex(index)}
                                                          style={{
                                                              borderRadius: 8,
                                                              border: '1px solid var(--chip-border)',
                                                              background: 'var(--chip-bg)',
                                                              color: 'var(--foreground)',
                                                              padding: '5px 8px',
                                                              fontSize: 10.5,
                                                              fontWeight: 700,
                                                          }}
                                                      >
                                                        + Thêm
                                                      </button>
                                                  </div>
                                              </div>
                                          );
                                      })}
                                  </div>
                              </div>

                              <div
                                  style={{
                                      flexShrink: 0,
                                      borderTop: '1px solid var(--surface-border)',
                                      paddingTop: 10,
                                      display: 'grid',
                                      gridTemplateColumns: '1fr auto auto auto',
                                      alignItems: 'center',
                                      gap: 8,
                                  }}
                              >
                                  <button
                                      type="button"
                                      onClick={addCustomBudget}
                                      style={{
                                          justifySelf: 'start',
                                          borderRadius: 10,
                                          border: '1px dashed var(--chip-border)',
                                          background: 'transparent',
                                          color: 'var(--foreground)',
                                          padding: '7px 10px',
                                          fontSize: 11,
                                          fontWeight: 800,
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: 5,
                                      }}
                                  >
                                      <Plus size={13} /> Thêm hũ
                                  </button>

                                  <button
                                      type="button"
                                      onClick={() => setIsClearAllConfirmOpen(true)}
                                      disabled={isSubmitting || isClearingAllJars}
                                      style={{
                                          borderRadius: 12,
                                          border: '1px solid rgba(239, 68, 68, 0.45)',
                                          background: 'rgba(239, 68, 68, 0.08)',
                                          color: '#ef4444',
                                          fontWeight: 700,
                                          padding: '9px 12px',
                                          opacity: isSubmitting || isClearingAllJars ? 0.6 : 1,
                                      }}
                                  >
                                      {isClearingAllJars ? 'Đang xóa...' : 'Xóa toàn bộ hũ'}
                                  </button>

                                  <button
                                      type="button"
                                      onClick={() => setIsOpenSetup(false)}
                                      style={{
                                          borderRadius: 12,
                                          border: '1px solid var(--surface-border)',
                                          background: 'transparent',
                                          color: 'var(--foreground)',
                                          fontWeight: 700,
                                          padding: '9px 12px',
                                      }}
                                  >
                                      Hủy
                                  </button>
                                  <PrimaryButton
                                      onClick={() => void handleSubmitSetup()}
                                      disabled={isSubmitting || isClearingAllJars || setupItems.length === 0}
                                      style={{
                                          opacity: isSubmitting || isClearingAllJars || setupItems.length === 0 ? 0.6 : 1,
                                          padding: '9px 12px',
                                          borderRadius: 12,
                                      }}
                                  >
                                      <CircleDollarSign size={14} />
                                      {isSubmitting ? 'Đang lưu...' : 'Lưu thiết lập hũ'}
                                  </PrimaryButton>
                              </div>
                          </AppCard>
                      </div>,
                      document.body,
                  )
                : null}

            {isMounted && isClearAllConfirmOpen
                ? createPortal(
                      <div
                          style={{
                              position: 'fixed',
                              inset: 0,
                              zIndex: 90,
                              background: 'rgba(2, 6, 23, 0.56)',
                              backdropFilter: 'blur(2px)',
                              display: 'grid',
                              placeItems: 'center',
                              padding: 10,
                          }}
                      >
                          <AppCard
                              strong
                              style={{
                                  width: 'min(100%, 420px)',
                                  borderRadius: 14,
                                  padding: 14,
                                  display: 'grid',
                                  gap: 10,
                              }}
                          >
                              <div style={{ fontSize: 15, fontWeight: 900 }}>Xóa toàn bộ hũ?</div>
                              <div style={{ color: 'var(--muted)', fontSize: 12.5, lineHeight: 1.6 }}>
                                  Hành động này sẽ xóa toàn bộ thiết lập hũ của tháng hiện tại.
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                                  <button
                                      type="button"
                                      onClick={() => setIsClearAllConfirmOpen(false)}
                                      disabled={isClearingAllJars}
                                      style={{
                                          borderRadius: 10,
                                          border: '1px solid var(--surface-border)',
                                          background: 'transparent',
                                          color: 'var(--foreground)',
                                          fontWeight: 700,
                                          padding: '8px 12px',
                                      }}
                                  >
                                      Hủy
                                  </button>
                                  <button
                                      type="button"
                                      onClick={() => void handleClearAllJars()}
                                      disabled={isClearingAllJars}
                                      style={{
                                          borderRadius: 10,
                                          border: '1px solid rgba(239, 68, 68, 0.45)',
                                          background: 'rgba(239, 68, 68, 0.1)',
                                          color: '#ef4444',
                                          fontWeight: 800,
                                          padding: '8px 12px',
                                          opacity: isClearingAllJars ? 0.6 : 1,
                                      }}
                                  >
                                      {isClearingAllJars ? 'Đang xóa...' : 'Xóa hết'}
                                  </button>
                              </div>
                          </AppCard>
                      </div>,
                      document.body,
                  )
                : null}

            {isMounted && deleteSetupItemIndex !== null
                ? createPortal(
                      <div
                          style={{
                              position: 'fixed',
                              inset: 0,
                              zIndex: 91,
                              background: 'rgba(2, 6, 23, 0.56)',
                              backdropFilter: 'blur(2px)',
                              display: 'grid',
                              placeItems: 'center',
                              padding: 10,
                          }}
                      >
                          <AppCard
                              strong
                              style={{
                                  width: 'min(100%, 420px)',
                                  borderRadius: 14,
                                  padding: 14,
                                  display: 'grid',
                                  gap: 10,
                              }}
                          >
                              <div style={{ fontSize: 15, fontWeight: 900 }}>Xóa hũ này?</div>
                              <div style={{ color: 'var(--muted)', fontSize: 12.5, lineHeight: 1.6 }}>
                                  Hũ sẽ bị xóa khỏi thiết lập hiện tại.
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                                  <button
                                      type="button"
                                      onClick={() => setDeleteSetupItemIndex(null)}
                                      style={{
                                          borderRadius: 10,
                                          border: '1px solid var(--surface-border)',
                                          background: 'transparent',
                                          color: 'var(--foreground)',
                                          fontWeight: 700,
                                          padding: '8px 12px',
                                      }}
                                  >
                                      Hủy
                                  </button>
                                  <button
                                      type="button"
                                      onClick={handleConfirmDeleteSetupItem}
                                      style={{
                                          borderRadius: 10,
                                          border: '1px solid rgba(239, 68, 68, 0.45)',
                                          background: 'rgba(239, 68, 68, 0.1)',
                                          color: '#ef4444',
                                          fontWeight: 800,
                                          padding: '8px 12px',
                                      }}
                                  >
                                      Xóa hũ
                                  </button>
                              </div>
                          </AppCard>
                      </div>,
                      document.body,
                  )
                : null}

            {isMounted && pickerBudgetIndex !== null && pickerBudget
                ? createPortal(
                      <div
                          style={{
                              position: 'fixed',
                              inset: 0,
                              zIndex: 80,
                              background: 'rgba(2, 6, 23, 0.5)',
                              backdropFilter: 'blur(2px)',
                              display: 'grid',
                              placeItems: 'center',
                              padding: 10,
                          }}
                      >
                          <AppCard
                              strong
                              style={{
                                  width: 'min(100%, 430px)',
                                  height: 'min(74dvh, 520px)',
                                  borderRadius: 14,
                                  padding: 10,
                                  display: 'grid',
                                  gridTemplateRows: 'auto minmax(0, 1fr) auto',
                                  gap: 8,
                                  overflow: 'hidden',
                              }}
                          >
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexShrink: 0 }}>
                                  <div>
                                      <div style={{ fontWeight: 900, fontSize: 13.5 }}>Chọn category cho {pickerBudget.name}</div>
                                      <div style={{ color: 'var(--muted)', fontSize: 10.5 }}>Chọn ít nhất 1 danh mục cho budget.</div>
                                  </div>
                                  <button
                                      type="button"
                                      onClick={() => setPickerBudgetIndex(null)}
                                      style={{
                                          width: 30,
                                          height: 30,
                                          borderRadius: 8,
                                          border: '1px solid var(--surface-border)',
                                          background: 'transparent',
                                          color: 'var(--foreground)',
                                      }}
                                  >
                                      <X size={14} />
                                  </button>
                              </div>

                              <div
                                  style={{
                                      minHeight: 0,
                                      overflowY: 'auto',
                                      display: 'grid',
                                      gridTemplateColumns: 'repeat(auto-fill, minmax(82px, 1fr))',
                                      gap: 6,
                                      paddingRight: 2,
                                  }}
                              >
                                  {expenseCategories.map((category) => {
                                      const checked = pickerBudget.categoryIds.includes(category.id);
                                      const icon = category.icon || '🧩';

                                      return (
                                          <button
                                              key={category.id}
                                              type="button"
                                              onClick={() => {
                                                  setSetupItems((prev) =>
                                                      prev.map((item, index) => {
                                                          if (index !== pickerBudgetIndex) {
                                                              return item;
                                                          }

                                                          const nextCategoryIds = checked
                                                              ? item.categoryIds.filter((id) => id !== category.id)
                                                              : [...item.categoryIds, category.id];

                                                          return { ...item, categoryIds: nextCategoryIds };
                                                      }),
                                                  );
                                              }}
                                              style={{
                                                  borderRadius: 12,
                                                  border: checked ? '1px solid var(--chip-border)' : '1px solid var(--surface-border)',
                                                  background: checked ? 'var(--chip-bg)' : 'var(--surface-soft)',
                                                  color: 'var(--foreground)',
                                                  display: 'grid',
                                                  placeItems: 'center',
                                                  gap: 4,
                                                  aspectRatio: '1 / 1',
                                                  padding: 6,
                                                  textAlign: 'center',
                                              }}
                                          >
                                              <span style={{ fontSize: 18, lineHeight: 1 }}>{icon}</span>
                                              <span
                                                  style={{
                                                      fontSize: 10,
                                                      fontWeight: checked ? 800 : 600,
                                                      display: '-webkit-box',
                                                      WebkitLineClamp: 2,
                                                      WebkitBoxOrient: 'vertical',
                                                      overflow: 'hidden',
                                                  }}
                                              >
                                                  {category.name}
                                              </span>
                                          </button>
                                      );
                                  })}
                              </div>

                              <div style={{ display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
                                  <PrimaryButton
                                      onClick={() => setPickerBudgetIndex(null)}
                                      style={{ padding: '8px 12px', borderRadius: 10, fontSize: 11.5 }}
                                  >
                                      Xong
                                  </PrimaryButton>
                              </div>
                          </AppCard>
                      </div>,
                      document.body,
                  )
                : null}
        </div>
    );
}
