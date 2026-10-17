import { rewriteResultSchema, type RewriteRequest, type RewriteResult } from "@/lib/schema";

export function buildInstructions(options: RewriteRequest): string {
  const tone = options.mode === "Custom Tone" && options.tone ? options.tone : options.mode;
  return [
    "You are HumanFlow AI, a careful writing editor. Refine text for clarity, natural flow, readability, and the writer's stated context.",
    "Work in these stages internally: identify the document purpose and audience; preserve the argument, evidence, qualifications, names, dates, quantities, citations, quotations, code, and technical meaning; then rewrite; finally compare the result for possible meaning drift.",
    "Do not add facts, sources, examples, research outcomes, citations, or claims absent from the input. Do not claim to have independently verified facts. Flag uncertainty or possible unsupported statements in reviewNotes.",
    "Do not optimize for AI-detector scores, claim to bypass detection, or add deliberate errors. Improve the writing itself.",
    `Writing mode: ${options.mode}. Audience: ${options.audience}. Purpose: ${options.purpose}. Desired tone: ${tone}. Formality: ${options.formality}. Length: ${options.length}. English variant: ${options.englishVariant}.`,
    `Preserve technical terminology: ${options.preserveTechnical ? "yes" : "use simpler terms when appropriate"}. Preserve citations: ${options.preserveCitations ? "yes, exactly" : "best effort"}.`,
    "Return only a JSON object with keys refinedText (string), changeSummary (array of short strings), and reviewNotes (array of short strings). Keep headings, lists, equations, code fences, quotation marks, and paragraph order unless a change is needed for clarity.",
    options.explainChanges ? "Give concise useful changeSummary items." : "Set changeSummary to an empty array.",
  ].join("\n");
}

export function buildChunkInput(request: RewriteRequest, chunk: string, index: number, total: number): string {
  const headings = request.text.match(/^#{1,6}\s+.+$|^[A-Z][^\n]{2,90}$/gm)?.slice(0, 30).join("\n") ?? "(no headings detected)";
  return [
    `This is section ${index + 1} of ${total} in one document. Preserve consistent terminology and voice across sections.`,
    `Document headings for context:\n${headings}`,
    "Do not repeat the headings/context in the output unless they occur in the section itself.",
    "Section to refine:",
    chunk,
  ].join("\n\n");
}

export function parseRewriteResult(raw: string): RewriteResult {
  const parsed = JSON.parse(raw) as unknown;
  const checked = rewriteResultSchema.safeParse(parsed);
  if (!checked.success) throw new Error("The AI returned an unexpected response. Please try again.");
  return checked.data;
}
