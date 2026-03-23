import { esClient, withPrefix } from "../lib/es-client";

export interface IUserProfile {
    id: string;
    displayName: string;
    username: string;
    role: string;
    telegramChatId?: string;
}

type IUserSource = {
    uId: string;
    dn?: string;
    username: string;
    role: string;
    teleChatId?: string;
};

const userIndexes = [withPrefix("user")];

const mapUserSource = (source: IUserSource): IUserProfile => {
    return {
        id: String(source.uId),
        displayName: String(source.dn || source.username || source.uId),
        username: String(source.username),
        role: String(source.role),
        telegramChatId: source.teleChatId ? String(source.teleChatId) : undefined,
    };
};

const findUserProfileById = async (userId: string): Promise<IUserProfile | undefined> => {
    for (const indexName of userIndexes) {
        try {
            const response = await esClient.post(`/${indexName}/_search`, {
                size: 1,
                sort: [{ updatedAt: { order: "desc" } }],
                query: {
                    bool: {
                        filter: [{ term: { uId: String(userId) } }],
                        must_not: [{ term: { isDeleted: true } }],
                    },
                },
            });

            const hit = response.data?.hits?.hits?.[0];
            if (hit?._source) {
                return mapUserSource(hit._source as IUserSource);
            }
        } catch (error) {
            const statusCode =
                (error as { response?: { status?: number } }).response?.status;
            if (statusCode === 404) {
                continue;
            }
            throw error;
        }
    }

    return undefined;
};

export { findUserProfileById };
