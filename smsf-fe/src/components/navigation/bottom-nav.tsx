'use client';

import { BookText, Calendar, ChartNoAxesColumn, Menu, ReceiptText } from 'lucide-react';
import { useState } from 'react';
import { TypeDashboardTab } from '@/types/dashboard';

interface IBottomNavProps {
    activeTab: TypeDashboardTab;
    onSelect: (tab: TypeDashboardTab) => void;
}

const navItems = [
    { key: 'menu', label: 'Menu', icon: Menu },
    { key: 'transactions', label: 'Giao dịch', icon: ReceiptText },
    { key: 'dashboard', label: 'Tổng quan', icon: ChartNoAxesColumn },
    { key: 'calendar', label: 'Lịch', icon: Calendar },
    { key: 'journal', label: 'Nhật ký', icon: BookText },
] as const;

export function BottomNav({ activeTab, onSelect }: IBottomNavProps) {
    const [isDashboardBouncing, setIsDashboardBouncing] = useState(false);

    function handleSelect(tab: TypeDashboardTab) {
        if (tab === 'dashboard') {
            setIsDashboardBouncing(true);
            window.setTimeout(() => setIsDashboardBouncing(false), 320);
        }

        onSelect(tab);
    }

    return (
        <nav
            className="glass-card"
            style={{
                position: 'fixed',
                left: '50%',
                bottom: 8,
                transform: 'translateX(-50%)',
                width: 'min(calc(100% - 16px), 760px)',
                borderRadius: 999,
                padding: '8px 10px calc(8px + env(safe-area-inset-bottom, 0px))',
                display: 'grid',
                gridTemplateColumns: `repeat(${navItems.length}, 1fr)`,
                gap: 6,
                zIndex: 30,
                overflow: 'visible',
            }}
        >
            {navItems.map(({ key, label, icon: Icon }) => {
                const isCenter = key === 'dashboard';
                const isActive = activeTab === key;

                return (
                    <button
                        key={key}
                        onClick={() => handleSelect(key)}
                        style={{
                            minHeight: 54,
                            borderRadius: isCenter ? 999 : 15,
                                                        border: isCenter ? '1px solid var(--chip-border)' : '1px solid transparent',
                            background: isCenter
                                                                ? 'linear-gradient(135deg, var(--theme-gradient-start), var(--theme-gradient-end))'
                                : isActive
                                                                    ? 'var(--chip-bg)'
                                  : 'transparent',
                                                        color: isCenter || isActive ? 'var(--theme-nav-active)' : 'var(--theme-nav-icon)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 5,
                            transform: isCenter
                                ? isDashboardBouncing
                                    ? 'translateY(-18px) scale(1.03)'
                                    : 'translateY(-14px)'
                                : 'translateY(0)',
                            boxShadow: isCenter ? '0 14px 40px color-mix(in srgb, var(--primary) 36%, transparent)' : 'none',
                            transition: 'all 0.22s cubic-bezier(0.22, 1, 0.36, 1)',
                            position: 'relative',
                            zIndex: isCenter ? 2 : 1,
                        }}
                    >
                        <Icon size={isCenter ? 21 : 19} />
                        <span style={{ fontSize: 9.5, fontWeight: 700, lineHeight: 1 }}>{label}</span>
                    </button>
                );
            })}
        </nav>
    );
}
