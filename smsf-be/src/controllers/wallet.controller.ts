import { Request, Response } from "express";
import { getWalletSummary } from "../services/wallet.service";

const getWallets = async (req: Request, res: Response): Promise<Response> => {
    const userId = String(req.user?.id || "").trim();

    if (!userId) {
        return res.status(401).json({
            success: false,
            message: "Unauthorized.",
        });
    }

    const walletSummary = await getWalletSummary(userId);

    return res.json({
        success: true,
        data: walletSummary,
    });
};

export { getWallets };
