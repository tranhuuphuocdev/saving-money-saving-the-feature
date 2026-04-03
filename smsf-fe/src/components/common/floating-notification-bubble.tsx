'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bell } from 'lucide-react';

interface FloatingNotificationBubbleProps {
    notificationCount: number;
    onClick: () => void;
}

export function FloatingNotificationBubble({ notificationCount, onClick }: FloatingNotificationBubbleProps) {
    const [isMounted, setIsMounted] = useState(false);
    const [pos, setPos] = useState<{ right: number; bottom: number } | null>(null);

    const isDragging = useRef(false);
    const hasMoved = useRef(false);
    const dragOffset = useRef({ right: 0, bottom: 0 });
    const pointerDownPos = useRef({ x: 0, y: 0 });
    const dragTargetRef = useRef<HTMLDivElement | null>(null);
    const dragPointerIdRef = useRef<number | null>(null);

    useEffect(() => {
        setIsMounted(true);
        setPos({ right: 72, bottom: 98 });
    }, []);

    const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
        if (dragPointerIdRef.current !== null) return;
        isDragging.current = true;
        hasMoved.current = false;
        dragPointerIdRef.current = event.pointerId;
        pointerDownPos.current = { x: event.clientX, y: event.clientY };
        dragOffset.current = {
            right: window.innerWidth - event.clientX - (pos?.right ?? 18),
            bottom: window.innerHeight - event.clientY - (pos?.bottom ?? 150),
        };
        dragTargetRef.current = event.currentTarget;
        event.currentTarget.setPointerCapture(event.pointerId);
    }, [pos]);

    const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
        if (!isDragging.current || dragPointerIdRef.current !== event.pointerId) return;
        const dx = Math.abs(event.clientX - pointerDownPos.current.x);
        const dy = Math.abs(event.clientY - pointerDownPos.current.y);
        if (dx > 6 || dy > 6) hasMoved.current = true;
        if (!hasMoved.current) return;

        const newRight = Math.max(8, window.innerWidth - event.clientX - dragOffset.current.right);
        const newBottom = Math.max(8, window.innerHeight - event.clientY - dragOffset.current.bottom);
        setPos({ right: newRight, bottom: newBottom });
    }, []);

    const handlePointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
        if (dragPointerIdRef.current !== event.pointerId) return;
        const moved = hasMoved.current;
        isDragging.current = false;
        hasMoved.current = false;
        dragPointerIdRef.current = null;
        if (!moved) {
            onClick();
        }
    }, [onClick]);

    if (!isMounted || !pos) return null;

    return createPortal(
        <div
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            style={{
                position: 'fixed',
                right: pos.right,
                bottom: pos.bottom,
                zIndex: 50,
                cursor: 'grab',
                userSelect: 'none',
                touchAction: 'none',
            }}
        >
            <div className="bubble-float" style={{ width: 40, height: 40, position: 'relative' }}>
                {/* Ping ripple ring */}
                {notificationCount > 0 ? (
                    <div
                        className="bubble-ping"
                        style={{
                            position: 'absolute',
                            inset: 0,
                            borderRadius: '50%',
                            background: 'var(--accent)',
                            opacity: 0.35,
                            pointerEvents: 'none',
                        }}
                    />
                ) : null}
                {/* Main bubble */}
                <div
                    style={{
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, var(--theme-gradient-start), var(--theme-gradient-end))',
                        boxShadow: '0 6px 24px rgba(0,0,0,0.35), 0 0 0 5px color-mix(in srgb, var(--accent) 22%, transparent)',
                        display: 'grid',
                        placeItems: 'center',
                        color: '#fff',
                        position: 'relative',
                    }}
                >
                    <Bell size={16} strokeWidth={2.4} />
                    {notificationCount > 0 ? (
                        <span
                            style={{
                                position: 'absolute',
                                top: 1,
                                right: 1,
                                minWidth: 14,
                                height: 14,
                                borderRadius: 999,
                                background: '#ef4444',
                                boxShadow: '0 0 0 1.5px #fff',
                                display: 'grid',
                                placeItems: 'center',
                                fontSize: 9,
                                fontWeight: 800,
                                color: '#fff',
                                padding: '0 3px',
                                lineHeight: 1,
                            }}
                        >
                            {notificationCount > 99 ? '99+' : notificationCount}
                        </span>
                    ) : null}
                </div>
            </div>
        </div>,
        document.body,
    );
}
