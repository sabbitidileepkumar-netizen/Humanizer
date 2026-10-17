import OpenAI from "openai";

export type StructuredRewrite = {
  refinedText: string;
  changeSummary: string[];
  reviewNotes: string[];
};

export interface TextProvider {
  rewrite(instructions: string, input: string, signal: AbortSignal, attachments?: Array<{ mimeType: string; data: string }>): Promise<string>;
}

class GeminiProvider implements TextProvider {
  constructor(private readonly apiKey: string, private readonly model: string) {}

  async rewrite(instructions: string, input: string, signal: AbortSignal, attachments: Array<{ mimeType: string; data: string }> = []): Promise<string> {
    const parts: Array<Record<string, string>> = [{ text: input }];
    for (const attachment of attachments) parts.push({ inlineData: JSON.stringify({ mimeType: attachment.mimeType, data: attachment.data.split(",", 2)[1] }) });
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": this.apiKey },
      signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: instructions }] },
        contents: [{ role: "user", parts: parts.map((part) => part.inlineData ? { inlineData: JSON.parse(part.inlineData) } : part) }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              refinedText: { type: "STRING" },
              changeSummary: { type: "ARRAY", items: { type: "STRING" } },
              reviewNotes: { type: "ARRAY", items: { type: "STRING" } },
            },
            required: ["refinedText", "changeSummary", "reviewNotes"],
          },
        },
      }),
    });
    if (!response.ok) throw new GeminiAPIError(response.status);
    const result = await response.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = result.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim();
    if (!text) throw new Error("The Gemini provider returned an unexpected response. Please try again.");
    return text;
  }
}

class GeminiAPIError extends Error {
  constructor(readonly status: number) {
    super(`Gemini API returned HTTP ${status}.`);
    this.name = "GeminiAPIError";
  }
}

class OpenAIResponsesProvider implements TextProvider {
  private readonly client: OpenAI;

  constructor(apiKey: string, baseURL?: string) {
    this.client = new OpenAI({ apiKey, baseURL, timeout: 22_000, maxRetries: 0 });
  }

  async rewrite(instructions: string, input: string, signal: AbortSignal): Promise<string> {
    const response = await this.client.responses.create({
      model: process.env.AI_MODEL || process.env.OPENAI_MODEL || "gpt-5.5",
      instructions,
      input,
      text: { format: { type: "json_object" } },
    }, { signal });
    return response.output_text;
  }
}

export function createTextProvider(): TextProvider {
  const providerName = (process.env.AI_PROVIDER || "gemini").toLowerCase();
  if (providerName === "gemini") {
    const apiKey = process.env.GEMINI_API_KEY || process.env.AI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not configured.");
    return new GeminiProvider(apiKey, process.env.AI_MODEL || "gemini-flash-lite-latest");
  }
  if (providerName !== "openai" && providerName !== "openai-compatible") {
    throw new Error(`Unsupported AI_PROVIDER "${providerName}". Choose gemini, openai, or openai-compatible.`);
  }
  const apiKey = providerName === "openai-compatible" ? process.env.AI_API_KEY : process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error(providerName === "openai-compatible" ? "AI_API_KEY is not configured." : "OPENAI_API_KEY is not configured.");
  let baseURL: string | undefined;
  if (providerName === "openai-compatible") {
    const configured = process.env.AI_BASE_URL;
    if (!configured) throw new Error("AI_BASE_URL is required for the openai-compatible provider.");
    try {
      const url = new URL(configured);
      if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") throw new Error();
      baseURL = url.toString();
    } catch {
      throw new Error("AI_BASE_URL must be a valid HTTPS URL (localhost is allowed for development).");
    }
  }
  return new OpenAIResponsesProvider(apiKey, baseURL);
}

export function isProviderRateLimit(cause: unknown): boolean {
  return (cause instanceof OpenAI.APIError && cause.status === 429) || (cause instanceof GeminiAPIError && cause.status === 429);
}
