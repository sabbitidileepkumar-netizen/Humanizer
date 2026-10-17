import { z } from "zod";

export const MODES = [
  "Natural & Conversational",
  "Academic & Research",
  "Professional & Business",
  "Simple English",
  "Technical Documentation",
  "Blog & Article",
  "Essay & Assignment",
  "Creative Writing",
  "Email & Formal Letter",
  "Custom Tone",
] as const;

export const rewriteRequestSchema = z.object({
  text: z.string().trim().min(1, "Add some text to refine.").max(30_000),
  mode: z.enum(MODES),
  audience: z.string().trim().max(160).default("General readers"),
  purpose: z.string().trim().max(160).default("Improve clarity and flow"),
  tone: z.string().trim().max(160).default(""),
  formality: z.enum(["Relaxed", "Balanced", "Formal"]).default("Balanced"),
  length: z.enum(["Shorter", "Similar", "More detailed"]).default("Similar"),
  englishVariant: z.enum(["US English", "UK English", "Indian English"]).default("US English"),
  preserveTechnical: z.boolean().default(true),
  preserveCitations: z.boolean().default(true),
  explainChanges: z.boolean().default(false),
});

export type RewriteRequest = z.infer<typeof rewriteRequestSchema>;

export const rewriteResultSchema = z.object({
  refinedText: z.string().min(1),
  changeSummary: z.array(z.string()).max(6).default([]),
  reviewNotes: z.array(z.string()).max(6).default([]),
});

export type RewriteResult = z.infer<typeof rewriteResultSchema>;
