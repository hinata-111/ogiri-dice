import { GEMINI_MAX_OUTPUT_TOKENS, GEMINI_THINKING_BUDGET } from './limits';

const MODEL = "gemini-2.5-flash";
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

export class GeminiNonRetryableError extends Error {
  override name = 'GeminiNonRetryableError';
}

interface GeminiResponse {
  candidates?: { finishReason?: string; content?: { parts?: { text?: string }[] } }[];
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number; totalTokenCount?: number };
}

/** Geminiレスポンスから candidates[0].content.parts[0].text を取り出しJSONとしてパースする */
export function extractJson(data: unknown): unknown {
  const candidate = (data as GeminiResponse)?.candidates?.[0];
  if (candidate?.finishReason === 'MAX_TOKENS') {
    throw new GeminiNonRetryableError('Gemini output token limit reached');
  }
  const text = candidate?.content?.parts?.[0]?.text;
  if (typeof text !== "string") {
    throw new Error("Gemini response has no text");
  }
  return JSON.parse(text);
}

export async function callGemini(
  apiKey: string,
  prompt: string,
  schema: object,
  signal?: AbortSignal,
  systemInstruction?: string,
): Promise<unknown> {
  const res = await fetch(API_URL, {
    signal,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      ...(systemInstruction === undefined ? {} : { systemInstruction: { parts: [{ text: systemInstruction }] } }),
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: schema,
        maxOutputTokens: GEMINI_MAX_OUTPUT_TOKENS,
        thinkingConfig: { thinkingBudget: GEMINI_THINKING_BUDGET },
      },
    }),
  });
  if (!res.ok) {
    if (res.status === 429) throw new GeminiNonRetryableError('Gemini HTTP 429: quota exceeded');
    throw new Error(`Gemini HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const data = await res.json() as GeminiResponse;
  if (data?.usageMetadata) {
    const count = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : undefined;
    console.info('gemini_usage', {
      model: MODEL,
      finishReason: data.candidates?.[0]?.finishReason,
      promptTokens: count(data.usageMetadata.promptTokenCount),
      outputTokens: count(data.usageMetadata.candidatesTokenCount),
      thinkingTokens: count(data.usageMetadata.thoughtsTokenCount),
      totalTokens: count(data.usageMetadata.totalTokenCount),
    });
  }
  return extractJson(data);
}
