'use client';

import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { IThemeContextValue, TypeThemeMode } from '@/types/theme';

const THEME_STORAGE_KEY = 'smsf.theme';
const ThemeContext = createContext<IThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [theme, setTheme] = useState<TypeThemeMode>('dark');

    useEffect(() => {
        const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY) as TypeThemeMode | null;
        const nextTheme = savedTheme === 'light' ? 'light' : 'dark';
        setTheme(nextTheme);
        document.documentElement.setAttribute('data-theme', nextTheme);
    }, []);

    function toggleTheme() {
        setTheme((previousTheme) => {
            const nextTheme: TypeThemeMode = previousTheme === 'dark' ? 'light' : 'dark';
            window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
            document.documentElement.setAttribute('data-theme', nextTheme);
            return nextTheme;
        });
    }

    const value = useMemo<IThemeContextValue>(() => ({ theme, toggleTheme }), [theme]);

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): IThemeContextValue {
    const context = useContext(ThemeContext);

    if (!context) {
        throw new Error('useTheme must be used within ThemeProvider');
    }

    return context;
}
