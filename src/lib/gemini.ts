import { GoogleGenAI } from "@google/genai";

export const getGeminiApiKey = () => {
  // 优先使用 process.env (AI Studio 注入)，其次使用 import.meta.env (本地环境)
  return process.env.GEMINI_API_KEY || import.meta.env.VITE_GEMINI_API_KEY || '';
};

export const getGeminiClient = () => {
  const apiKey = getGeminiApiKey();
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
};

export const fetchWithBackoff = async (url: string, options: RequestInit, retries = 5, delay = 1000): Promise<any> => {
    try {
        const res = await fetch(url, options);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } catch (e) {
        if (retries > 0) {
            await new Promise(r => setTimeout(r, delay));
            return fetchWithBackoff(url, options, retries - 1, delay * 2);
        }
        throw e;
    }
};
