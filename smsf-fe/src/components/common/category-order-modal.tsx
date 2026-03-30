'use client';

import { GripVertical, X } from 'lucide-react';
import { PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AppCard } from '@/components/common/app-card';
import { PrimaryButton } from '@/components/common/primary-button';
import { ICategoryItem, TypeCategoryKind } from '@/types/calendar';

const GRID_COLUMNS = 4;
const GRID_GAP = 8;

interface ICategoryOrderModalProps {
    isOpen: boolean;
    type: TypeCategoryKind;
    categories: ICategoryItem[];
    isSaving?: boolean;
    onClose: () => void;
    onSave: (categoryIds: string[]) => Promise<void>;
}

export function CategoryOrderModal({
    isOpen,
    type,
    categories,
    isSaving = false,
    onClose,
    onSave,
}: ICategoryOrderModalProps) {
    const baseList = useMemo(
        () => categories.filter((item) => item.type === type).sort((a, b) => a.orderIndex - b.orderIndex),
        [categories, type],
    );
    const [ordered, setOrdered] = useState<ICategoryItem[]>(baseList);
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [dropIndex, setDropIndex] = useState<number | null>(null);
    const [dragPoint, setDragPoint] = useState<{ x: number; y: number } | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const dragCursorOffsetRef = useRef<{ x: number; y: number }>({ x: 36, y: 36 });
    const dragGhostSizeRef = useRef<{ width: number; height: number }>({ width: 72, height: 72 });
    const gridRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        setOrdered(baseList);
        setDraggingId(null);
        setDropIndex(null);
        setDragPoint(null);
        setIsDragging(false);
    }, [isOpen, baseList]);

    const draggingItem = useMemo(
        () => ordered.find((item) => item.id === draggingId) || null,
        [ordered, draggingId],
    );

    const listWithoutDragging = useMemo(
        () => ordered.filter((item) => item.id !== draggingId),
        [ordered, draggingId],
    );

    const getDropIndexFromPoint = (x: number, y: number): number => {
        const gridEl = gridRef.current;
        if (!gridEl) {
            return 0;
        }

        const rect = gridEl.getBoundingClientRect();
        const clampedX = Math.max(rect.left, Math.min(x, rect.right - 1));
        const clampedY = Math.max(rect.top, Math.min(y, rect.bottom - 1));
        const cellSize = (rect.width - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS;
        const unit = cellSize + GRID_GAP;

        const col = Math.max(0, Math.min(GRID_COLUMNS - 1, Math.floor((clampedX - rect.left) / Math.max(unit, 1))));
        const row = Math.max(0, Math.floor((clampedY - rect.top) / Math.max(unit, 1)));
        const rawIndex = row * GRID_COLUMNS + col;

        return Math.max(0, Math.min(rawIndex, listWithoutDragging.length));
    };

    const previewItems = useMemo(() => {
        if (!draggingId || dropIndex === null) {
            return ordered.map((item) => ({
                kind: 'item' as const,
                item,
            }));
        }

        const withoutDragged = ordered.filter((item) => item.id !== draggingId);
        const safeDropIndex = Math.max(0, Math.min(dropIndex, withoutDragged.length));
        const items: Array<
            | { kind: 'item'; item: ICategoryItem }
            | { kind: 'placeholder'; key: string }
        > = [];

        for (let index = 0; index <= withoutDragged.length; index += 1) {
            if (index === safeDropIndex) {
                items.push({ kind: 'placeholder', key: `placeholder-${safeDropIndex}` });
            }

            if (index < withoutDragged.length) {
                items.push({ kind: 'item', item: withoutDragged[index] });
            }
        }

        return items;
    }, [draggingId, dropIndex, ordered]);

    const moveDraggedToIndex = (targetIndex: number) => {
        if (!draggingId) {
            return;
        }

        setOrdered((prev) => {
            const dragIndex = prev.findIndex((item) => item.id === draggingId);
            if (dragIndex < 0) {
                return prev;
            }

            const withoutDragged = prev.filter((item) => item.id !== draggingId);
            const safeIndex = Math.max(0, Math.min(targetIndex, withoutDragged.length));
            const draggedItem = prev[dragIndex];

            withoutDragged.splice(safeIndex, 0, draggedItem);
            return withoutDragged;
        });
    };

    const finishDrag = () => {
        if (!draggingId) {
            return;
        }

        moveDraggedToIndex(dropIndex ?? 0);
        setDraggingId(null);
        setDropIndex(null);
        setDragPoint(null);
        setIsDragging(false);
    };

    const handleDragStart = (event: ReactPointerEvent<HTMLButtonElement>, id: string, currentIndex: number) => {
        event.preventDefault();

        const rect = event.currentTarget.getBoundingClientRect();
        dragCursorOffsetRef.current = {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
        };
        dragGhostSizeRef.current = {
            width: rect.width,
            height: rect.height,
        };

        setDraggingId(id);
        setDragPoint({ x: event.clientX, y: event.clientY });
        setDropIndex(currentIndex);
        setIsDragging(true);
    };

    useEffect(() => {
        if (!isDragging || !draggingId) {
            return;
        }

        const handleWindowPointerMove = (event: PointerEvent) => {
            setDragPoint({ x: event.clientX, y: event.clientY });
            setDropIndex(getDropIndexFromPoint(event.clientX, event.clientY));
        };

        const handleWindowPointerUp = () => {
            finishDrag();
        };

        window.addEventListener('pointermove', handleWindowPointerMove);
        window.addEventListener('pointerup', handleWindowPointerUp);
        window.addEventListener('pointercancel', handleWindowPointerUp);

        return () => {
            window.removeEventListener('pointermove', handleWindowPointerMove);
            window.removeEventListener('pointerup', handleWindowPointerUp);
            window.removeEventListener('pointercancel', handleWindowPointerUp);
        };
    }, [isDragging, draggingId, dropIndex]);

    if (!isOpen) {
        return null;
    }

    return createPortal(
        <div
            onClick={(event) => {
                if (event.target === event.currentTarget && !isSaving) {
                    onClose();
                }
            }}
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 1410,
                background: 'rgba(2, 8, 23, 0.55)',
                backdropFilter: 'blur(2px)',
                display: 'grid',
                placeItems: 'center',
                padding: 16,
            }}
        >
            <AppCard strong style={{ width: 'min(100%, 560px)', padding: 14, display: 'grid', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <div style={{ fontSize: 15, fontWeight: 900 }}>Sắp xếp danh mục</div>
                        <div style={{ marginTop: 2, color: 'var(--muted)', fontSize: 12 }}>
                            Kéo thả để sắp xếp thứ tự hiển thị.
                        </div>
                    </div>
                    <button
                        type="button"
                        disabled={isSaving}
                        onClick={onClose}
                        style={{
                            width: 30,
                            height: 30,
                            borderRadius: 8,
                            border: '1px solid var(--surface-border)',
                            background: 'transparent',
                            color: 'var(--muted)',
                            display: 'grid',
                            placeItems: 'center',
                        }}
                    >
                        <X size={14} />
                    </button>
                </div>

                <div
                    ref={gridRef}
                    style={{
                        display: 'grid',
                        gridTemplateColumns: `repeat(${GRID_COLUMNS}, minmax(0, 1fr))`,
                        gap: GRID_GAP,
                    }}
                >
                    {previewItems.map((entry, previewIndex) => {
                        if (entry.kind === 'placeholder') {
                            return (
                                <div
                                    key={entry.key}
                                    style={{
                                        borderRadius: 12,
                                        border: '1px dashed var(--chip-border)',
                                        background: 'color-mix(in srgb, var(--chip-bg) 72%, transparent)',
                                        aspectRatio: '1 / 1',
                                        animation: 'pulse-soft 0.8s ease-in-out infinite',
                                    }}
                                />
                            );
                        }

                        const category = entry.item;
                        const isDragging = draggingId === category.id;
                        const dragIndex = ordered.findIndex((item) => item.id === category.id);

                        return (
                            <button
                                key={category.id}
                                type="button"
                                onPointerDown={(event) => handleDragStart(event, category.id, dragIndex)}
                                style={{
                                    borderRadius: 12,
                                    border: isDragging ? '1.5px solid var(--chip-border)' : '1px solid var(--surface-border)',
                                    background: isDragging ? 'var(--chip-bg)' : 'var(--surface-soft)',
                                    color: 'var(--foreground)',
                                    padding: '6px',
                                    display: 'grid',
                                    gridTemplateRows: '1fr auto auto',
                                    justifyItems: 'center',
                                    alignItems: 'center',
                                    gap: 4,
                                    aspectRatio: '1 / 1',
                                    opacity: isDragging ? 0 : 1,
                                    touchAction: 'none',
                                }}
                            >
                                <span style={{ fontSize: 18, lineHeight: 1 }}>{category.icon || '🧩'}</span>
                                <span style={{ textAlign: 'center', fontSize: 10.5, fontWeight: 800, lineHeight: 1.15 }}>{category.name}</span>
                                <GripVertical size={12} color="var(--muted)" />
                            </button>
                        );
                    })}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button
                        type="button"
                        disabled={isSaving}
                        onClick={onClose}
                        style={{
                            borderRadius: 10,
                            border: '1px solid var(--surface-border)',
                            background: 'transparent',
                            color: 'var(--foreground)',
                            fontSize: 12,
                            fontWeight: 700,
                            padding: '9px 12px',
                        }}
                    >
                        Hủy
                    </button>
                    <PrimaryButton
                        disabled={isSaving}
                        onClick={() => void onSave(ordered.map((item) => item.id))}
                    >
                        {isSaving ? 'Đang lưu...' : 'Lưu thứ tự'}
                    </PrimaryButton>
                </div>
            </AppCard>

            {draggingItem && dragPoint ? (
                <div
                    style={{
                        position: 'fixed',
                        left: dragPoint.x - dragCursorOffsetRef.current.x,
                        top: dragPoint.y - dragCursorOffsetRef.current.y,
                        width: dragGhostSizeRef.current.width,
                        height: dragGhostSizeRef.current.height,
                        borderRadius: 12,
                        border: '1px solid var(--chip-border)',
                        background: 'var(--surface-soft)',
                        boxShadow: '0 10px 24px rgba(0,0,0,0.28)',
                        zIndex: 1420,
                        pointerEvents: 'none',
                        display: 'grid',
                        placeItems: 'center',
                        gap: 2,
                        padding: 6,
                    }}
                >
                    <span style={{ fontSize: 18, lineHeight: 1 }}>{draggingItem.icon || '🧩'}</span>
                    <span style={{ textAlign: 'center', fontSize: 10, fontWeight: 800, lineHeight: 1.15 }}>{draggingItem.name}</span>
                </div>
            ) : null}
        </div>,
        document.body,
    );
}
