import type { Metadata, Viewport } from 'next';
import { ReactNode } from 'react';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { AuthProvider } from '@/providers/auth-provider';
import { ThemeProvider } from '@/providers/theme-provider';
import { SocketProvider } from '@/lib/socket-context';
import './globals.css';

const plusJakartaSans = Plus_Jakarta_Sans({
    subsets: ['latin', 'vietnamese'],
    variable: '--font-plus-jakarta',
    display: 'swap',
});

export const metadata: Metadata = {
    title: 'Sâu Ciu',
    description: 'Tiết kiệm thông minh, tự do tài chính',
    icons: {
        icon: '/icon.svg',
        shortcut: '/icon.svg',
    },
};

export const viewport: Viewport = {
    themeColor: '#071120',
};

export default function RootLayout({ children }: { children: ReactNode }) {
    return (
        <html lang="vi">
            <body className={plusJakartaSans.variable}>
                <ThemeProvider>
                    <AuthProvider>
                        <SocketProvider>{children}</SocketProvider>
                    </AuthProvider>
                </ThemeProvider>
            </body>
        </html>
    );
}
