import { randomUUID } from "node:crypto";
import axios from "axios";
import config from "../config";
import { withPrefix } from "../lib/es-client";

type TypeCategoryKind = "income" | "expense";

interface ICategorySeed {
    name: string;
    type: TypeCategoryKind;
}

const DEFAULT_CATEGORIES: ICategorySeed[] = [
    { name: "Ăn uống", type: "expense" },
    { name: "Di chuyển", type: "expense" },
    { name: "Hóa đơn", type: "expense" },
    { name: "Giải trí", type: "expense" },
    { name: "Mua sắm", type: "expense" },
    { name: "Sức khỏe", type: "expense" },
    { name: "Nhà cửa", type: "expense" },
    { name: "Giáo dục", type: "expense" },
    { name: "Khác", type: "expense" },
    { name: "Tiết kiệm", type: "expense" },
    { name: "Lương", type: "income" },
    { name: "Freelance", type: "income" },
    { name: "Thưởng", type: "income" },
    { name: "Đầu tư", type: "income" },
    { name: "Khác", type: "income" },
];

const userId = process.env.SEED_USER_ID || "app-default";

const now = Date.now();
const categoryIndex = withPrefix("category");

const createCategory = async (name: string, type: TypeCategoryKind): Promise<void> => {
    let existing: { _source?: Record<string, unknown> } | undefined;

    try {
        const searchResponse = await axios({
            url: `${config.ES_URL}/${categoryIndex}/_search`,
            method: "post",
            data: {
                size: 1,
                query: {
                    bool: {
                        filter: [
                            { term: { uId: String(userId) } },
                            { term: { cateType: type } },
                            { term: { cateName: name } },
                        ],
                        must_not: [{ term: { isDeleted: true } }],
                    },
                },
            },
            headers: {
                "Content-Type": "application/json",
            },
        });

        existing = searchResponse.data?.hits?.hits?.[0];
    } catch (error) {
        const statusCode =
            (error as { response?: { status?: number } }).response?.status;

        if (statusCode !== 404) {
            throw error;
        }
    }

    if (existing?._source) {
        console.log(`Skip existing category: ${name} (${type})`);
        return;
    }

    const cateId = randomUUID();

    await axios({
        url: `${config.ES_URL}/${categoryIndex}/_doc/${cateId}`,
        method: "put",
        data: {
            cateId,
            uId: String(userId),
            cateName: name,
            cateType: type,
            createdAt: now,
            updatedAt: now,
            isDefault: true,
            isDeleted: false,
        },
        headers: {
            "Content-Type": "application/json",
        },
    });

    console.log(`Create category success: ${name} (${type})`);
};

async function createCategories(): Promise<void> {
    for (const category of DEFAULT_CATEGORIES) {
        await createCategory(category.name, category.type);
    }

    console.log("Seed categories completed.");
}

createCategories().catch((error) => {
    console.error("Create categories script error:", error.message);
    process.exit(1);
});
