import {
    ICreateNotificationPayload,
    IPayNotificationPayload,
} from "../interfaces/notification.interface";

interface IValidationResult<T> {
    isValid: boolean;
    errors: string[];
    payload?: T;
}

const toPositiveNumber = (value: unknown): number | undefined => {
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
        return value;
    }

    if (typeof value === "string") {
        const normalized = value.replace(/[^0-9.\-]/g, "").trim();
        const parsed = Number(normalized);
        if (Number.isFinite(parsed) && parsed > 0) {
            return parsed;
        }
    }

    return undefined;
};

const toInteger = (value: unknown): number | undefined => {
    if (typeof value === "number" && Number.isInteger(value)) {
        return value;
    }

    if (typeof value === "string") {
        const parsed = Number(value.trim());
        if (Number.isInteger(parsed)) {
            return parsed;
        }
    }

    return undefined;
};

const toBoolean = (value: unknown): boolean | undefined => {
    if (typeof value === "boolean") {
        return value;
    }

    if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        if (normalized === "true") {
            return true;
        }

        if (normalized === "false") {
            return false;
        }
    }

    return undefined;
};

const validateCreateNotificationPayload = (
    input: unknown,
): IValidationResult<ICreateNotificationPayload> => {
    if (!input || typeof input !== "object") {
        return {
            isValid: false,
            errors: ["Request body is required."],
        };
    }

    const body = input as Record<string, unknown>;
    const categoryId = String(body.categoryId || "").trim();
    const amount = toPositiveNumber(body.amount);
    const dueDay = toInteger(body.dueDay);
    const activeMonths =
        body.activeMonths === undefined || body.activeMonths === null
            ? undefined
            : toInteger(body.activeMonths);
    const startAt =
        body.startAt === undefined || body.startAt === null
            ? undefined
            : toInteger(body.startAt);
    const description =
        body.description === undefined || body.description === null
            ? undefined
            : String(body.description).trim();
    const telegramChatId =
        body.telegramChatId === undefined || body.telegramChatId === null
            ? undefined
            : String(body.telegramChatId).trim();
    const errors: string[] = [];

    if (!categoryId) {
        errors.push("categoryId is required.");
    }

    if (!amount) {
        errors.push("amount must be a positive number.");
    }

    if (!dueDay || dueDay < 1 || dueDay > 31) {
        errors.push("dueDay must be an integer between 1 and 31.");
    }

    if (
        activeMonths !== undefined &&
        (!Number.isInteger(activeMonths) || activeMonths < 1 || activeMonths > 240)
    ) {
        errors.push("activeMonths must be an integer between 1 and 240.");
    }

    if (body.startAt !== undefined && body.startAt !== null && (!startAt || startAt <= 0)) {
        errors.push("startAt must be a positive timestamp.");
    }

    if (description && description.length > 255) {
        errors.push("description must be less than or equal to 255 characters.");
    }

    if (telegramChatId && telegramChatId.length > 64) {
        errors.push("telegramChatId must be less than or equal to 64 characters.");
    }

    if (errors.length > 0) {
        return { isValid: false, errors };
    }

    return {
        isValid: true,
        errors: [],
        payload: {
            categoryId,
            amount,
            dueDay,
            activeMonths,
            startAt,
            description: description || undefined,
            telegramChatId: telegramChatId || undefined,
        },
    };
};

const validatePayNotificationPayload = (
    input: unknown,
): IValidationResult<IPayNotificationPayload> => {
    if (!input || typeof input !== "object") {
        return {
            isValid: false,
            errors: ["Request body is required."],
        };
    }

    const body = input as Record<string, unknown>;
    const walletId = String(body.walletId || "").trim();
    const amount =
        body.amount === undefined || body.amount === null
            ? undefined
            : toPositiveNumber(body.amount);
    const defaultAmount =
        body.defaultAmount === undefined || body.defaultAmount === null
            ? undefined
            : toPositiveNumber(body.defaultAmount);
    const skipTransaction =
        body.skipTransaction === undefined || body.skipTransaction === null
            ? undefined
            : toBoolean(body.skipTransaction);

    if (!skipTransaction && !walletId) {
        return {
            isValid: false,
            errors: ["walletId is required."],
        };
    }

    if (body.amount !== undefined && body.amount !== null && !amount) {
        return {
            isValid: false,
            errors: ["amount must be a positive number."],
        };
    }

    if (body.defaultAmount !== undefined && body.defaultAmount !== null && !defaultAmount) {
        return {
            isValid: false,
            errors: ["defaultAmount must be a positive number."],
        };
    }

    if (body.skipTransaction !== undefined && body.skipTransaction !== null && skipTransaction === undefined) {
        return {
            isValid: false,
            errors: ["skipTransaction must be a boolean."],
        };
    }

    return {
        isValid: true,
        errors: [],
        payload: { walletId: walletId || undefined, amount, defaultAmount, skipTransaction },
    };
};

export { validateCreateNotificationPayload, validatePayNotificationPayload };
