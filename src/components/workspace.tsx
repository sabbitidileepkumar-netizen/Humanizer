"use client";

import { useMemo, useState } from "react";
import { compareDrafts, wordCount, type QualityCheck } from "@/lib/quality";
import { MODES } from "@/lib/schema";

const starter = "";

type Settings = {
  mode: (typeof MODES)[number];
  audience: string;
  purpose: string;
  tone: string;
  formality: "Relaxed" | "Balanced" | "Formal";
  length: "Shorter" | "Similar" | "More detailed";
  englishVariant: "US English" | "UK English" | "Indian English";
  preserveTechnical: boolean;
  preserveCitations: boolean;
  explainChanges: boolean;
};

const initialSettings: Settings = {
  mode: "Natural & Conversational",
  audience: "General readers",
  purpose: "Improve clarity and flow",
  tone: "",
  formality: "Balanced",
  length: "Similar",
  englishVariant: "US English",
  preserveTechnical: true,
  preserveCitations: true,
  explainChanges: false,
};

function Icon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    sparkle: "M12 3 13.8 8.2 19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3ZM19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15ZM5 15l.7 1.3L7 17l-1.3.7L5 19l-.7-1.3L3 17l1.3-.7L5 15Z",
    arrow: "M5 12h14m-6-6 6 6-6 6",
    copy: "M8 8V4h12v12h-4M4 8h12v12H4z",
    sun: "M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6 7 7m10 10 1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z",
    book: "M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21V5.5ZM4 17a2.5 2.5 0 0 1 2.5-2.5H20",
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name] ?? paths.sparkle} /></svg>;
}

function CheckRow({ check }: { check: QualityCheck }) {
  const label = check.state === "preserved" ? "Checked" : check.state === "review" ? "Review" : "Manual";
  return <div className="check-row">
    <span className={`check-icon ${check.state}`} aria-hidden="true">{check.state === "preserved" ? "✓" : check.state === "review" ? "!" : "·"}</span>
    <div className="check-copy"><strong>{check.label}</strong><p>{check.detail}</p></div>
    <span className={`check-tag ${check.state}`}>{label}</span>
  </div>;
}

export function Workspace() {
  const [original, setOriginal] = useState(starter);
  const [refined, setRefined] = useState("");
  const [settings, setSettings] = useState<Settings>(initialSettings);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [summary, setSummary] = useState<string[]>([]);
  const [reviewNotes, setReviewNotes] = useState<string[]>([]);
  const [showCompare, setShowCompare] = useState(false);
  const [dark, setDark] = useState(false);
  const [activeTab, setActiveTab] = useState<"refine" | "research">("refine");

  const checks = useMemo(() => original && refined ? compareDrafts(original, refined, settings.preserveCitations) : [], [original, refined, settings.preserveCitations]);
  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => setSettings((current) => ({ ...current, [key]: value }));
  const sendNotice = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(""), 2600); };

  async function refine() {
    setError("");
    setNotice("");
    if (!original.trim()) { setError("Add a draft in the left editor to get started."); return; }
    setBusy(true);
    try {
      const response = await fetch("/api/rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: original, ...settings }),
      });
      const data = await response.json() as { refinedText?: string; changeSummary?: string[]; reviewNotes?: string[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? "The rewrite could not be completed.");
      setRefined(data.refinedText ?? "");
      setSummary(data.changeSummary ?? []);
      setReviewNotes(data.reviewNotes ?? []);
      setShowCompare(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "A connection error occurred. Please try again.");
    } finally { setBusy(false); }
  }

  async function copyResult() {
    if (!refined) return;
    try { await navigator.clipboard.writeText(refined); sendNotice("Refined draft copied."); }
    catch { setError("Clipboard access was blocked. Select the refined text and copy it manually."); }
  }

  async function pasteDraft() {
    try { setOriginal(await navigator.clipboard.readText()); setError(""); sendNotice("Draft pasted from clipboard."); }
    catch { setError("Clipboard access was blocked. Paste directly into the original text editor."); }
  }

  function downloadDraft() {
    if (!refined) return;
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([refined], { type: "text/plain;charset=utf-8" }));
    link.download = "humanflow-refined-draft.txt";
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function clearDraft() {
    setOriginal(""); setRefined(""); setSummary([]); setReviewNotes([]); setError(""); setShowCompare(false);
  }

  return <main className={`app-shell ${dark ? "dark" : ""}`}>
    <div className="ambient ambient-one" /><div className="ambient ambient-two" />
    <header className="topbar">
      <a className="brand" href="#home" aria-label="HumanFlow AI home"><span className="brand-mark"><Icon name="sparkle" /></span><span>humanflow<span className="brand-ai">.ai</span></span></a>
      <nav className="top-nav" aria-label="Main navigation">
        <button className={`nav-item ${activeTab === "refine" ? "active" : ""}`} onClick={() => setActiveTab("refine")}><span className="nav-dot" /> Workspace</button>
        <button className={`nav-item ${activeTab === "research" ? "active" : ""}`} onClick={() => { setActiveTab("research"); document.getElementById("research-info")?.scrollIntoView({ behavior: "smooth" }); }}><Icon name="book" /> Research space</button>
      </nav>
      <div className="top-actions"><span className="privacy-pill"><span /> No drafts saved</span><button className="theme-button" aria-label={dark ? "Switch to light theme" : "Switch to dark theme"} onClick={() => setDark(!dark)}><Icon name="sun" /></button><span className="avatar">HF</span></div>
    </header>

    <section className="hero" id="home">
      <div className="hero-copy"><div className="eyebrow"><span className="eyebrow-line" /> YOUR THOUGHTS, IN THEIR BEST FORM</div>
        <h1>Make every word<br /><span>flow naturally.</span></h1>
        <p>Thoughtful writing refinement that keeps your meaning, your voice, and what matters most.</p>
      </div>
      <div className="hero-note"><div className="note-icon"><Icon name="sparkle" /></div><div><strong>Made for clear writing</strong><span>Not detector scores. Just better drafts.</span></div><span className="note-arrow">↗</span></div>
    </section>

    <section className="toolbar" aria-label="Writing settings">
      <label className="mode-field"><span>WRITING MODE</span><select value={settings.mode} onChange={(event) => update("mode", event.target.value as Settings["mode"])}>{MODES.map((mode) => <option key={mode}>{mode}</option>)}</select></label>
      <div className="toolbar-divider" />
      <label className="setting-field"><span>AUDIENCE</span><input value={settings.audience} onChange={(event) => update("audience", event.target.value)} placeholder="General readers" maxLength={160} /></label>
      <label className="setting-field purpose-field"><span>PURPOSE</span><input value={settings.purpose} onChange={(event) => update("purpose", event.target.value)} placeholder="Improve clarity and flow" maxLength={160} /></label>
      {settings.mode === "Custom Tone" && <label className="setting-field tone-field"><span>CUSTOM TONE</span><input value={settings.tone} onChange={(event) => update("tone", event.target.value)} placeholder="e.g. warm and direct" maxLength={160} /></label>}
    </section>

    <section className="control-row">
      <div className="control-group"><span className="control-label">TONE</span><div className="segmented">{(["Relaxed", "Balanced", "Formal"] as const).map((item) => <button key={item} className={settings.formality === item ? "selected" : ""} onClick={() => update("formality", item)}>{item}</button>)}</div></div>
      <div className="control-group length-group"><span className="control-label">LENGTH</span><div className="segmented">{(["Shorter", "Similar", "More detailed"] as const).map((item) => <button key={item} className={settings.length === item ? "selected" : ""} onClick={() => update("length", item)}>{item === "More detailed" ? "Detailed" : item}</button>)}</div></div>
      <label className="variant-field"><span className="control-label">ENGLISH</span><select value={settings.englishVariant} onChange={(event) => update("englishVariant", event.target.value as Settings["englishVariant"])}><option>US English</option><option>UK English</option><option>Indian English</option></select></label>
      <div className="control-spacer" />
      <button className={`toggle-chip ${settings.preserveCitations ? "on" : ""}`} onClick={() => update("preserveCitations", !settings.preserveCitations)} aria-pressed={settings.preserveCitations}><span className="toggle-track" /> Citations</button>
      <button className={`toggle-chip ${settings.preserveTechnical ? "on" : ""}`} onClick={() => update("preserveTechnical", !settings.preserveTechnical)} aria-pressed={settings.preserveTechnical}><span className="toggle-track" /> Technical terms</button>
      <button className={`toggle-chip ${settings.explainChanges ? "on" : ""}`} onClick={() => update("explainChanges", !settings.explainChanges)} aria-pressed={settings.explainChanges}><span className="toggle-track" /> Explain edits</button>
    </section>

    <section className="editor-card" aria-label="Writing workspace">
      <div className="editor-heading"><div className="editor-intro"><span className="section-kicker">THE WRITING DESK</span><h2>Shape your draft.</h2></div><div className="editor-tools"><button className="quiet-action" onClick={pasteDraft}>Paste</button><button className="quiet-action" onClick={clearDraft}>Clear all</button><span className="tool-separator" /><button className="round-tool" aria-label="Theme" onClick={() => setDark(!dark)}><Icon name="sun" /></button></div></div>
      <div className="editors-grid">
        <section className="writing-panel original-panel">
          <div className="panel-header"><div className="panel-title"><span className="panel-index">01</span><h3>Original text</h3></div><span className="panel-state">YOUR DRAFT</span></div>
          <textarea aria-label="Original text" value={original} onChange={(event) => setOriginal(event.target.value)} placeholder="Paste a paragraph, an idea in progress, or a complete draft. We'll help it read more naturally while preserving what you mean." maxLength={30_000} />
          <div className="panel-footer"><span>{wordCount(original)} words <i /> {original.length.toLocaleString()} / 30,000 chars</span><button className="tiny-action" onClick={() => setOriginal("")} disabled={!original}>Reset</button></div>
        </section>
        <div className="flow-bridge" aria-hidden="true"><span><Icon name="arrow" /></span></div>
        <section className="writing-panel refined-panel">
          <div className="panel-header"><div className="panel-title"><span className="panel-index teal">02</span><h3>Refined text</h3></div><span className="ai-tag"><span /> AI ASSISTED</span></div>
          {refined ? <textarea aria-label="Refined text" value={refined} onChange={(event) => setRefined(event.target.value)} /> : <div className="empty-output"><div className="empty-orbit"><span className="orbit-dot" /><Icon name="sparkle" /></div><strong>Your clearer draft starts here.</strong><p>Choose a writing mode, then refine your text. Review every change before you use it.</p></div>}
          <div className="panel-footer"><span>{wordCount(refined)} words <i /> {refined.length.toLocaleString()} chars</span><div className="result-tools"><button className="tiny-action" onClick={copyResult} disabled={!refined}><Icon name="copy" /> Copy</button><button className="tiny-action" onClick={downloadDraft} disabled={!refined}>Download</button></div></div>
        </section>
      </div>
      <div className="action-row"><div className="action-hint"><span className="hint-bullet" /> Keeps your meaning at the center</div><div className="action-right">{error && <p className="error-message" role="alert">{error}</p>}<button className="refine-button" onClick={refine} disabled={busy}><span className="button-icon"><Icon name="sparkle" /></span>{busy ? <><span className="spinner" /> Refining your draft…</> : <>Refine my writing <span className="button-arrow">↗</span></>}</button></div></div>
      <div className="mobile-settings"><label>Formality<select value={settings.formality} onChange={(event) => update("formality", event.target.value as Settings["formality"])}><option>Relaxed</option><option>Balanced</option><option>Formal</option></select></label><label>Length<select value={settings.length} onChange={(event) => update("length", event.target.value as Settings["length"])}><option>Shorter</option><option>Similar</option><option>More detailed</option></select></label></div>
    </section>

    {refined && <section className="results-area">
      <div className="result-heading"><div><span className="section-kicker">A CAREFUL SECOND LOOK</span><h2>Review the changes.</h2></div><button className={`compare-button ${showCompare ? "active" : ""}`} onClick={() => setShowCompare(!showCompare)}>{showCompare ? "Hide comparison" : "Compare drafts"}<span>⇄</span></button></div>
      {showCompare && <div className="comparison-card"><div><span>ORIGINAL</span><p>{original}</p></div><div><span>REFINED</span><p>{refined}</p></div></div>}
      <div className="quality-card"><div className="quality-top"><div className="quality-mark"><Icon name="sparkle" /></div><div><strong>Writing checks</strong><p>Clear signals to help you review, not a score or a guarantee.</p></div><span className="quality-count">{checks.filter((item) => item.state === "preserved").length} checks passed</span></div><div className="checks-grid">{checks.map((check) => <CheckRow key={check.label} check={check} />)}</div>
        {(summary.length > 0 || reviewNotes.length > 0) && <div className="notes-grid">{summary.length > 0 && <div className="edit-notes"><h4>What changed</h4><ul>{summary.map((item, i) => <li key={`${i}-${item}`}>{item}</li>)}</ul></div>}{reviewNotes.length > 0 && <div className="review-notes"><h4>Worth reviewing</h4><ul>{reviewNotes.map((item, i) => <li key={`${i}-${item}`}>{item}</li>)}</ul></div>}</div>}
      </div>
    </section>}

    <section className="feature-strip"><article><span className="feature-number">01</span><div><strong>Meaning stays yours</strong><p>Keep arguments, evidence, and the details that make the writing yours.</p></div></article><article><span className="feature-number">02</span><div><strong>Fits your context</strong><p>Refine for a reader, a purpose, and the kind of writing you're doing.</p></div></article><article><span className="feature-number">03</span><div><strong>Review what matters</strong><p>See straightforward checks for citations, quantities, and document structure.</p></div></article></section>

    <section className="example-card"><div className="example-intro"><span className="section-kicker">A SMALL BEFORE &amp; AFTER</span><h2>Clearer words.<br />Same point.</h2><p>A thoughtful edit makes the thought easier to follow without changing the point.</p></div><div className="example-texts"><article><span>BEFORE</span><p>Due to the fact that the survey was limited to one region, the results should not be regarded as conclusive.</p></article><div className="example-arrow" aria-hidden="true">→</div><article><span>AFTER</span><p>Because the survey covered only one region, the results should be treated as inconclusive.</p></article></div></section>

    <section className="research-info" id="research-info"><div className="research-copy"><span className="section-kicker">A SPACE FOR SERIOUS WORK</span><h2>Research deserves<br />careful editing.</h2><p>Choose Academic & Research or Technical Documentation to refine abstracts, reports, methods, and literature reviews. Citation markers and structure checks help you review the result.</p><button onClick={() => { setActiveTab("refine"); update("mode", "Academic & Research"); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Open research mode <span>↗</span></button></div><div className="research-list"><div><span>01</span><strong>Evidence stays traceable</strong><small>Recognized citations stay visible for review.</small></div><div><span>02</span><strong>No invented research</strong><small>Unsupported claims should be checked against your sources.</small></div><div><span>03</span><strong>You stay the author</strong><small>Review and understand edits before academic submission.</small></div><p id="consent-note"><Icon name="book" /> Draft text is sent to your configured AI provider and is not saved here. Provider terms apply.</p></div></section>

    <footer className="footer"><a className="brand footer-brand" href="#home"><span className="brand-mark"><Icon name="sparkle" /></span><span>humanflow<span className="brand-ai">.ai</span></span></a><span>AI-assisted editing. Always review facts and sources yourself.</span><a href="#consent-note">Privacy & research note ↗</a></footer>
    {notice && <div className="toast" role="status">{notice}</div>}
  </main>;
}
