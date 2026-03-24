import axios from "axios";
import config from "../config";
import runInitAllEsTemplates from "../es-template";
import { createCategories } from "./create-categories";

const prefixName = (name: string): string => `${config.ES_NAME_PREFIX}${name}`;

const indexTargets = [
    prefixName("user"),
    prefixName("user-*"),
    prefixName("category"),
    prefixName("transaction"),
    prefixName("transaction-*"),
    prefixName("notification"),
    prefixName("budget"),
    prefixName("budget-*"),
    prefixName("wallet"),
    prefixName("wallet-*"),
];

const templateTargets = [
    prefixName("user-template"),
    prefixName("category-template"),
    prefixName("transaction-template"),
    prefixName("notification-template"),
    prefixName("budget-template"),
    prefixName("wallet-template"),
];

const es = axios.create({
    baseURL: config.ES_URL,
    timeout: 30000,
});

const unique = (items: string[]): string[] => {
    return [...new Set(items.filter(Boolean))];
};

const hasWildcard = (value: string): boolean => {
    return value.includes("*") || value.includes("?");
};

const deleteResource = async (path: string, label: string): Promise<void> => {
    try {
        await es.delete(path);
        console.log(`[truncate-es] deleted ${label}: ${path}`);
    } catch (error) {
        const statusCode =
            (error as { response?: { status?: number } }).response?.status;

        if (statusCode === 404) {
            console.log(`[truncate-es] skip missing ${label}: ${path}`);
            return;
        }

        throw error;
    }
};

const listIndexes = async (pattern: string): Promise<string[]> => {
    try {
        const response = await es.get<Array<{ index?: string }>>(
            `/_cat/indices/${pattern}?format=json&h=index&expand_wildcards=all`,
        );

        return unique(
            (response.data || [])
                .map((item) => String(item.index || "").trim())
                .filter(Boolean),
        );
    } catch (error) {
        const statusCode =
            (error as { response?: { status?: number } }).response?.status;

        if (statusCode === 404) {
            return [];
        }

        throw error;
    }
};

const resolveIndexTargets = async (): Promise<string[]> => {
    const resolvedIndexes: string[] = [];

    for (const indexName of unique(indexTargets)) {
        if (hasWildcard(indexName)) {
            resolvedIndexes.push(...(await listIndexes(indexName)));
            continue;
        }

        resolvedIndexes.push(indexName);
    }

    return unique(resolvedIndexes);
};

async function deleteIndexes(): Promise<void> {
    for (const indexName of await resolveIndexTargets()) {
        await deleteResource(
            `/${indexName}?ignore_unavailable=true`,
            "index",
        );
    }
}

async function deleteTemplates(): Promise<void> {
    for (const templateName of unique(templateTargets)) {
        await deleteResource(`/_template/${templateName}`, "template");
    }
}

async function truncateEs(): Promise<void> {
    console.log("[truncate-es] deleting indexes");
    await deleteIndexes();

    console.log("[truncate-es] deleting templates");
    await deleteTemplates();

    console.log("[truncate-es] reinitializing templates");
    await runInitAllEsTemplates(true);

    console.log("[truncate-es] seeding default categories");
    await createCategories();

    console.log("[truncate-es] completed");
}

truncateEs().catch((error) => {
    console.error(
        "[truncate-es] failed:",
        (error as { response?: { data?: unknown } }).response?.data ||
            (error as Error).message,
    );
    process.exit(1);
});