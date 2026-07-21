const MODEL = "gemini-2.5-flash";
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

/** Geminiレスポンスから candidates[0].content.parts[0].text を取り出しJSONとしてパースする */
export function extractJson(data: unknown): unknown {
  const text = (
    data as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    }
  )?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== "string") {
    throw new Error("Gemini response has no text");
  }
  return JSON.parse(text);
}

export async function callGemini(
  apiKey: string,
  prompt: string,
  schema: object,
): Promise<unknown> {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: schema,
      },
    }),
  });
  if (!res.ok) {
    throw new Error(`Gemini HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  return extractJson(await res.json());
}
