import {
    ICreateTransactionPayload,
    IUpdateTransactionPayload,
    TypeTransactionKind,
} from "../interfaces/transaction.interface";

const transactionTypes: TypeTransactionKind[] = ["income", "expense"];

interface IValidationResult<T> {
    isValid: boolean;
    errors: string[];
    payload?: T;
}

const isPositiveNumber = (value: unknown): value is number => {
    return typeof value === "number" && Number.isFinite(value) && value > 0;
};

const isValidTimestamp = (value: unknown): value is number => {
    return (
        typeof value === "number" &&
        Number.isFinite(value) &&
        value > 0 &&
        Number.isInteger(value)
    );
};

const validateCreateTransactionPayload = (
    input: unknown,
): IValidationResult<ICreateTransactionPayload> => {
    const errors: string[] = [];

    if (!input || typeof input !== "object") {
        return {
            isValid: false,
            errors: ["Request body is required."],
        };
    }

    const body = input as Record<string, unknown>;

    const walletId = String(body.walletId || "").trim();
    const category = String(body.category || "").trim();
    const descriptionRaw = body.description;
    const type = body.type;
    const amount = body.amount;
    const timestamp = body.timestamp;

    if (!walletId) {
        errors.push("walletId is required.");
    }

    if (!category) {
        errors.push("category is required.");
    }

    if (!isPositiveNumber(amount)) {
        errors.push("amount must be a positive number.");
    }

    if (!transactionTypes.includes(type as TypeTransactionKind)) {
        errors.push("type must be either income or expense.");
    }

    if (!isValidTimestamp(timestamp)) {
        errors.push("timestamp must be a valid unix timestamp in milliseconds.");
    }

    if (
        descriptionRaw !== undefined &&
        descriptionRaw !== null &&
        String(descriptionRaw).trim().length > 255
    ) {
        errors.push("description must be less than or equal to 255 characters.");
    }

    if (errors.length > 0) {
        return {
            isValid: false,
            errors,
        };
    }

    return {
        isValid: true,
        errors: [],
        payload: {
            walletId,
            category,
            amount: amount as number,
            type: type as TypeTransactionKind,
            timestamp: timestamp as number,
            description:
                descriptionRaw === undefined || descriptionRaw === null
                    ? undefined
                    : String(descriptionRaw).trim(),
        },
    };
};

const validateUpdateTransactionPayload = (
    input: unknown,
): IValidationResult<IUpdateTransactionPayload> => {
    if (!input || typeof input !== "object") {
        return {
            isValid: false,
            errors: ["Request body is required."],
        };
    }

    const body = input as Record<string, unknown>;
    const errors: string[] = [];
    const payload: IUpdateTransactionPayload = {};

    if (body.walletId !== undefined) {
        const walletId = String(body.walletId || "").trim();
        if (!walletId) {
            errors.push("walletId must not be empty.");
        } else {
            payload.walletId = walletId;
        }
    }

    if (body.category !== undefined) {
        const category = String(body.category || "").trim();
        if (!category) {
            errors.push("category must not be empty.");
        } else {
            payload.category = category;
        }
    }

    if (body.amount !== undefined) {
        if (!isPositiveNumber(body.amount)) {
            errors.push("amount must be a positive number.");
        } else {
            payload.amount = body.amount;
        }
    }

    if (body.type !== undefined) {
        if (!transactionTypes.includes(body.type as TypeTransactionKind)) {
            errors.push("type must be either income or expense.");
        } else {
            payload.type = body.type as TypeTransactionKind;
        }
    }

    if (body.timestamp !== undefined) {
        if (!isValidTimestamp(body.timestamp)) {
            errors.push(
                "timestamp must be a valid unix timestamp in milliseconds.",
            );
        } else {
            payload.timestamp = body.timestamp as number;
        }
    }

    if (body.description !== undefined) {
        const description = String(body.description || "").trim();
        if (description.length > 255) {
            errors.push(
                "description must be less than or equal to 255 characters.",
            );
        } else {
            payload.description = description || undefined;
        }
    }

    if (Object.keys(payload).length === 0) {
        errors.push("At least one field is required to update transaction.");
    }

    return {
        isValid: errors.length === 0,
        errors,
        payload: errors.length === 0 ? payload : undefined,
    };
};

const validateCreateTransactionsBulkPayload = (
    input: unknown,
): IValidationResult<ICreateTransactionPayload[]> => {
    if (!Array.isArray(input) || input.length === 0) {
        return {
            isValid: false,
            errors: ["Request body must be a non-empty array."],
        };
    }

    const payloads: ICreateTransactionPayload[] = [];
    const errors: string[] = [];

    input.forEach((item, index) => {
        const validation = validateCreateTransactionPayload(item);
        if (!validation.isValid || !validation.payload) {
            errors.push(
                `Item ${index}: ${validation.errors.join(", ") || "invalid payload"}.`,
            );
            return;
        }

        payloads.push(validation.payload);
    });

    return {
        isValid: errors.length === 0,
        errors,
        payload: errors.length === 0 ? payloads : undefined,
    };
};

export {
    validateCreateTransactionPayload,
    validateUpdateTransactionPayload,
    validateCreateTransactionsBulkPayload,
};
