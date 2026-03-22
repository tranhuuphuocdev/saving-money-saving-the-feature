import { findUserProfileById, IUserProfile } from "../repositories/user.repository";

const getUserProfileById = async (userId: string): Promise<IUserProfile | undefined> => {
    return findUserProfileById(userId);
};

export { getUserProfileById };
