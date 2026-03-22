export interface ICreateUserPayload {
    uId: string;
    dn: string;
    username: string;
    teleChatId?: string;
    password: string;
    role: string;
    createdAt: number;
    updatedAt: number;
    isDeleted: boolean;
}
