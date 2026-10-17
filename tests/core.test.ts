import assert from "node:assert/strict";
import { test } from "node:test";
import { compareDrafts, splitIntoChunks, wordCount } from "../src/lib/quality.ts";
import { allowRewrite } from "../src/lib/rate-limit.ts";
import { createTextProvider } from "../src/lib/provider.ts";
import { rewriteRequestSchema } from "../src/lib/schema.ts";

test("counts empty text and words predictably", () => {
  assert.equal(wordCount("  \n "), 0);
  assert.equal(wordCount("A short draft."), 3);
});

test("splits long drafts without dropping text or paragraph separators", () => {
  const text = `${"A".repeat(30)}\n\n${"B".repeat(30)}`;
  const chunks = splitIntoChunks(text, 35);
  assert.equal(chunks.join(""), text);
  assert.ok(chunks.every((chunk) => chunk.length <= 35));
});

test("flags changed quantities and missing citation markers", () => {
  const checks = compareDrafts("The sample had 42 participants [12].", "The sample had 40 participants.", true);
  assert.equal(checks.find((check) => check.label === "Numbers and quantities")?.state, "review");
  assert.equal(checks.find((check) => check.label === "Citation markers")?.state, "review");
  assert.equal(checks.find((check) => check.label === "Factual accuracy")?.state, "not_checked");
});

test("validates options and rejects blank input", () => {
  const base = {
    text: "A draft.", mode: "Academic & Research", audience: "Students", purpose: "Clarify",
    tone: "", formality: "Formal", length: "Similar", englishVariant: "Indian English",
    preserveTechnical: true, preserveCitations: true, explainChanges: false,
  };
  assert.equal(rewriteRequestSchema.safeParse(base).success, true);
  assert.equal(rewriteRequestSchema.safeParse({ ...base, text: "   " }).success, false);
  assert.equal(rewriteRequestSchema.safeParse({ ...base, mode: "not-a-mode" }).success, false);
  assert.equal(rewriteRequestSchema.safeParse({ ...base, text: "x".repeat(30_001) }).success, false);
  assert.equal(rewriteRequestSchema.safeParse({ ...base, text: "Résumé — शोध [12]." }).success, true);
});

test("applies a per-key request window", () => {
  const key = `test-${Math.random()}`;
  assert.equal(allowRewrite(key, 100, 2, 60_000), true);
  assert.equal(allowRewrite(key, 101, 2, 60_000), true);
  assert.equal(allowRewrite(key, 102, 2, 60_000), false);
  assert.equal(allowRewrite(key, 60_101, 2, 60_000), true);
});

test("rejects unsafe or incomplete OpenAI-compatible provider settings", () => {
  const keys = ["AI_PROVIDER", "AI_API_KEY", "AI_BASE_URL"] as const;
  const prior = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  try {
    process.env.AI_PROVIDER = "openai-compatible";
    process.env.AI_API_KEY = "test-key";
    process.env.AI_BASE_URL = "http://example.com/v1";
    assert.throws(() => createTextProvider(), /valid HTTPS URL/);
    process.env.AI_BASE_URL = "https://api.example.com/v1";
    assert.doesNotThrow(() => createTextProvider());
  } finally {
    for (const key of keys) {
      const value = prior[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
