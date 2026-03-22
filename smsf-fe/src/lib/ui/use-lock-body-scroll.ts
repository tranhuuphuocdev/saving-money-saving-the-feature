import { useEffect } from 'react';

let scrollLockCount = 0;

const lockBodyScroll = () => {
    const body = document.body;

    if (scrollLockCount === 0) {
        body.dataset.prevOverflow = body.style.overflow;
        body.style.overflow = 'hidden';
    }

    scrollLockCount += 1;
};

const unlockBodyScroll = () => {
    const body = document.body;
    scrollLockCount = Math.max(0, scrollLockCount - 1);

    if (scrollLockCount === 0) {
        body.style.overflow = body.dataset.prevOverflow || '';
        delete body.dataset.prevOverflow;
    }
};

export function useLockBodyScroll(locked: boolean): void {
    useEffect(() => {
        if (!locked) {
            return;
        }

        lockBodyScroll();
        return () => {
            unlockBodyScroll();
        };
    }, [locked]);
}
