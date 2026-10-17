import { NextResponse } from "next/server";
import { allowRewrite } from "@/lib/rate-limit";
import { createTextProvider, isProviderRateLimit, type TextProvider } from "@/lib/provider";
import { buildChunkInput, buildInstructions, parseRewriteResult } from "@/lib/rewrite";
import { rewriteRequestSchema } from "@/lib/schema";
import { splitIntoChunks } from "@/lib/quality";

export const runtime = "nodejs";
export const maxDuration = 120;

function error(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "unknown";
}

export async function POST(request: Request) {
  if (!allowRewrite(clientKey(request))) return error("Too many rewrite requests. Please wait a minute and try again.", 429);

  const bodyBytes = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(bodyBytes) && bodyBytes > 9_500_000) return error("This upload is too large for one request. Use fewer or smaller pages/images.", 413);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error("Send a valid JSON request.", 400);
  }

  const input = rewriteRequestSchema.safeParse(body);
  if (!input.success) {
    const issue = input.error.issues[0];
    return error(issue?.message ?? "Check the text and writing options, then try again.", 400);
  }

  const maxChars = Number(process.env.MAX_INPUT_CHARS ?? 30_000);
  if (input.data.text.length > maxChars) return error(`This document is over the ${maxChars.toLocaleString()} character limit.`, 413);
  const providerName = (process.env.AI_PROVIDER || "gemini").toLowerCase();
  const hasApiKey = providerName === "gemini"
    ? Boolean(process.env.GEMINI_API_KEY || process.env.AI_API_KEY)
    : providerName === "openai"
      ? Boolean(process.env.OPENAI_API_KEY)
      : Boolean(process.env.AI_API_KEY);
  if (!hasApiKey) {
    return error("AI rewriting is not configured yet. Add the configured provider's server-side API key, then restart the app.", 503);
  }
  const attachmentBytes = input.data.attachments.reduce((total, item) => total + Math.ceil((item.data.length * 3) / 4), 0);
  if (attachmentBytes > 7_000_000) return error("Attachments are too large for one Gemini request. Try fewer pages or smaller images.", 413);

  const chunks = splitIntoChunks(input.data.text, 7_000);
  if (chunks.length > 5) return error("This document is too long to refine in one pass. Split it into shorter sections and try again.", 413);

  let provider: TextProvider;
  try {
    provider = createTextProvider();
  } catch (cause) {
    return error(cause instanceof Error ? cause.message : "The configured AI provider is unavailable.", 503);
  }
  const refined: string[] = [];
  const summaries: string[] = [];
  const notes: string[] = [];

  try {
    for (const [index, chunk] of chunks.entries()) {
      const raw = await provider.rewrite(
        buildInstructions(input.data),
        buildChunkInput(input.data, chunk, index, chunks.length),
        AbortSignal.timeout(23_000),
        input.data.attachments,
      );
      const result = parseRewriteResult(raw);
      refined.push(result.refinedText);
      summaries.push(...result.changeSummary);
      notes.push(...result.reviewNotes);
    }
  } catch (cause) {
    const name = cause instanceof Error ? cause.name : "";
    if (name === "TimeoutError" || name === "APIConnectionTimeoutError") return error("The AI request took too long. Please try a shorter section.", 504);
    if (isProviderRateLimit(cause)) return error("The AI provider is busy or its usage limit was reached. Please try again later.", 503);
    if (cause instanceof Error && cause.message.includes("unexpected response")) return error(cause.message, 502);
    return error("The AI provider could not complete this rewrite. Check the server configuration and try again.", 502);
  }

  return NextResponse.json({
    refinedText: refined.join(""),
    changeSummary: [...new Set(summaries)].slice(0, 6),
    reviewNotes: [...new Set(notes)].slice(0, 6),
  });
}
