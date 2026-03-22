import axios from "axios";
import config from "../config";

const sendTelegramMessage = async (
    chatId: string | undefined,
    text: string,
): Promise<boolean> => {
    const botToken = config.telegram.botToken;
    const targetChatId = String(chatId || config.telegram.defaultChatId || "").trim();

    if (!botToken || !targetChatId) {
        return false;
    }

    await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        chat_id: targetChatId,
        text,
        parse_mode: "HTML",
    });

    return true;
};

export { sendTelegramMessage };
