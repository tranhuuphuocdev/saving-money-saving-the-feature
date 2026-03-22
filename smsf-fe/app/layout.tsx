import type { Metadata, Viewport } from 'next';
import { ReactNode } from 'react';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { AuthProvider } from '@/providers/auth-provider';
import { ThemeProvider } from '@/providers/theme-provider';
import './globals.css';

const plusJakartaSans = Plus_Jakarta_Sans({
    subsets: ['latin', 'vietnamese'],
    variable: '--font-plus-jakarta',
    display: 'swap',
});

export const metadata: Metadata = {
    title: 'SMSF | Smart Expense Manager',
    description: 'Mobile-first expense management dashboard',
};

export const viewport: Viewport = {
    themeColor: '#071120',
};

export default function RootLayout({ children }: { children: ReactNode }) {
    return (
        <html lang="vi">
            <body className={plusJakartaSans.variable}>
                <ThemeProvider>
                    <AuthProvider>{children}</AuthProvider>
                </ThemeProvider>
            </body>
        </html>
    );
}
