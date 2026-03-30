import config from "../config";

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

interface IGeminiTextPart {
    text: string;
}

interface IGeminiImagePart {
    inline_data: {
        mime_type: string;
        data: string;
    };
}

type GeminiPart = IGeminiTextPart | IGeminiImagePart;

interface IGenerateContentPayload {
    parts: GeminiPart[];
    responseSchema?: Record<string, unknown>;
    maxOutputTokens?: number;
}

const extractResponseText = (responseJson: unknown): string => {
    const candidates = (responseJson as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> })?.candidates;
    const firstText = candidates?.[0]?.content?.parts?.find((part) => typeof part?.text === "string")?.text;

    return String(firstText || "").trim();
};

const callGeminiGenerateContent = async (
    payload: IGenerateContentPayload,
): Promise<string> => {
    const apiKey = String(config.gemini.apiKey || "").trim();

    if (!apiKey) {
        const error = new Error("Gemini API is not configured.");
        (error as Error & { statusCode?: number }).statusCode = 503;
        throw error;
    }

    const model = String(config.gemini.model || "gemini-1.5-flash").trim();
    const endpoint = `${GEMINI_BASE_URL}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.gemini.timeoutMs);

    try {
        const generationConfig: Record<string, unknown> = {
            responseMimeType: "application/json",
            temperature: 0.2,
            topK: 20,
            topP: 0.8,
            maxOutputTokens: Number(payload.maxOutputTokens) || 1024,
        };

        if (payload.responseSchema && typeof payload.responseSchema === "object") {
            generationConfig.responseSchema = payload.responseSchema;
        }

        const response = await fetch(endpoint, {
            method: "POST",
            signal: controller.signal,
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                contents: [
                    {
                        role: "user",
                        parts: payload.parts,
                    },
                ],
                generationConfig,
            }),
        });

        if (!response.ok) {
            const errText = await response.text();
            const error = new Error(`Gemini request failed with status ${response.status}: ${errText.slice(0, 400)}`);
            (error as Error & { statusCode?: number }).statusCode = 502;
            throw error;
        }

        const responseJson = await response.json();
        const outputText = extractResponseText(responseJson);

        if (!outputText) {
            const error = new Error("Gemini returned an empty response.");
            (error as Error & { statusCode?: number }).statusCode = 502;
            throw error;
        }

        return outputText;
    } catch (error) {
        if ((error as Error).name === "AbortError") {
            const timeoutError = new Error("Gemini request timed out.");
            (timeoutError as Error & { statusCode?: number }).statusCode = 504;
            throw timeoutError;
        }

        throw error;
    } finally {
        clearTimeout(timeout);
    }
};

export { callGeminiGenerateContent };
