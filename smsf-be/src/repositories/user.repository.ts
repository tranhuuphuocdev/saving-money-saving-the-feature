import { prisma } from "../lib/prisma";

export interface IUserProfile {
    id: string;
    displayName: string;
    username: string;
    role: string;
    telegramChatId?: string;
}

const findUserProfileById = async (userId: string): Promise<IUserProfile | undefined> => {
    const row = await prisma.user.findFirst({
        where: {
            id: userId,
            isDeleted: false,
        },
        orderBy: { updatedAt: "desc" },
    });

    if (!row) {
        return undefined;
    }

    return {
        id: String(row.id),
        displayName: String(row.displayName || row.username || row.id),
        username: String(row.username),
        role: String(row.role),
        telegramChatId: row.telegramChat ? String(row.telegramChat) : undefined,
    };
};

export { findUserProfileById };
