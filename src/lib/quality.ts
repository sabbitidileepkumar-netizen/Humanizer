export type CheckState = "preserved" | "review" | "not_checked";

export type QualityCheck = {
  label: string;
  state: CheckState;
  detail: string;
};

function uniqueMatches(text: string, pattern: RegExp): string[] {
  return [...new Set(text.match(pattern) ?? [])];
}

/** Deterministic comparisons only; these checks do not claim factual verification. */
export function compareDrafts(original: string, revised: string, preserveCitations: boolean): QualityCheck[] {
  const originalParagraphs = original.trim().split(/\n\s*\n/).filter(Boolean).length;
  const revisedParagraphs = revised.trim().split(/\n\s*\n/).filter(Boolean).length;
  const numbers = uniqueMatches(original, /\b\d+(?:[.,]\d+)*(?:%|\b)/g);
  const missingNumbers = numbers.filter((value) => !revised.includes(value));
  const citations = uniqueMatches(original, /\[(?:\d+(?:\s*[-,;]\s*\d+)*)\]|\([A-Z][A-Za-z'’-]+(?: et al\.)?,?\s+\d{4}[a-z]?\)/g);
  const missingCitations = citations.filter((value) => !revised.includes(value));
  const paragraphState: CheckState = originalParagraphs === revisedParagraphs ? "preserved" : "review";
  const numberState: CheckState = missingNumbers.length ? "review" : "preserved";
  const citationState: CheckState = !preserveCitations ? "not_checked" : missingCitations.length ? "review" : "preserved";

  return [
    {
      label: "Document structure",
      state: paragraphState,
      detail: originalParagraphs === revisedParagraphs
        ? `${revisedParagraphs} paragraph${revisedParagraphs === 1 ? "" : "s"} retained.`
        : `Paragraph count changed from ${originalParagraphs} to ${revisedParagraphs}; review the layout.`,
    },
    {
      label: "Numbers and quantities",
      state: numberState,
      detail: missingNumbers.length ? `Review changed or missing values: ${missingNumbers.join(", ")}.` : "Numbers found in the original are present in the revision.",
    },
    {
      label: "Citation markers",
      state: citationState,
      detail: !preserveCitations
        ? "Citation preservation was turned off. Check references manually."
        : missingCitations.length ? `Review citation markers: ${missingCitations.join(", ")}.` : "Recognized citation markers are present in the revision.",
    },
    {
      label: "Factual accuracy",
      state: "not_checked",
      detail: "This app does not independently verify facts, claims, or sources. Check them against your references.",
    },
  ];
}

export function wordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

export function splitIntoChunks(text: string, maxChars = 8_000): string[] {
  const paragraphs = text.split(/(\n\s*\n)/);
  const chunks: string[] = [];
  let current = "";
  for (const part of paragraphs) {
    if (part.length > maxChars) {
      if (current) chunks.push(current);
      current = "";
      let remaining = part;
      while (remaining.length > maxChars) {
        let boundary = remaining.lastIndexOf(" ", maxChars);
        if (boundary < Math.floor(maxChars * 0.6)) boundary = maxChars;
        chunks.push(remaining.slice(0, boundary));
        remaining = remaining.slice(boundary);
      }
      if (remaining) chunks.push(remaining);
      continue;
    }
    if (current.length + part.length > maxChars && current) {
      chunks.push(current);
      current = "";
    }
    current += part;
  }
  if (current) chunks.push(current);
  return chunks;
}
