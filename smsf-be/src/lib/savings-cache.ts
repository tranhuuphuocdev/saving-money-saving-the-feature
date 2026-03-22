type TCacheEntry<T> = {
    value: T;
    expiresAt: number;
};

const DEFAULT_TTL_MS = 60 * 1000;

const savingsCache = new Map<string, TCacheEntry<unknown>>();

function getSavingsCacheKey(scope: "goal" | "rate", userId: string, month: number, year: number): string {
    return `${scope}:${userId}:${year}-${String(month).padStart(2, "0")}`;
}

function getCachedSavingsValue<T>(key: string): T | undefined {
    const entry = savingsCache.get(key);

    if (!entry) {
        return undefined;
    }

    if (Date.now() >= entry.expiresAt) {
        savingsCache.delete(key);
        return undefined;
    }

    return entry.value as T;
}

function setCachedSavingsValue<T>(key: string, value: T, ttlMs = DEFAULT_TTL_MS): T {
    savingsCache.set(key, {
        value,
        expiresAt: Date.now() + ttlMs,
    });

    return value;
}

async function getOrSetCachedSavingsValue<T>(
    key: string,
    producer: () => Promise<T>,
    ttlMs = DEFAULT_TTL_MS,
): Promise<T> {
    const cachedValue = getCachedSavingsValue<T>(key);

    if (cachedValue !== undefined) {
        return cachedValue;
    }

    const nextValue = await producer();
    return setCachedSavingsValue(key, nextValue, ttlMs);
}

function invalidateSavingsCacheByUser(userId: string): void {
    for (const key of savingsCache.keys()) {
        if (key.includes(`:${userId}:`)) {
            savingsCache.delete(key);
        }
    }
}

export {
    getSavingsCacheKey,
    getCachedSavingsValue,
    setCachedSavingsValue,
    getOrSetCachedSavingsValue,
    invalidateSavingsCacheByUser,
};