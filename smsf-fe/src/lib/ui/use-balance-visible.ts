'use client';

import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'smsf.balance_visible';

export function useBalanceVisible() {
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        try {
            const stored = window.localStorage.getItem(STORAGE_KEY);
            if (stored === 'false') {
                setIsVisible(false);
            }
        } catch {
            // ignore
        }
    }, []);

    const toggle = useCallback(() => {
        setIsVisible((prev) => {
            const next = !prev;
            try {
                window.localStorage.setItem(STORAGE_KEY, String(next));
            } catch {
                // ignore
            }
            return next;
        });
    }, []);

    return { isVisible, toggle };
}
