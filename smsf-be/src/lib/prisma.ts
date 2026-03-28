import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

export type DbExecutor = Prisma.TransactionClient;

export const withTransaction = async <T>(
    handler: (executor: DbExecutor) => Promise<T>,
): Promise<T> => {
    return prisma.$transaction(async (tx) => handler(tx));
};

export { prisma };
