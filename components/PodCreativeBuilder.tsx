"use client";

import {
  Archive,
  Check,
  Clipboard,
  Download,
  FileJson,
  FileText,
  Home,
  Layers3,
  Library,
  Plus,
  RefreshCw,
  Settings,
  Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { BRAND_VOICES, ART_STYLES, BUYER_PERSONAS, OCCASIONS, OUTPUT_REQUESTS, PRODUCT_TYPES } from "@/lib/constants";
import { exportMarkdown } from "@/lib/exportMarkdown";
import { createProject, generateConcepts, generateCopyPack, generatePromptPack } from "@/lib/generate";
import { filterExportData, getOutputFlags, type OutputFlags } from "@/lib/outputFilters";
import { buildLocalStrategy, type GenerateStrategyResponse } from "@/lib/strategy";
import type { Analysis } from "@/types/analysis";
import type { Concept } from "@/types/concept";
import type { CopyPack } from "@/types/copyPack";
import type { Project } from "@/types/project";
import type { PromptPack } from "@/types/promptPack";

const tabs = ["Overview", "Custom Map", "Concepts", "Prompts", "Shopify Copy", "Meta Ads", "Export"];
const PROJECT_DRAFT_KEY = "pod-builder-project-draft";
const navItems: Array<[string, LucideIcon, boolean]> = [
  ["Dashboard", Home, false],
  ["Product Brief", Plus, false],
  ["Concepts", Archive, false],
  ["Prompts", Library, false],
  ["Shopify Copy", Layers3, false],
  ["Meta Ads", Sparkles, false],
  ["Export", FileJson, false],
  ["Settings", Settings, true],
];

type ScreenshotState = {
  name: string;
  type: string;
  size: number;
  base64: string;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="text-sm font-medium text-primary">{children}</label>;
}

function ScoreBadge({ label, value }: { label: string; value: string }) {
  const tone =
    value === "high" || value === "easy"
      ? "bg-accent text-primary border-black/10"
      : value === "medium"
        ? "bg-amber-50 text-warning border-amber-100"
        : value === "hard"
          ? "bg-red-50 text-danger border-red-100"
          : "bg-stone-100 text-secondary border-stone-200";

  return (
    <span className={cx("inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium capitalize", tone)}>
      {label}: {value}
    </span>
  );
}

function CopyButton({ value, onCopied }: { value: string; onCopied: () => void }) {
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        onCopied();
      }}
      className="focus-ring inline-flex h-9 items-center gap-1.5 rounded-full border border-primary bg-white px-3 text-xs font-medium text-primary hover:bg-surface-muted"
    >
      <Clipboard size={14} />
      Copy
    </button>
  );
}

function SelectField({
  value,
  options,
  onChange,
}: {
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="focus-ring min-h-11 w-full rounded-lg border border-border bg-white px-3 text-base text-primary"
    >
      {options.map((option) => (
        <option key={option}>{option}</option>
      ))}
    </select>
  );
}

function MultiPillPicker({
  options,
  selected,
  onChange,
}: {
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const active = selected.includes(option);
        return (
          <button
            type="button"
            key={option}
            onClick={() => onChange(active ? selected.filter((item) => item !== option) : [...selected, option])}
            className={cx(
              "focus-ring rounded-full border px-3.5 py-2 text-xs font-medium transition",
              active ? "border-black/10 bg-accent text-primary" : "border-border bg-white text-secondary hover:bg-surface-muted",
            )}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="focus-ring min-h-11 w-full rounded-lg border border-border bg-white px-3 text-base text-primary placeholder:text-muted"
    />
  );
}

function TextArea({
  value,
  onChange,
  placeholder,
  rows = 4,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      rows={rows}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="focus-ring w-full rounded-lg border border-border bg-white px-3 py-3 text-base leading-6 text-primary placeholder:text-muted"
    />
  );
}

function PromptBlock({ title, value, onCopied }: { title: string; value: string; onCopied: () => void }) {
  return (
    <div className="rounded-xl border border-border bg-surface-muted">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h4 className="text-sm font-medium text-primary">{title}</h4>
        <CopyButton value={value} onCopied={onCopied} />
      </div>
      <p className="max-h-48 overflow-auto p-4 font-mono text-sm leading-6 text-secondary">{value}</p>
    </div>
  );
}

export default function PodCreativeBuilder() {
  const [project, setProject] = useState<Project>(() => {
    const defaultProject = createProject({
      name: "Pet memorial suncatcher brief",
      competitorBrand: "Competitor store",
      productTitle: "Custom pet memorial window ornament",
      productDescription: "Personalized pet image keepsake with name, date, and emotional quote.",
    });

    if (typeof window === "undefined") return defaultProject;

    const saved = localStorage.getItem(PROJECT_DRAFT_KEY);
    if (!saved) return defaultProject;

    try {
      return JSON.parse(saved) as Project;
    } catch {
      localStorage.removeItem(PROJECT_DRAFT_KEY);
      return defaultProject;
    }
  });
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [promptPacks, setPromptPacks] = useState<Record<string, PromptPack>>({});
  const [copyPacks, setCopyPacks] = useState<Record<string, CopyPack>>({});
  const [activeTab, setActiveTab] = useState("Overview");
  const [toast, setToast] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState("");
  const [strategySource, setStrategySource] = useState("");
  const [screenshot, setScreenshot] = useState<ScreenshotState | null>(null);

  const selectedConcepts = useMemo(() => concepts.filter((concept) => concept.selected), [concepts]);
  const outputFlags = useMemo(() => getOutputFlags(project), [project]);
  const visibleTabs = useMemo(
    () =>
      tabs.filter((tab) => {
        if (tab === "Overview") return outputFlags.productBreakdown;
        if (tab === "Custom Map") return outputFlags.customMap;
        if (tab === "Concepts") return outputFlags.concepts;
        if (tab === "Prompts") return outputFlags.designPrompts || outputFlags.mockupPrompts;
        if (tab === "Shopify Copy") return outputFlags.shopifyCopy || outputFlags.seo;
        if (tab === "Meta Ads") return outputFlags.metaAds;
        if (tab === "Export") return outputFlags.exportMarkdown || outputFlags.exportJson;
        return true;
      }),
    [outputFlags],
  );
  const displayedActiveTab = visibleTabs.includes(activeTab) ? activeTab : visibleTabs[0] || "Overview";
  const markdown = useMemo(
    () => exportMarkdown({ project, analysis, concepts, prompts: promptPacks, copies: copyPacks, flags: outputFlags }),
    [analysis, concepts, copyPacks, outputFlags, project, promptPacks],
  );
  const jsonExportValue = useMemo(() => {
    const filtered = filterExportData({ project, concepts, promptPacks, copyPacks });
    return JSON.stringify(
      {
        project,
        analysis,
        concepts: filtered.concepts,
        promptPacks: filtered.promptPacks,
        copyPacks: filtered.copyPacks,
        screenshot: screenshot ? { name: screenshot.name, type: screenshot.type, size: screenshot.size } : null,
        exportedAt: new Date().toISOString(),
      },
      null,
      2,
    );
  }, [analysis, concepts, copyPacks, project, promptPacks, screenshot]);

  const updateProject = <K extends keyof Project>(key: K, value: Project[K]) => {
    setProject((current) => ({ ...current, [key]: value, updatedAt: new Date().toISOString() }));
  };

  const showCopied = () => {
    setToast("Copied");
    window.setTimeout(() => setToast(""), 1400);
  };

  const applyStrategy = (strategy: GenerateStrategyResponse, source: string) => {
    setAnalysis(strategy.analysis);
    setConcepts(strategy.concepts);
    setPromptPacks(strategy.promptPacks);
    setCopyPacks(strategy.copyPacks);
    setStrategySource(source);
    setProject((current) => ({ ...current, status: "generated", name: current.productTitle || current.name }));
    setActiveTab(visibleTabs[0] || "Overview");
  };

  const generateStrategy = async () => {
    setIsGenerating(true);
    setGenerationError("");

    try {
      const response = await fetch("/api/generate-strategy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project,
          screenshotBase64: screenshot?.base64 || null,
        }),
      });

      if (!response.ok) throw new Error(`Generate request failed with ${response.status}`);
      const data = (await response.json()) as GenerateStrategyResponse & { source?: string };
      applyStrategy(data, data.source || "api");
    } catch (error) {
      const fallback = buildLocalStrategy(project);
      applyStrategy(fallback, "local-fallback");
      setGenerationError(error instanceof Error ? error.message : "Generation failed. Local fallback was used.");
    } finally {
      setIsGenerating(false);
    }
  };

  const regenerateConcepts = () => {
    if (!analysis) return;

    const nextConcepts = generateConcepts(project, analysis);
    const nextPrompts: Record<string, PromptPack> = {};
    const nextCopies: Record<string, CopyPack> = {};

    nextConcepts
      .filter((concept) => concept.selected)
      .forEach((concept) => {
        nextPrompts[concept.id] = generatePromptPack(concept, project.productType || "Product");
        nextCopies[concept.id] = generateCopyPack(concept, project.productType || "Product");
      });

    setConcepts(nextConcepts);
    setPromptPacks(nextPrompts);
    setCopyPacks(nextCopies);
  };

  const saveDraft = () => {
    localStorage.setItem(PROJECT_DRAFT_KEY, JSON.stringify(project));
    setToast("Draft saved");
    window.setTimeout(() => setToast(""), 1400);
  };

  const clearDraft = () => {
    localStorage.removeItem(PROJECT_DRAFT_KEY);
    setToast("Draft cleared");
    window.setTimeout(() => setToast(""), 1400);
  };

  const toggleConcept = (conceptId: string) => {
    setConcepts((current) =>
      current.map((concept) => {
        if (concept.id !== conceptId) return concept;
        const selected = !concept.selected;
        if (selected) {
          setPromptPacks((packs) => ({ ...packs, [concept.id]: generatePromptPack(concept, project.productType || "Product") }));
          setCopyPacks((packs) => ({ ...packs, [concept.id]: generateCopyPack(concept, project.productType || "Product") }));
        }
        return { ...concept, selected };
      }),
    );
    setProject((current) => ({ ...current, status: "selected" }));
  };

  const download = (name: string, value: string, type: string) => {
    const blob = new Blob([value], { type });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = name;
    link.click();
    URL.revokeObjectURL(href);
    setProject((current) => ({ ...current, status: "exported" }));
  };

  return (
    <main className="min-h-screen bg-background text-primary">
      <header className="sticky top-0 z-30 border-b border-border bg-white">
        <div className="flex min-h-[72px] items-center justify-between gap-4 px-4 py-4 md:px-6">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-primary text-white">
              <Sparkles size={18} />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-base font-medium">POD Creative Builder</span>
              <span className="rounded-full border border-border bg-surface-muted px-2.5 py-1 text-xs font-medium text-secondary">MVP</span>
            </div>
          </div>

          <nav className="hidden items-center gap-2 lg:flex">
            {["Competitor Brief", "Creative Pack", "Export"].map((item) => (
              <span key={item} className="rounded-full px-4 py-2 text-sm font-medium text-secondary">
                {item}
              </span>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <button type="button" onClick={saveDraft} className="focus-ring hidden h-11 items-center rounded-full border border-primary bg-white px-5 text-sm font-medium text-primary hover:bg-surface-muted sm:inline-flex">
              Save Draft
            </button>
            <button type="button" onClick={generateStrategy} disabled={isGenerating} className="focus-ring inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-white hover:bg-shade-70 disabled:cursor-not-allowed disabled:opacity-70">
              <Sparkles size={16} className={isGenerating ? "animate-pulse" : ""} />
              {isGenerating ? "Building..." : "Generate Strategy"}
            </button>
          </div>
        </div>
      </header>

      <div className="flex min-h-[calc(100vh-72px)]">
        <aside className="hidden w-[260px] shrink-0 border-r border-border bg-background p-4 lg:block">
          <nav className="sticky top-24 space-y-1">
            {navItems.map(([label, Icon, comingSoon]) => (
              <button
                type="button"
                key={label}
                className={cx(
                  "focus-ring flex w-full items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium",
                  label === "Product Brief" ? "border border-black/10 bg-accent text-primary" : "text-secondary hover:bg-white",
                )}
              >
                <Icon size={16} />
                <span className="min-w-0 flex-1 text-left">{label}</span>
                {comingSoon ? <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-secondary">Soon</span> : null}
              </button>
            ))}
          </nav>
        </aside>

        <section className="min-w-0 flex-1 px-4 py-8 md:px-8 lg:py-12">
          <div className="mx-auto max-w-[1320px] space-y-8">
            <section className="max-w-4xl">
              <p className="mb-4 text-xs font-medium uppercase tracking-[0.06em] text-secondary">POD Creative Workflow</p>
              <h1 className="page-title">Build custom POD products from competitor signals.</h1>
              <p className="mt-5 max-w-[720px] text-base leading-7 text-secondary md:text-lg">
                Turn a competitor product into original custom angles, design prompts, Shopify copy, and Meta ad concepts without copying the original artwork.
              </p>
            </section>

            <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
              <BriefForm
                project={project}
                screenshot={screenshot}
                updateProject={updateProject}
                updateScreenshot={setScreenshot}
                onGenerate={generateStrategy}
                onSaveDraft={saveDraft}
                onClearDraft={clearDraft}
                isGenerating={isGenerating}
              />

              <BriefSummary project={project} analysis={analysis} selectedCount={selectedConcepts.length} onGenerate={generateStrategy} isGenerating={isGenerating} />
            </section>

            <section className="rounded-xl border border-border bg-white">
              <div className="overflow-x-auto border-b border-border p-3">
                <div className="flex min-w-max gap-2">
                  {visibleTabs.map((tab) => (
                    <button
                      type="button"
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={cx(
                        "focus-ring rounded-full px-4 py-2 text-sm font-medium",
                        displayedActiveTab === tab ? "bg-primary text-white" : "text-secondary hover:bg-surface-muted hover:text-primary",
                      )}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </div>
              <div className="p-5 md:p-8">
                {!analysis ? (
                  <EmptyState onGenerate={generateStrategy} isGenerating={isGenerating} />
                ) : (
                  <>
                    {generationError ? (
                      <div className="mb-5 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-warning">
                        API generation failed, so a local fallback was used. {generationError}
                      </div>
                    ) : null}
                    {strategySource ? (
                      <p className="mb-4 text-xs font-medium uppercase tracking-[0.06em] text-secondary">Generated via {strategySource}</p>
                    ) : null}
                    {displayedActiveTab === "Overview" && <OverviewTab analysis={analysis} onCopied={showCopied} />}
                    {displayedActiveTab === "Custom Map" && <CustomMapTab analysis={analysis} />}
                    {displayedActiveTab === "Concepts" && (
                      <ConceptsTab concepts={concepts} onToggle={toggleConcept} onCopied={showCopied} onRegenerate={regenerateConcepts} />
                    )}
                    {displayedActiveTab === "Prompts" && (
                      <PromptsTab selectedConcepts={selectedConcepts} promptPacks={promptPacks} flags={outputFlags} onCopied={showCopied} />
                    )}
                    {displayedActiveTab === "Shopify Copy" && (
                      <ShopifyTab selectedConcepts={selectedConcepts} copyPacks={copyPacks} flags={outputFlags} onCopied={showCopied} />
                    )}
                    {displayedActiveTab === "Meta Ads" && <MetaTab selectedConcepts={selectedConcepts} copyPacks={copyPacks} flags={outputFlags} onCopied={showCopied} />}
                    {displayedActiveTab === "Export" && (
                      <ExportTab markdown={markdown} jsonValue={jsonExportValue} flags={outputFlags} onCopied={showCopied} onDownload={download} />
                    )}
                  </>
                )}
              </div>
            </section>
          </div>
        </section>
      </div>
      {toast ? <div className="fixed bottom-5 right-5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-white shadow-soft">{toast}</div> : null}
    </main>
  );
}

function BriefForm({
  project,
  screenshot,
  updateProject,
  updateScreenshot,
  onGenerate,
  onSaveDraft,
  onClearDraft,
  isGenerating,
}: {
  project: Project;
  screenshot: ScreenshotState | null;
  updateProject: <K extends keyof Project>(key: K, value: Project[K]) => void;
  updateScreenshot: (screenshot: ScreenshotState | null) => void;
  onGenerate: () => void;
  onSaveDraft: () => void;
  onClearDraft: () => void;
  isGenerating: boolean;
}) {
  const handleScreenshotChange = (file: File | undefined) => {
    if (!file) {
      updateScreenshot(null);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      updateScreenshot({
        name: file.name,
        type: file.type,
        size: file.size,
        base64: String(reader.result),
      });
    };
    reader.readAsDataURL(file);
  };

  return (
    <form className="grid gap-7 rounded-xl border border-border bg-white p-6 md:p-8">
      <FormSection title="Competitor Input">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <FieldLabel>Competitor product URL</FieldLabel>
            <TextInput value={project.competitorUrl || ""} onChange={(value) => updateProject("competitorUrl", value)} placeholder="https://..." />
          </div>
          <div className="space-y-2">
            <FieldLabel>Competitor brand/store</FieldLabel>
            <TextInput value={project.competitorBrand || ""} onChange={(value) => updateProject("competitorBrand", value)} placeholder="PawfectHouse, Etsy shop, Amazon seller" />
          </div>
        </div>
        <div className="space-y-2">
          <FieldLabel>Product title</FieldLabel>
          <TextInput value={project.productTitle || ""} onChange={(value) => updateProject("productTitle", value)} placeholder="Custom pet memorial suncatcher" />
        </div>
        <div className="space-y-2">
          <FieldLabel>Product description or notes</FieldLabel>
          <TextArea value={project.productDescription || ""} onChange={(value) => updateProject("productDescription", value)} placeholder="Paste product notes, visible options, or review snippets" />
        </div>
        <div className="rounded-xl border border-dashed border-border bg-surface-muted p-4">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_180px] md:items-center">
            <div>
              <FieldLabel>Competitor screenshot</FieldLabel>
              <p className="mt-1 text-xs leading-5 text-secondary">Upload a product screenshot if the competitor page is hard to fetch.</p>
              <input
                type="file"
                accept="image/*"
                onChange={(event) => handleScreenshotChange(event.target.files?.[0])}
                className="mt-3 block w-full text-sm text-secondary file:mr-3 file:rounded-full file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-white"
              />
              {screenshot ? (
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-secondary">
                  <span className="font-semibold text-primary">{screenshot.name}</span>
                  <span>{Math.round(screenshot.size / 1024)} KB</span>
                  <button type="button" onClick={() => updateScreenshot(null)} className="font-semibold text-danger">
                    Remove
                  </button>
                </div>
              ) : null}
            </div>
            <div className="grid min-h-32 place-items-center overflow-hidden rounded-lg border border-border bg-white">
              {screenshot ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={screenshot.base64} alt="Competitor screenshot preview" className="h-full max-h-44 w-full object-cover" />
              ) : (
                <div className="px-4 py-8 text-center">
                  <FileText className="mx-auto mb-2 text-primary" size={24} />
                  <p className="text-xs font-medium text-secondary">No screenshot</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </FormSection>

      <FormSection title="Strategy Controls">
        <p className="text-xs font-medium uppercase tracking-[0.06em] text-secondary">Product context</p>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <FieldLabel>Product type</FieldLabel>
            <SelectField value={project.productType || "Suncatcher"} options={PRODUCT_TYPES} onChange={(value) => updateProject("productType", value)} />
          </div>
          <div className="space-y-2">
            <FieldLabel>Buyer persona</FieldLabel>
            <SelectField value={project.buyerPersona || "Dog Mom"} options={BUYER_PERSONAS} onChange={(value) => updateProject("buyerPersona", value)} />
          </div>
          <div className="space-y-2">
            <FieldLabel>Occasion</FieldLabel>
            <SelectField value={project.occasion || "Pet Memorial"} options={OCCASIONS} onChange={(value) => updateProject("occasion", value)} />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2 md:col-span-2">
            <FieldLabel>Niche</FieldLabel>
            <TextInput value={project.niche || ""} onChange={(value) => updateProject("niche", value)} placeholder="Personalized pet gifts" />
          </div>
          <div className="space-y-2">
            <FieldLabel>Price range</FieldLabel>
            <TextInput value={project.priceRange || ""} onChange={(value) => updateProject("priceRange", value)} placeholder="$19-$39" />
          </div>
        </div>
        <div className="border-t border-border pt-5">
          <p className="text-xs font-medium uppercase tracking-[0.06em] text-secondary">Brand direction</p>
        </div>
        <div className="space-y-2">
          <FieldLabel>Brand voice</FieldLabel>
          <MultiPillPicker options={BRAND_VOICES} selected={project.brandVoice || []} onChange={(value) => updateProject("brandVoice", value)} />
        </div>
        <div className="space-y-2">
          <FieldLabel>Visual style</FieldLabel>
          <MultiPillPicker options={ART_STYLES} selected={project.visualStyle || []} onChange={(value) => updateProject("visualStyle", value)} />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <FieldLabel>Avoid words/visuals</FieldLabel>
            <TextArea value={project.avoidList || ""} onChange={(value) => updateProject("avoidList", value)} rows={3} placeholder="Avoid exact slogans, rainbow bridge phrase, copied border..." />
          </div>
          <div className="space-y-2">
            <FieldLabel>User notes</FieldLabel>
            <TextArea value={project.userNotes || ""} onChange={(value) => updateProject("userNotes", value)} rows={3} placeholder="Anything your brand should emphasize" />
          </div>
        </div>
      </FormSection>

      <FormSection title="Output Goals">
        <MultiPillPicker options={OUTPUT_REQUESTS} selected={project.outputs || []} onChange={(value) => updateProject("outputs", value)} />
      </FormSection>

      <div className="flex flex-wrap justify-end gap-3">
        <button type="button" onClick={onClearDraft} className="focus-ring inline-flex h-11 items-center gap-2 rounded-full border border-primary bg-white px-5 text-sm font-medium text-primary hover:bg-surface-muted">
          Clear Draft
        </button>
        <button type="button" onClick={onSaveDraft} className="focus-ring inline-flex h-11 items-center gap-2 rounded-full border border-primary bg-white px-5 text-sm font-medium text-primary hover:bg-surface-muted">
          <Check size={17} />
          Save Draft
        </button>
        <button type="button" onClick={onGenerate} disabled={isGenerating} className="focus-ring inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-white hover:bg-shade-70 disabled:cursor-not-allowed disabled:opacity-70">
          <Sparkles size={17} className={isGenerating ? "animate-pulse" : ""} />
          {isGenerating ? "Building product strategy..." : "Generate Strategy"}
        </button>
      </div>
    </form>
  );
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-4">
      <legend className="mb-4 text-xl font-medium">{title}</legend>
      {children}
    </fieldset>
  );
}

function BriefSummary({
  project,
  analysis,
  selectedCount,
  onGenerate,
  isGenerating,
}: {
  project: Project;
  analysis: Analysis | null;
  selectedCount: number;
  onGenerate: () => void;
  isGenerating: boolean;
}) {
  const summary = [
    ["Product type", project.productType],
    ["Buyer", project.buyerPersona],
    ["Occasion", project.occasion],
    ["Niche", project.niche],
    ["Brand voice", project.brandVoice?.join(", ")],
    ["Visual style", project.visualStyle?.join(", ")],
    ["Outputs", `${project.outputs?.length || 0} selected`],
  ];

  return (
    <aside className="h-fit space-y-4 xl:sticky xl:top-28">
      <div className="rounded-xl border border-black/10 bg-accent p-6 md:p-8">
        <h3 className="text-2xl font-medium">Creative readiness</h3>
        <p className="mt-2 text-sm leading-6 text-shade-70">Confirm the buyer, occasion, and output goals before generating the creative pack.</p>
        <div className="mt-4 space-y-3">
          {summary.map(([label, value]) => (
            <div key={label} className="rounded-lg border border-black/10 bg-white/70 px-3 py-2">
              <p className="text-xs font-medium text-secondary">{label}</p>
              <p className="mt-1 text-sm font-medium text-primary">{value || "Not set"}</p>
            </div>
          ))}
        </div>
        <button type="button" onClick={onGenerate} disabled={isGenerating} className="focus-ring mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-white hover:bg-shade-70 disabled:cursor-not-allowed disabled:opacity-70">
          <RefreshCw size={16} className={isGenerating ? "animate-spin" : ""} />
          {isGenerating ? "Building..." : "Generate Strategy"}
        </button>
      </div>
      <div className="rounded-xl border border-border bg-white p-6">
        <p className="text-sm font-medium text-secondary">Pack status</p>
        <p className="mt-2 text-3xl font-semibold">{selectedCount}</p>
        <p className="text-sm text-secondary">selected concepts ready for prompts, copy, and export.</p>
        {analysis ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <ScoreBadge label="Custom" value={analysis.scores.customDepth} />
            <ScoreBadge label="Ads" value={analysis.scores.adsPotential} />
          </div>
        ) : null}
      </div>
    </aside>
  );
}

function EmptyState({ onGenerate, isGenerating }: { onGenerate: () => void; isGenerating: boolean }) {
  return (
    <div className="grid place-items-center rounded-xl border border-dashed border-border bg-surface-muted px-4 py-16 text-center">
      <Sparkles className="mb-3 text-primary" size={30} />
      <h3 className="text-xl font-medium">Your creative pack will appear here.</h3>
      <p className="mt-2 max-w-md text-sm leading-6 text-secondary">Add a competitor product, define your buyer and occasion, then generate a strategy.</p>
      <button type="button" onClick={onGenerate} disabled={isGenerating} className="focus-ring mt-5 inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-white hover:bg-shade-70 disabled:cursor-not-allowed disabled:opacity-70">
        <Sparkles size={16} className={isGenerating ? "animate-pulse" : ""} />
        {isGenerating ? "Building product strategy..." : "Generate Strategy"}
      </button>
    </div>
  );
}

function OverviewTab({ analysis, onCopied }: { analysis: Analysis; onCopied: () => void }) {
  const breakdown = analysis.productBreakdown;
  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-4">
        <InfoCard title="Product Type" value={breakdown.productType} />
        <InfoCard title="Buyer Persona" value={breakdown.coreBuyer} />
        <InfoCard title="Core Emotion" value={breakdown.coreEmotion} />
        <InfoCard title="Occasion" value={breakdown.coreOccasion} />
      </div>
      <div className="flex flex-wrap gap-2">
        <ScoreBadge label="Custom Depth" value={analysis.scores.customDepth} />
        <ScoreBadge label="Ads Potential" value={analysis.scores.adsPotential} />
        <ScoreBadge label="Production" value={analysis.scores.productionDifficulty} />
        <ScoreBadge label="Copy Risk" value={analysis.scores.copyRisk} />
      </div>
      <PromptBlock title="Competitor Product Breakdown" value={JSON.stringify(breakdown, null, 2)} onCopied={onCopied} />
      <div className="grid gap-4 md:grid-cols-3">
        <ListCard title="Keep as inspiration" items={analysis.inspirationRules.keepAsInspiration} />
        <ListCard title="Do not copy" items={analysis.inspirationRules.doNotCopy} danger />
        <ListCard title="Improvement opportunities" items={analysis.improvementOpportunities} />
      </div>
    </div>
  );
}

function InfoCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-white p-5">
      <p className="text-xs font-medium uppercase tracking-[0.06em] text-secondary">{title}</p>
      <p className="mt-2 text-base font-medium leading-6 text-primary">{value}</p>
    </div>
  );
}

function ListCard({ title, items, danger = false }: { title: string; items: string[]; danger?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-white p-5">
      <h4 className={cx("text-base font-medium", danger ? "text-danger" : "text-primary")}>{title}</h4>
      <ul className="mt-3 space-y-2 text-sm leading-6 text-secondary">
        {items.map((item) => (
          <li key={item}>- {item}</li>
        ))}
      </ul>
    </div>
  );
}

function CustomMapTab({ analysis }: { analysis: Analysis }) {
  return (
    <div className="space-y-5">
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[720px] border-collapse bg-white text-left text-sm">
          <thead className="bg-surface-muted text-xs uppercase tracking-[0.06em] text-secondary">
            <tr>
              {["Custom Field", "Example", "Emotional Value", "Difficulty", "Recommended", "Shopify Label"].map((head) => (
                <th key={head} className="px-4 py-3 font-medium">{head}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {analysis.customFields.map((field) => (
              <tr key={field.name} className="border-t border-border">
                <td className="px-4 py-3 font-semibold">{field.name}</td>
                <td className="px-4 py-3 text-secondary">{field.example}</td>
                <td className="px-4 py-3"><ScoreBadge label="" value={field.emotionalValue} /></td>
                <td className="px-4 py-3"><ScoreBadge label="" value={field.difficulty} /></td>
                <td className="px-4 py-3">{field.recommended ? "Yes" : "No"}</td>
                <td className="px-4 py-3 text-secondary">{field.shopifyOptionLabel}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <InfoCard title="Best combination" value="Photo + name + occasion date + short message" />
        <InfoCard title="Fields to avoid" value="Long poems, copied competitor slogans, too many layout choices" />
        <InfoCard title="Shopify label style" value="Plain, specific option names shoppers understand quickly" />
      </div>
    </div>
  );
}

function ConceptsTab({
  concepts,
  onToggle,
  onCopied,
  onRegenerate,
}: {
  concepts: Concept[];
  onToggle: (id: string) => void;
  onCopied: () => void;
  onRegenerate: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button type="button" onClick={onRegenerate} className="focus-ring inline-flex h-10 items-center gap-2 rounded-full border border-primary bg-white px-4 text-sm font-medium text-primary hover:bg-surface-muted">
          <RefreshCw size={16} />
          Regenerate concepts
        </button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {concepts.map((concept) => (
          <article key={concept.id} className={cx("rounded-xl border p-5 transition", concept.selected ? "border-black/10 bg-accent" : "border-border bg-white hover:border-shade-30")}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-medium">{concept.name}</h3>
                <p className="mt-2 text-sm leading-6 text-secondary">{concept.oneLineIdea}</p>
              </div>
              <button type="button" onClick={() => onToggle(concept.id)} className={cx("focus-ring h-9 shrink-0 rounded-full px-4 text-xs font-medium", concept.selected ? "bg-primary text-white" : "border border-primary bg-white text-primary hover:bg-surface-muted")}>
                {concept.selected ? "Selected" : "Select"}
              </button>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <ScoreBadge label="Custom" value={concept.scores.customDepth} />
              <ScoreBadge label="Ads" value={concept.scores.adsPotential} />
              <ScoreBadge label="Production" value={concept.scores.productionDifficulty} />
            </div>
            <dl className="mt-4 grid gap-3 text-sm">
              <Detail label="Design" value={concept.designDirection} />
              <Detail label="Mockup" value={concept.mockupDirection} />
              <Detail label="Ad hook" value={concept.adHook} />
            </dl>
            <div className="mt-4 flex gap-2">
              <CopyButton value={JSON.stringify(concept, null, 2)} onCopied={onCopied} />
              <button type="button" className="focus-ring inline-flex h-9 items-center gap-1.5 rounded-full border border-primary bg-white px-3 text-xs font-medium text-primary hover:bg-surface-muted">
                <RefreshCw size={14} />
                Regenerate
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-[0.06em] text-secondary">{label}</dt>
      <dd className="mt-1 leading-6 text-secondary">{value}</dd>
    </div>
  );
}

function PromptsTab({
  selectedConcepts,
  promptPacks,
  flags,
  onCopied,
}: {
  selectedConcepts: Concept[];
  promptPacks: Record<string, PromptPack>;
  flags: OutputFlags;
  onCopied: () => void;
}) {
  if (!selectedConcepts.length) return <p className="text-sm text-secondary">Select concepts to generate prompt packs.</p>;
  const visiblePromptKeys = new Set([
    ...(flags.designPrompts ? ["designPrompt"] : []),
    ...(flags.mockupPrompts
      ? [
          "lifestyleMockupPrompt",
          "banner21x9Prompt",
          "showcase16x9Prompt",
          "product468x598Prompt",
          "square1x1Prompt",
          "reel9x16Prompt",
        ]
      : []),
  ]);

  return (
    <div className="space-y-6">
      {selectedConcepts.map((concept) => {
        const pack = promptPacks[concept.id];
        if (!pack) return null;
        return (
          <section key={concept.id} className="space-y-3">
            <h3 className="text-lg font-semibold">{concept.name}</h3>
            <div className="grid gap-3">
              {Object.entries(pack)
                .filter(([key]) => visiblePromptKeys.has(key))
                .map(([key, value]) => (
                  <PromptBlock key={key} title={key.replace(/([A-Z0-9])/g, " $1").trim()} value={String(value)} onCopied={onCopied} />
                ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function ShopifyTab({
  selectedConcepts,
  copyPacks,
  flags,
  onCopied,
}: {
  selectedConcepts: Concept[];
  copyPacks: Record<string, CopyPack>;
  flags: OutputFlags;
  onCopied: () => void;
}) {
  if (!selectedConcepts.length) return <p className="text-sm text-secondary">Select concepts to generate Shopify copy.</p>;
  return (
    <div className="space-y-6">
      {selectedConcepts.map((concept) => {
        const pack = copyPacks[concept.id];
        if (!pack) return null;
        return (
          <section key={concept.id} className="space-y-3 rounded-xl border border-border bg-white p-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-xl font-medium">{concept.name}</h3>
              <CopyButton value={JSON.stringify(pack, null, 2)} onCopied={onCopied} />
            </div>
            {flags.shopifyCopy ? (
              <>
                <ListCard title="Product title options" items={pack.shopifyTitles} />
                <PromptBlock title="Full product description" value={pack.fullDescription} onCopied={onCopied} />
                <ListCard title="Bullet benefits" items={pack.bulletBenefits} />
              </>
            ) : null}
            {flags.seo ? <ListCard title="Tags" items={pack.tags} /> : null}
          </section>
        );
      })}
    </div>
  );
}

function MetaTab({
  selectedConcepts,
  copyPacks,
  flags,
  onCopied,
}: {
  selectedConcepts: Concept[];
  copyPacks: Record<string, CopyPack>;
  flags: OutputFlags;
  onCopied: () => void;
}) {
  if (!flags.metaAds) return <p className="text-sm text-secondary">Meta Ads output is not selected for this brief.</p>;
  if (!selectedConcepts.length) return <p className="text-sm text-secondary">Select concepts to generate Meta Ads copy.</p>;
  return (
    <div className="space-y-6">
      {selectedConcepts.map((concept) => {
        const pack = copyPacks[concept.id];
        if (!pack) return null;
        return (
          <section key={concept.id} className="grid gap-4 rounded-xl border border-border bg-white p-5 md:grid-cols-2">
            <div className="md:col-span-2">
              <h3 className="text-xl font-medium">{concept.name}</h3>
            </div>
            <ListCard title="Hook options" items={pack.metaHooks} />
            <ListCard title="Primary text options" items={pack.primaryTexts} />
            <ListCard title="Headline options" items={pack.headlines} />
            <ListCard title="Testing plan" items={pack.testingPlan} />
            <PromptBlock title="UGC script idea" value={pack.ugcScriptIdea} onCopied={onCopied} />
          </section>
        );
      })}
    </div>
  );
}

function ExportTab({
  markdown,
  jsonValue,
  flags,
  onCopied,
  onDownload,
}: {
  markdown: string;
  jsonValue: string;
  flags: OutputFlags;
  onCopied: () => void;
  onDownload: (name: string, value: string, type: string) => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-2xl font-medium">Export your full creative pack.</h3>
        <p className="mt-2 text-sm text-secondary">Download everything as Markdown or JSON so you can use it with Codex, Shopify, or your design workflow.</p>
      </div>
      <div className="flex flex-wrap gap-3">
        {flags.exportMarkdown ? (
          <button type="button" onClick={() => onDownload("pod-creative-pack.md", markdown, "text/markdown")} className="focus-ring inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-white hover:bg-shade-70">
            <Download size={17} />
            Download Markdown
          </button>
        ) : null}
        {flags.exportJson ? (
          <button type="button" onClick={() => onDownload("pod-creative-pack.json", jsonValue, "application/json")} className="focus-ring inline-flex h-11 items-center gap-2 rounded-full border border-primary bg-white px-5 text-sm font-medium text-primary hover:bg-surface-muted">
            <FileJson size={17} />
            Download JSON
          </button>
        ) : null}
        <CopyButton value={markdown} onCopied={onCopied} />
      </div>
      <PromptBlock title="Markdown preview" value={markdown} onCopied={onCopied} />
    </div>
  );
}
