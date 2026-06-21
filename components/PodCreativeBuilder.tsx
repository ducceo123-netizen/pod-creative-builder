"use client";

import {
  Archive,
  Check,
  Clipboard,
  Download,
  FileJson,
  Home,
  Layers3,
  Library,
  Plus,
  RefreshCw,
  Settings,
  Sparkles,
  Star,
  Upload,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { BRAND_VOICES, ART_STYLES, BUYER_PERSONAS, OCCASIONS, OUTPUT_REQUESTS, PRODUCT_TYPES } from "@/lib/constants";
import { exportMarkdown } from "@/lib/exportMarkdown";
import { createProject, generateConcepts, generateCopyPack, generatePromptPack } from "@/lib/generate";
import { cleanGenericOtherLanguage, hasGenericOutputWarning, normalizeProject } from "@/lib/normalizeProject";
import { filterExportData, getOutputFlags, type OutputFlags } from "@/lib/outputFilters";
import { buildLocalStrategy, type GenerateStrategyResponse } from "@/lib/strategy";
import type { Analysis } from "@/types/analysis";
import type { Concept } from "@/types/concept";
import type { CopyPack } from "@/types/copyPack";
import type { Project } from "@/types/project";
import type { PromptPack } from "@/types/promptPack";

const tabs = ["Overview", "Custom Map", "Concepts", "Prompts", "Creative Assets", "Shopify Copy", "Meta Ads", "Export"];
const PROJECT_DRAFT_KEY = "pod-builder-project-draft";
const SCREENSHOT_DRAFT_KEY = "pod-builder-screenshot-draft";
const DRAFTS_KEY = "pod-creative-drafts";
const CURRENT_DRAFT_ID_KEY = "pod-current-draft-id";
const navItems: Array<[string, LucideIcon, boolean]> = [
  ["Dashboard", Home, false],
  ["Product Brief", Plus, false],
  ["Concepts", Archive, false],
  ["Prompts", Library, false],
  ["Creative Assets", Layers3, false],
  ["Shopify Copy", Layers3, false],
  ["Meta Ads", Sparkles, false],
  ["Export", FileJson, false],
  ["Settings", Settings, false],
];

type ScreenshotState = {
  name: string;
  type: string;
  size: number;
  base64: string;
};

type ReadinessResult = {
  score: number;
  completed: number;
  total: number;
  label: "Needs brief" | "Good enough" | "Ready to generate";
  missing: string[];
};

type GenerationSource = "groq" | "gemini" | "openai" | "local-template";

type GenerationMeta = {
  usedAI: boolean;
  generationSource: GenerationSource;
  model?: string;
  fallbackUsed: boolean;
  fallbackReason?: string;
  durationMs?: number;
  generatedAt?: string;
};

type GenerationVersion = {
  id: string;
  draftId: string;
  label: string;
  analysis: Analysis;
  concepts: Concept[];
  promptPacks: Record<string, PromptPack>;
  copyPacks: Record<string, CopyPack>;
  generationMeta: GenerationMeta;
  createdAt: string;
};

type ConceptExtras = Record<string, { favorite?: boolean; notes?: string }>;

type CreativeAssetPlan = {
  id: string;
  conceptId: string;
  type: "design-file" | "product-closeup" | "lifestyle-mockup" | "shopify-hero" | "meta-ad" | "ugc-frame";
  title: string;
  ratio: "1:1" | "4:5" | "9:16" | "16:9" | "21:9" | "468:598";
  prompt: string;
  negativePrompt?: string;
  status: "planned" | "generating" | "generated" | "failed" | "approved";
  imageUrl?: string;
  provider?: string;
  model?: string;
  createdAt: string;
};

type CreativeDraft = {
  id: string;
  title: string;
  competitorBrand?: string;
  competitorUrl?: string;
  productType: string;
  buyerPersona: string;
  occasion: string;
  niche?: string;
  status: "draft" | "generated" | "selected" | "archived";
  project: Project;
  analysis?: Analysis | null;
  concepts?: Concept[];
  promptPacks?: Record<string, PromptPack>;
  copyPacks?: Record<string, CopyPack>;
  screenshot?: ScreenshotState | null;
  conceptExtras?: ConceptExtras;
  assetPlans?: CreativeAssetPlan[];
  generationMeta?: GenerationMeta;
  versions?: GenerationVersion[];
  createdAt: string;
  updatedAt: string;
};

type AppView = "Dashboard" | "Product Brief" | "Settings";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function createDefaultProject() {
  return createProject({
    name: "Untitled POD creative brief",
    competitorBrand: "",
    productTitle: "",
    productDescription: "",
    competitorUrl: "",
    productType: "",
    customProductType: "",
    buyerPersona: "",
    occasion: "",
    niche: "",
    priceRange: "",
    brandVoice: [],
    visualStyle: [],
    customVisualStyle: "",
    avoidList: "",
    userNotes: "",
    outputs: [],
  });
}

function id(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function readDrafts(): CreativeDraft[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(DRAFTS_KEY) || "[]") as CreativeDraft[];
  } catch {
    localStorage.removeItem(DRAFTS_KEY);
    return [];
  }
}

function writeDrafts(drafts: CreativeDraft[]) {
  localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
}

function getCurrentDraft(): CreativeDraft | null {
  if (typeof window === "undefined") return null;
  const currentId = localStorage.getItem(CURRENT_DRAFT_ID_KEY);
  if (!currentId) return null;
  return readDrafts().find((draft) => draft.id === currentId) || null;
}

function getDraftTitle(project: Project) {
  return project.productTitle?.trim() || project.name?.trim() || "Untitled POD Draft";
}

function getDraftStatus(project: Project, analysis: Analysis | null, concepts: Concept[]): CreativeDraft["status"] {
  if (concepts.some((concept) => concept.selected)) return "selected";
  if (analysis || project.status === "generated") return "generated";
  return "draft";
}

function getSourceLabel(meta?: GenerationMeta) {
  if (!meta) return "Not generated";
  if (meta.fallbackUsed) return "Local fallback";
  if (meta.generationSource === "groq") return "Groq";
  return meta.generationSource;
}

function formatDuration(ms?: number) {
  if (!ms) return "";
  if (ms < 1000) return `${ms}ms`;
  return `${Math.round(ms / 1000)}s`;
}

function formatDate(value?: string) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function buildDraft(args: {
  id?: string;
  project: Project;
  analysis: Analysis | null;
  concepts: Concept[];
  promptPacks: Record<string, PromptPack>;
  copyPacks: Record<string, CopyPack>;
  screenshot: ScreenshotState | null;
  conceptExtras: ConceptExtras;
  assetPlans: CreativeAssetPlan[];
  generationMeta?: GenerationMeta;
  versions: GenerationVersion[];
  createdAt?: string;
}): CreativeDraft {
  const now = new Date().toISOString();
  const normalized = normalizeProject(args.project);
  return {
    id: args.id || id("draft"),
    title: getDraftTitle(args.project),
    competitorBrand: args.project.competitorBrand,
    competitorUrl: args.project.competitorUrl,
    productType: normalized.normalizedProductType,
    buyerPersona: args.project.buyerPersona || "Not set",
    occasion: args.project.occasion || "Not set",
    niche: args.project.niche,
    status: getDraftStatus(args.project, args.analysis, args.concepts),
    project: args.project,
    analysis: args.analysis,
    concepts: args.concepts,
    promptPacks: args.promptPacks,
    copyPacks: args.copyPacks,
    screenshot: args.screenshot,
    conceptExtras: args.conceptExtras,
    assetPlans: args.assetPlans,
    generationMeta: args.generationMeta,
    versions: args.versions,
    createdAt: args.createdAt || now,
    updatedAt: now,
  };
}

function buildAssetPlans(selectedConcepts: Concept[], promptPacks: Record<string, PromptPack>): CreativeAssetPlan[] {
  const now = new Date().toISOString();
  const templates: Array<Pick<CreativeAssetPlan, "type" | "title" | "ratio"> & { promptKey: keyof PromptPack }> = [
    { type: "design-file", title: "Design File", ratio: "1:1", promptKey: "designPrompt" },
    { type: "product-closeup", title: "Product Close-up", ratio: "468:598", promptKey: "product468x598Prompt" },
    { type: "lifestyle-mockup", title: "Lifestyle Mockup", ratio: "16:9", promptKey: "showcase16x9Prompt" },
    { type: "shopify-hero", title: "Shopify Hero", ratio: "21:9", promptKey: "banner21x9Prompt" },
    { type: "meta-ad", title: "Meta Ad Creative", ratio: "1:1", promptKey: "square1x1Prompt" },
    { type: "ugc-frame", title: "UGC / Short-form Frame", ratio: "9:16", promptKey: "reel9x16Prompt" },
  ];

  return selectedConcepts.flatMap((concept) => {
    const pack = promptPacks[concept.id];
    return templates.map((template) => ({
      id: id("asset"),
      conceptId: concept.id,
      type: template.type,
      title: `${concept.name} · ${template.title}`,
      ratio: template.ratio,
      prompt: String(pack?.[template.promptKey] || `${concept.name}: ${concept.designDirection} ${concept.mockupDirection}`),
      negativePrompt: "No copied competitor artwork, no brand logos, no distorted text, no unsafe claims.",
      status: "planned" as const,
      createdAt: now,
    }));
  });
}

function hasValue(value: unknown) {
  if (Array.isArray(value)) return value.length > 0;
  return typeof value === "string" ? value.trim().length > 0 : Boolean(value);
}

function getReadiness(project: Project, screenshot: ScreenshotState | null): ReadinessResult {
  const normalized = normalizeProject(project);
  const hasSpecificProduct = project.productType === "Other" ? normalized.normalizedProductType !== "Custom POD Product" : hasValue(project.productType);
  const hasSpecificStyle =
    project.visualStyle?.includes("Other") && project.visualStyle.length === 1
      ? normalized.normalizedVisualDirection !== "Custom POD Product design direction with original layout, clean personalization areas, gift-ready composition, and no copied competitor elements"
      : hasValue(project.visualStyle);
  const checks: Array<[boolean, string]> = [
    [hasValue(project.competitorUrl) || hasValue(project.productDescription) || Boolean(screenshot), "Add a competitor URL, notes, or screenshot"],
    [hasSpecificProduct, "Choose or specify a product type"],
    [hasValue(project.buyerPersona), "Choose a buyer"],
    [hasValue(project.occasion), "Choose an occasion"],
    [hasValue(project.niche), "Add a niche"],
    [hasValue(project.brandVoice), "Pick at least one brand voice"],
    [hasSpecificStyle, "Pick or describe a visual style"],
    [(project.outputs?.length || 0) >= 3, "Select at least 3 output goals"],
  ];
  const completed = checks.filter(([done]) => done).length;
  const score = Math.round((completed / checks.length) * 100);
  return {
    score,
    completed,
    total: checks.length,
    label: score >= 80 ? "Ready to generate" : score >= 50 ? "Good enough" : "Needs brief",
    missing: checks.filter(([done]) => !done).map(([, label]) => label),
  };
}

function formatFileSize(size: number) {
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(size / 1024))} KB`;
}

function TabIntro({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 border-b border-border pb-5 md:flex-row md:items-end md:justify-between">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.06em] text-secondary">{eyebrow}</p>
        <h3 className="mt-2 text-2xl font-medium text-primary">{title}</h3>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-secondary">{description}</p>
      </div>
      {action ? <div className="flex shrink-0 flex-wrap gap-2">{action}</div> : null}
    </div>
  );
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

function CopyButton({ value, onCopied, label = "Copy" }: { value: string; onCopied: () => void; label?: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1200);
        onCopied();
      }}
      className="focus-ring inline-flex h-9 items-center gap-1.5 rounded-full border border-primary bg-white px-3 text-xs font-medium text-primary hover:bg-surface-muted"
    >
      <Clipboard size={14} />
      {copied ? "Copied" : label}
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
        <option key={option} value={option}>
          {option || "Select one"}
        </option>
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
    const defaultProject = createDefaultProject();

    if (typeof window === "undefined") return defaultProject;

    const currentDraft = getCurrentDraft();
    if (currentDraft) return currentDraft.project;

    const saved = localStorage.getItem(PROJECT_DRAFT_KEY);
    if (!saved) return defaultProject;

    try {
      return JSON.parse(saved) as Project;
    } catch {
      localStorage.removeItem(PROJECT_DRAFT_KEY);
      return defaultProject;
    }
  });
  const [drafts, setDrafts] = useState<CreativeDraft[]>(() => readDrafts());
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(() => (typeof window === "undefined" ? null : localStorage.getItem(CURRENT_DRAFT_ID_KEY)));
  const [analysis, setAnalysis] = useState<Analysis | null>(() => getCurrentDraft()?.analysis || null);
  const [concepts, setConcepts] = useState<Concept[]>(() => getCurrentDraft()?.concepts || []);
  const [promptPacks, setPromptPacks] = useState<Record<string, PromptPack>>(() => getCurrentDraft()?.promptPacks || {});
  const [copyPacks, setCopyPacks] = useState<Record<string, CopyPack>>(() => getCurrentDraft()?.copyPacks || {});
  const [activeTab, setActiveTab] = useState("Overview");
  const [activeView, setActiveView] = useState<AppView>("Product Brief");
  const [toast, setToast] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState("");
  const [strategySource, setStrategySource] = useState("");
  const [screenshot, setScreenshot] = useState<ScreenshotState | null>(() => {
    if (typeof window === "undefined") return null;
    const currentDraft = getCurrentDraft();
    if (currentDraft) return currentDraft.screenshot || null;
    const saved = localStorage.getItem(SCREENSHOT_DRAFT_KEY);
    if (!saved) return null;
    try {
      return JSON.parse(saved) as ScreenshotState;
    } catch {
      localStorage.removeItem(SCREENSHOT_DRAFT_KEY);
      return null;
    }
  });
  const [generationMeta, setGenerationMeta] = useState<GenerationMeta | undefined>(() => getCurrentDraft()?.generationMeta);
  const [versions, setVersions] = useState<GenerationVersion[]>(() => getCurrentDraft()?.versions || []);
  const [activeVersionId, setActiveVersionId] = useState("");
  const [conceptExtras, setConceptExtras] = useState<ConceptExtras>(() => getCurrentDraft()?.conceptExtras || {});
  const [assetPlans, setAssetPlans] = useState<CreativeAssetPlan[]>(() => getCurrentDraft()?.assetPlans || []);
  const [health, setHealth] = useState<{ groqConfigured: boolean; imageProvider: string; imageProviderConfigured: boolean; appVersion: string } | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [clearNeedsConfirm, setClearNeedsConfirm] = useState(false);
  const clearConfirmTimer = useRef<number | null>(null);
  const outputRef = useRef<HTMLElement | null>(null);

  const selectedConcepts = useMemo(() => concepts.filter((concept) => concept.selected), [concepts]);
  const outputFlags = useMemo(() => getOutputFlags(project), [project]);
  const visibleTabs = useMemo(
    () =>
      tabs.filter((tab) => {
        if (tab === "Overview") return outputFlags.productBreakdown;
        if (tab === "Custom Map") return outputFlags.customMap;
        if (tab === "Concepts") return outputFlags.concepts;
        if (tab === "Prompts") return outputFlags.designPrompts || outputFlags.mockupPrompts;
        if (tab === "Creative Assets") return true;
        if (tab === "Shopify Copy") return outputFlags.shopifyCopy || outputFlags.seo;
        if (tab === "Meta Ads") return outputFlags.metaAds;
        if (tab === "Export") return outputFlags.exportMarkdown || outputFlags.exportJson;
        return true;
      }),
    [outputFlags],
  );
  const displayedActiveTab = visibleTabs.includes(activeTab) ? activeTab : visibleTabs[0] || "Overview";
  const readiness = useMemo(() => getReadiness(project, screenshot), [project, screenshot]);
  const hasGeneratedPack = Boolean(analysis);
  const markdown = useMemo(() => {
    const base = exportMarkdown({ project, analysis, concepts, prompts: promptPacks, copies: copyPacks, flags: outputFlags });
    return `${base}
## Generation Metadata

- Strategy source: ${getSourceLabel(generationMeta)}
- Model: ${generationMeta?.model || "Not set"}
- Fallback used: ${generationMeta?.fallbackUsed ? "Yes" : "No"}
- Generated at: ${generationMeta?.generatedAt || "Not generated"}
- Draft ID: ${currentDraftId || "Unsaved"}
- Version ID: ${activeVersionId || versions[0]?.id || "No version"}
- Screenshot included: ${screenshot ? "Yes" : "No"}
`;
  }, [activeVersionId, analysis, concepts, copyPacks, currentDraftId, generationMeta, outputFlags, project, promptPacks, screenshot, versions]);
  const jsonExportValue = useMemo(() => {
    const normalized = normalizeProject(project);
    const filtered = filterExportData({ project, concepts, promptPacks, copyPacks });
    return cleanGenericOtherLanguage(JSON.stringify(
      {
        project: {
          ...project,
          productType: normalized.normalizedProductType,
          visualStyle: [normalized.normalizedVisualDirection],
        },
        analysis,
        concepts: filtered.concepts,
        promptPacks: filtered.promptPacks,
        copyPacks: filtered.copyPacks,
        assetPlans,
        generationMeta,
        versions,
        screenshot: screenshot ? { name: screenshot.name, type: screenshot.type, size: screenshot.size } : null,
        screenshotIncluded: Boolean(screenshot),
        exportedAt: new Date().toISOString(),
      },
      null,
      2,
    ));
  }, [analysis, assetPlans, concepts, copyPacks, generationMeta, project, promptPacks, screenshot, versions]);
  const genericExportWarning = useMemo(() => hasGenericOutputWarning(`${markdown}\n${jsonExportValue}`), [jsonExportValue, markdown]);

  const updateProject = <K extends keyof Project>(key: K, value: Project[K]) => {
    setProject((current) => ({ ...current, [key]: value, updatedAt: new Date().toISOString() }));
    setHasUnsavedChanges(true);
  };

  const updateScreenshotDraft = (nextScreenshot: ScreenshotState | null) => {
    setScreenshot(nextScreenshot);
    setHasUnsavedChanges(true);
  };

  const showCopied = () => {
    setToast("Copied");
    window.setTimeout(() => setToast(""), 1400);
  };

  const applyStrategy = (strategy: GenerateStrategyResponse, meta: GenerationMeta) => {
    setAnalysis(strategy.analysis);
    setConcepts(strategy.concepts);
    setPromptPacks(strategy.promptPacks);
    setCopyPacks(strategy.copyPacks);
    setGenerationMeta(meta);
    setStrategySource(getSourceLabel(meta));
    setProject((current) => ({ ...current, status: "generated", name: current.productTitle || current.name }));
    const draftId = currentDraftId || id("draft");
    if (!currentDraftId) {
      setCurrentDraftId(draftId);
      localStorage.setItem(CURRENT_DRAFT_ID_KEY, draftId);
    }
    const version: GenerationVersion = {
      id: id("version"),
      draftId,
      label: `Version ${versions.length + 1}`,
      analysis: strategy.analysis,
      concepts: strategy.concepts,
      promptPacks: strategy.promptPacks,
      copyPacks: strategy.copyPacks,
      generationMeta: meta,
      createdAt: new Date().toISOString(),
    };
    setVersions((current) => [version, ...current]);
    setActiveVersionId(version.id);
    setAssetPlans(buildAssetPlans(strategy.concepts.filter((concept) => concept.selected), strategy.promptPacks));
    setActiveTab(visibleTabs[0] || "Overview");
    setToast("Creative pack generated");
    window.setTimeout(() => setToast(""), 1600);
    window.setTimeout(() => outputRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  const generateStrategy = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    setGenerationError("");
    const startedAt = new Date().getTime();

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
      const fallbackUsed = data.source === "local-fallback" || data.source === "local";
      applyStrategy(data, {
        usedAI: data.source === "groq",
        generationSource: data.source === "groq" ? "groq" : "local-template",
        model: data.source === "groq" ? "llama-3.3-70b-versatile" : undefined,
        fallbackUsed,
        fallbackReason: fallbackUsed ? "API route used local template generation." : undefined,
        durationMs: new Date().getTime() - startedAt,
        generatedAt: new Date().toISOString(),
      });
    } catch (error) {
      const fallback = buildLocalStrategy(project);
      const fallbackReason = error instanceof Error ? error.message : "Generation failed. Local fallback was used.";
      applyStrategy(fallback, {
        usedAI: false,
        generationSource: "local-template",
        fallbackUsed: true,
        fallbackReason,
        durationMs: new Date().getTime() - startedAt,
        generatedAt: new Date().toISOString(),
      });
      setGenerationError(fallbackReason);
    } finally {
      setIsGenerating(false);
    }
  };

  const regenerateConcepts = () => {
    if (!analysis) return;

    const normalized = normalizeProject(project);
    const nextConcepts = generateConcepts(project, analysis);
    const nextPrompts: Record<string, PromptPack> = {};
    const nextCopies: Record<string, CopyPack> = {};

    nextConcepts
      .filter((concept) => concept.selected)
      .forEach((concept) => {
        nextPrompts[concept.id] = generatePromptPack(concept, normalized.normalizedProductType);
        nextCopies[concept.id] = generateCopyPack(concept, normalized.normalizedProductType);
      });

    setConcepts(nextConcepts);
    setPromptPacks(nextPrompts);
    setCopyPacks(nextCopies);
  };

  const saveDraft = () => {
    const existing = currentDraftId ? drafts.find((draft) => draft.id === currentDraftId) : null;
    const draft = buildDraft({
      id: currentDraftId || undefined,
      project,
      analysis,
      concepts,
      promptPacks,
      copyPacks,
      screenshot,
      conceptExtras,
      assetPlans,
      generationMeta,
      versions,
      createdAt: existing?.createdAt,
    });
    const nextDrafts = existing ? drafts.map((item) => (item.id === draft.id ? draft : item)) : [draft, ...drafts];
    setDrafts(nextDrafts);
    setCurrentDraftId(draft.id);
    writeDrafts(nextDrafts);
    localStorage.setItem(CURRENT_DRAFT_ID_KEY, draft.id);
    localStorage.setItem(PROJECT_DRAFT_KEY, JSON.stringify(project));
    if (screenshot) {
      localStorage.setItem(SCREENSHOT_DRAFT_KEY, JSON.stringify(screenshot));
    } else {
      localStorage.removeItem(SCREENSHOT_DRAFT_KEY);
    }
    setHasUnsavedChanges(false);
    setToast("Draft saved");
    window.setTimeout(() => setToast(""), 1400);
  };

  const loadDraft = (draft: CreativeDraft) => {
    setCurrentDraftId(draft.id);
    localStorage.setItem(CURRENT_DRAFT_ID_KEY, draft.id);
    setProject(draft.project);
    setAnalysis(draft.analysis || null);
    setConcepts(draft.concepts || []);
    setPromptPacks(draft.promptPacks || {});
    setCopyPacks(draft.copyPacks || {});
    setScreenshot(draft.screenshot || null);
    setConceptExtras(draft.conceptExtras || {});
    setAssetPlans(draft.assetPlans || []);
    setGenerationMeta(draft.generationMeta);
    setVersions(draft.versions || []);
    setStrategySource(getSourceLabel(draft.generationMeta));
    setActiveView("Product Brief");
    setActiveTab(draft.analysis ? "Overview" : "Overview");
    setHasUnsavedChanges(false);
    setToast("Draft opened");
    window.setTimeout(() => setToast(""), 1400);
  };

  const createNewDraft = () => {
    setCurrentDraftId(null);
    localStorage.removeItem(CURRENT_DRAFT_ID_KEY);
    localStorage.removeItem(PROJECT_DRAFT_KEY);
    localStorage.removeItem(SCREENSHOT_DRAFT_KEY);
    setProject(createDefaultProject());
    setAnalysis(null);
    setConcepts([]);
    setPromptPacks({});
    setCopyPacks({});
    setScreenshot(null);
    setConceptExtras({});
    setAssetPlans([]);
    setGenerationMeta(undefined);
    setVersions([]);
    setStrategySource("");
    setActiveView("Product Brief");
    setHasUnsavedChanges(true);
  };

  const duplicateDraft = (draft: CreativeDraft) => {
    const now = new Date().toISOString();
    const copy: CreativeDraft = {
      ...draft,
      id: id("draft"),
      title: `${draft.title} Copy`,
      project: { ...draft.project, id: id("project"), name: `${draft.project.name} Copy`, createdAt: now, updatedAt: now },
      createdAt: now,
      updatedAt: now,
    };
    const nextDrafts = [copy, ...drafts];
    setDrafts(nextDrafts);
    writeDrafts(nextDrafts);
    setToast("Draft duplicated");
    window.setTimeout(() => setToast(""), 1400);
  };

  const archiveDraft = (draftId: string) => {
    const nextDrafts = drafts.map((draft) =>
      draft.id === draftId ? { ...draft, status: "archived" as const, updatedAt: new Date().toISOString() } : draft,
    );
    setDrafts(nextDrafts);
    writeDrafts(nextDrafts);
  };

  const deleteDraft = (draftId: string) => {
    const nextDrafts = drafts.filter((draft) => draft.id !== draftId);
    setDrafts(nextDrafts);
    writeDrafts(nextDrafts);
    if (currentDraftId === draftId) createNewDraft();
  };

  const clearDraft = () => {
    if (!clearNeedsConfirm) {
      setClearNeedsConfirm(true);
      if (clearConfirmTimer.current) window.clearTimeout(clearConfirmTimer.current);
      clearConfirmTimer.current = window.setTimeout(() => setClearNeedsConfirm(false), 3500);
      setToast("Click clear again to confirm");
      window.setTimeout(() => setToast(""), 1400);
      return;
    }

    if (clearConfirmTimer.current) window.clearTimeout(clearConfirmTimer.current);
    localStorage.removeItem(PROJECT_DRAFT_KEY);
    localStorage.removeItem(SCREENSHOT_DRAFT_KEY);
    if (currentDraftId) {
      const nextDrafts = drafts.filter((draft) => draft.id !== currentDraftId);
      setDrafts(nextDrafts);
      writeDrafts(nextDrafts);
    }
    localStorage.removeItem(CURRENT_DRAFT_ID_KEY);
    setCurrentDraftId(null);
    setProject(createDefaultProject());
    setAnalysis(null);
    setConcepts([]);
    setPromptPacks({});
    setCopyPacks({});
    setActiveTab("Overview");
    setStrategySource("");
    setGenerationError("");
    setScreenshot(null);
    setConceptExtras({});
    setAssetPlans([]);
    setGenerationMeta(undefined);
    setVersions([]);
    setHasUnsavedChanges(false);
    setClearNeedsConfirm(false);
    setToast("Draft cleared");
    window.setTimeout(() => setToast(""), 1400);
  };

  const toggleConcept = (conceptId: string) => {
    const normalized = normalizeProject(project);
    setConcepts((current) => {
      const nextConcepts = current.map((concept) => {
        if (concept.id !== conceptId) return concept;
        const selected = !concept.selected;
        if (selected) {
          setPromptPacks((packs) => ({ ...packs, [concept.id]: generatePromptPack(concept, normalized.normalizedProductType) }));
          setCopyPacks((packs) => ({ ...packs, [concept.id]: generateCopyPack(concept, normalized.normalizedProductType) }));
        }
        return { ...concept, selected };
      });
      window.setTimeout(() => setAssetPlans(buildAssetPlans(nextConcepts.filter((concept) => concept.selected), promptPacks)), 0);
      return nextConcepts;
    });
    setProject((current) => ({ ...current, status: "selected" }));
    setHasUnsavedChanges(true);
  };

  const updateConceptExtra = (conceptId: string, value: { favorite?: boolean; notes?: string }) => {
    setConceptExtras((current) => ({
      ...current,
      [conceptId]: { ...current[conceptId], ...value },
    }));
    setProject((current) => ({ ...current, status: "selected" }));
    setHasUnsavedChanges(true);
  };

  const restoreVersion = (versionId: string) => {
    const version = versions.find((item) => item.id === versionId);
    if (!version) return;
    setAnalysis(version.analysis);
    setConcepts(version.concepts);
    setPromptPacks(version.promptPacks);
    setCopyPacks(version.copyPacks);
    setGenerationMeta(version.generationMeta);
    setActiveVersionId(version.id);
    setAssetPlans(buildAssetPlans(version.concepts.filter((concept) => concept.selected), version.promptPacks));
    setToast("Version restored");
    window.setTimeout(() => setToast(""), 1400);
  };

  const approveAsset = (assetId: string) => {
    setAssetPlans((current) =>
      current.map((asset) => (asset.id === assetId ? { ...asset, status: asset.status === "approved" ? "planned" : "approved" } : asset)),
    );
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

  const openSettings = async () => {
    setActiveView("Settings");
    try {
      const response = await fetch("/api/health");
      if (response.ok) setHealth(await response.json());
    } catch {
      setHealth(null);
    }
  };

  const openNav = (label: string) => {
    if (label === "Dashboard") {
      setActiveView("Dashboard");
      return;
    }
    if (label === "Settings") {
      void openSettings();
      return;
    }
    setActiveView("Product Brief");
    if (label === "Product Brief") {
      document.getElementById("product-brief")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    setActiveTab(label === "Shopify Copy" ? "Shopify Copy" : label);
    outputRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <main className="min-h-screen bg-background text-primary">
      <header className="sticky top-0 z-30 border-b border-border bg-white">
        <div className="flex min-h-[72px] flex-wrap items-center justify-between gap-3 px-4 py-4 md:flex-nowrap md:px-6">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-primary text-white">
              <Sparkles size={18} />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-base font-medium">POD Creative Builder</span>
              <span className="rounded-full border border-border bg-surface-muted px-2.5 py-1 text-xs font-medium text-secondary">MVP</span>
              <span className="hidden rounded-full border border-border bg-white px-2.5 py-1 text-xs font-medium text-secondary md:inline-flex">
                {getDraftStatus(project, analysis, concepts)}
              </span>
            </div>
          </div>

          <nav className="hidden items-center gap-1 text-sm font-medium text-secondary lg:flex">
            {["Competitor Brief", "Creative Pack", "Export"].map((item, index) => (
              <span key={item} className="inline-flex items-center gap-1 rounded-full px-3 py-2">
                {index > 0 ? <span className="text-muted">→</span> : null}
                <span>{item}</span>
              </span>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <button type="button" onClick={saveDraft} className="focus-ring inline-flex h-10 items-center rounded-full border border-primary bg-white px-3 text-xs font-medium text-primary hover:bg-surface-muted sm:h-11 sm:px-5 sm:text-sm">
              Save Draft
            </button>
            <button type="button" onClick={generateStrategy} disabled={isGenerating} className="focus-ring inline-flex h-10 items-center gap-2 rounded-full bg-primary px-3 text-xs font-medium text-white hover:bg-shade-70 disabled:cursor-not-allowed disabled:opacity-70 sm:h-11 sm:px-5 sm:text-sm">
              <Sparkles size={16} className={isGenerating ? "animate-pulse" : ""} />
              {isGenerating ? "Generating..." : "Generate Strategy"}
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
                onClick={() => openNav(label)}
                className={cx(
                  "focus-ring flex w-full items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium",
                  (activeView === label || (activeView === "Product Brief" && label === "Product Brief") || displayedActiveTab === label)
                    ? "border border-black/10 bg-accent text-primary"
                    : "text-secondary hover:bg-white",
                )}
              >
                <Icon size={16} />
                <span className="min-w-0 flex-1 text-left">{label}</span>
                {label === "Product Brief" && hasUnsavedChanges ? <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-primary">Draft</span> : null}
                {label === "Concepts" && hasGeneratedPack ? <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-primary">Ready</span> : null}
                {comingSoon ? <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-secondary">Soon</span> : null}
              </button>
            ))}
          </nav>
        </aside>

        <section className="min-w-0 flex-1 px-4 py-8 md:px-8 lg:py-12">
          <div className="mx-auto max-w-[1320px] space-y-8">
            <nav className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:hidden">
              {navItems.map(([label, Icon, comingSoon]) => (
                <button
                  type="button"
                  key={label}
                  onClick={() => openNav(label)}
                  className={cx(
                    "focus-ring inline-flex h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-medium",
                    (activeView === label || displayedActiveTab === label) ? "border-black/10 bg-accent text-primary" : "border-border bg-white text-secondary",
                  )}
                >
                  <Icon size={15} />
                  {label}
                  {comingSoon ? <span className="text-[10px]">Soon</span> : null}
                </button>
              ))}
            </nav>
            {activeView === "Dashboard" ? (
              <DashboardView
                drafts={drafts}
                onCreate={createNewDraft}
                onOpen={loadDraft}
                onDuplicate={duplicateDraft}
                onArchive={archiveDraft}
                onDelete={deleteDraft}
              />
            ) : activeView === "Settings" ? (
              <SettingsView health={health} generationMeta={generationMeta} onRefresh={openSettings} />
            ) : (
              <>
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
                updateScreenshot={updateScreenshotDraft}
                onGenerate={generateStrategy}
                onSaveDraft={saveDraft}
                onClearDraft={clearDraft}
                isGenerating={isGenerating}
                clearNeedsConfirm={clearNeedsConfirm}
              />

              <BriefSummary
                project={project}
                screenshot={screenshot}
                analysis={analysis}
                selectedCount={selectedConcepts.length}
                onGenerate={generateStrategy}
                isGenerating={isGenerating}
                readiness={readiness}
              />
            </section>

            <section ref={outputRef} className="scroll-mt-24 rounded-xl border border-border bg-white">
              <div className="overflow-x-auto border-b border-border p-3">
                <div className="flex min-w-max items-center gap-2">
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
                  {versions.length ? (
                    <select
                      value={activeVersionId}
                      onChange={(event) => restoreVersion(event.target.value)}
                      className="focus-ring ml-2 h-10 rounded-full border border-border bg-white px-3 text-sm font-medium text-secondary"
                    >
                      <option value="">Versions</option>
                      {versions.map((version) => (
                        <option key={version.id} value={version.id}>
                          {version.label} · {getSourceLabel(version.generationMeta)} · {formatDuration(version.generationMeta.durationMs)}
                        </option>
                      ))}
                    </select>
                  ) : null}
                </div>
              </div>
              <div className="p-5 md:p-8">
                {isGenerating ? (
                  <LoadingState />
                ) : !analysis ? (
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
                    {displayedActiveTab === "Custom Map" && <CustomMapTab analysis={analysis} onCopied={showCopied} />}
                    {displayedActiveTab === "Concepts" && (
                      <ConceptsTab
                        concepts={concepts}
                        conceptExtras={conceptExtras}
                        onToggle={toggleConcept}
                        onUpdateExtra={updateConceptExtra}
                        onCopied={showCopied}
                        onRegenerate={regenerateConcepts}
                      />
                    )}
                    {displayedActiveTab === "Prompts" && (
                      <PromptsTab selectedConcepts={selectedConcepts} promptPacks={promptPacks} flags={outputFlags} onCopied={showCopied} />
                    )}
                    {displayedActiveTab === "Creative Assets" && (
                      <CreativeAssetsTab
                        selectedConcepts={selectedConcepts}
                        assetPlans={assetPlans}
                        onApprove={approveAsset}
                        onCopied={showCopied}
                        onDownload={download}
                      />
                    )}
                    {displayedActiveTab === "Shopify Copy" && (
                      <ShopifyTab selectedConcepts={selectedConcepts} copyPacks={copyPacks} flags={outputFlags} onCopied={showCopied} />
                    )}
                    {displayedActiveTab === "Meta Ads" && <MetaTab selectedConcepts={selectedConcepts} copyPacks={copyPacks} flags={outputFlags} onCopied={showCopied} />}
                    {displayedActiveTab === "Export" && (
                      <ExportTab
                        markdown={markdown}
                        jsonValue={jsonExportValue}
                        assetPlans={assetPlans}
                        copyPacks={copyPacks}
                        selectedConcepts={selectedConcepts}
                        analysis={analysis}
                        generationMeta={generationMeta}
                        versions={versions}
                        screenshotIncluded={Boolean(screenshot)}
                        flags={outputFlags}
                        hasGenericWarning={genericExportWarning}
                        onCopied={showCopied}
                        onDownload={download}
                      />
                    )}
                  </>
                )}
              </div>
            </section>
              </>
            )}
          </div>
        </section>
      </div>
      {toast ? <div className="fixed bottom-5 right-5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-white shadow-soft">{toast}</div> : null}
    </main>
  );
}

function DashboardView({
  drafts,
  onCreate,
  onOpen,
  onDuplicate,
  onArchive,
  onDelete,
}: {
  drafts: CreativeDraft[];
  onCreate: () => void;
  onOpen: (draft: CreativeDraft) => void;
  onDuplicate: (draft: CreativeDraft) => void;
  onArchive: (draftId: string) => void;
  onDelete: (draftId: string) => void;
}) {
  const visibleDrafts = drafts.filter((draft) => draft.status !== "archived");
  const archivedDrafts = drafts.filter((draft) => draft.status === "archived");

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.06em] text-secondary">Dashboard</p>
          <h1 className="mt-2 text-4xl font-medium">Saved POD drafts</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-secondary">Open, duplicate, archive, or delete local drafts. Drafts stay in this browser until you clear them.</p>
        </div>
        <button type="button" onClick={onCreate} className="focus-ring inline-flex h-11 items-center justify-center rounded-full bg-primary px-5 text-sm font-medium text-white hover:bg-shade-70">
          Create new draft
        </button>
      </div>

      {!visibleDrafts.length ? (
        <div className="rounded-xl border border-dashed border-border bg-white p-10 text-center">
          <h3 className="text-2xl font-medium">No saved drafts yet.</h3>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-secondary">Create a product brief, generate a pack, then save it here for comparison and later edits.</p>
          <button type="button" onClick={onCreate} className="focus-ring mt-5 inline-flex h-11 items-center rounded-full bg-primary px-5 text-sm font-medium text-white hover:bg-shade-70">
            Create new draft
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleDrafts.map((draft) => (
            <article key={draft.id} className="rounded-xl border border-border bg-white p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-xl font-medium">{draft.title}</h3>
                  <p className="mt-1 text-sm text-secondary">{draft.competitorBrand || "No competitor brand"}</p>
                </div>
                <span className="rounded-full border border-black/10 bg-accent px-3 py-1 text-xs font-medium capitalize">{draft.status}</span>
              </div>
              <dl className="mt-4 grid gap-2 text-sm text-secondary">
                <Detail label="Product" value={draft.productType || "Not set"} />
                <Detail label="Buyer" value={draft.buyerPersona || "Not set"} />
                <Detail label="Occasion" value={draft.occasion || "Not set"} />
                <Detail label="Updated" value={formatDate(draft.updatedAt)} />
              </dl>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full border border-border bg-surface-muted px-3 py-1 text-xs font-medium text-secondary">{getSourceLabel(draft.generationMeta)}</span>
                {draft.versions?.length ? <span className="rounded-full border border-border bg-white px-3 py-1 text-xs font-medium text-secondary">{draft.versions.length} versions</span> : null}
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <button type="button" onClick={() => onOpen(draft)} className="focus-ring inline-flex h-10 items-center rounded-full bg-primary px-4 text-sm font-medium text-white hover:bg-shade-70">
                  Open
                </button>
                <button type="button" onClick={() => onDuplicate(draft)} className="focus-ring inline-flex h-10 items-center rounded-full border border-primary bg-white px-4 text-sm font-medium text-primary hover:bg-surface-muted">
                  Duplicate
                </button>
                <button type="button" onClick={() => onArchive(draft.id)} className="focus-ring inline-flex h-10 items-center rounded-full border border-border bg-white px-4 text-sm font-medium text-secondary hover:bg-surface-muted">
                  Archive
                </button>
                <button type="button" onClick={() => onDelete(draft.id)} className="focus-ring inline-flex h-10 items-center rounded-full border border-border bg-white px-4 text-sm font-medium text-danger hover:bg-red-50">
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {archivedDrafts.length ? <p className="text-sm text-secondary">{archivedDrafts.length} archived drafts hidden from this view.</p> : null}
    </section>
  );
}

function SettingsView({
  health,
  generationMeta,
  onRefresh,
}: {
  health: { groqConfigured: boolean; imageProvider: string; imageProviderConfigured: boolean; appVersion: string } | null;
  generationMeta?: GenerationMeta;
  onRefresh: () => void;
}) {
  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.06em] text-secondary">Settings</p>
          <h1 className="mt-2 text-4xl font-medium">API status</h1>
          <p className="mt-2 text-sm leading-6 text-secondary">Provider status is checked server-side without exposing API keys.</p>
        </div>
        <button type="button" onClick={onRefresh} className="focus-ring inline-flex h-11 items-center rounded-full border border-primary bg-white px-5 text-sm font-medium text-primary hover:bg-surface-muted">
          Refresh status
        </button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <InfoCard title="Groq strategy generation" value={health ? (health.groqConfigured ? "Connected" : "Missing") : "Not checked"} />
        <InfoCard title="Image provider" value={health ? `${health.imageProvider} · ${health.imageProviderConfigured ? "Configured" : "Missing"}` : "Not checked"} />
        <InfoCard title="Last source" value={getSourceLabel(generationMeta)} />
        <InfoCard title="Fallback used" value={generationMeta?.fallbackUsed ? `Yes · ${generationMeta.fallbackReason || "No reason provided"}` : "No"} />
        <InfoCard title="Last model" value={generationMeta?.model || "Not set"} />
        <InfoCard title="App version" value={health?.appVersion || "0.2.0"} />
      </div>
    </section>
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
  clearNeedsConfirm,
}: {
  project: Project;
  screenshot: ScreenshotState | null;
  updateProject: <K extends keyof Project>(key: K, value: Project[K]) => void;
  updateScreenshot: (screenshot: ScreenshotState | null) => void;
  onGenerate: () => void;
  onSaveDraft: () => void;
  onClearDraft: () => void;
  isGenerating: boolean;
  clearNeedsConfirm: boolean;
}) {
  const handleScreenshotChange = (file: File | undefined) => {
    if (!file) {
      updateScreenshot(null);
      return;
    }

    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) return;

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
    <form id="product-brief" className="grid scroll-mt-24 gap-5">
      <FormSection title="Competitor Input" helper="Start with a URL, pasted notes, or a screenshot. One strong competitor signal is enough for a useful first pack.">
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
        <div
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            handleScreenshotChange(event.dataTransfer.files?.[0]);
          }}
          className="rounded-xl border border-dashed border-shade-30 bg-surface-muted p-4"
        >
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_200px] md:items-center">
            <div>
              <FieldLabel>Competitor screenshot</FieldLabel>
              <p className="mt-1 text-xs leading-5 text-secondary">
                Use a product screenshot when the competitor URL is hard to read. PNG, JPG, JPEG, or WebP up to 5MB.
              </p>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => handleScreenshotChange(event.target.files?.[0])}
                className="mt-3 block w-full text-sm text-secondary file:mr-3 file:rounded-full file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-white"
              />
              {screenshot ? (
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-secondary">
                  <span className="font-semibold text-primary">{screenshot.name}</span>
                  <span>{formatFileSize(screenshot.size)}</span>
                  <button type="button" onClick={() => updateScreenshot(null)} className="focus-ring inline-flex h-8 items-center gap-1 rounded-full border border-border bg-white px-3 font-semibold text-primary">
                    <X size={13} />
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
                  <Upload className="mx-auto mb-2 text-primary" size={24} />
                  <p className="text-xs font-medium text-primary">Drop screenshot</p>
                  <p className="mt-1 text-xs text-secondary">or choose a file</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </FormSection>

      <FormSection title="Product Context" helper="Define the shopper, product format, occasion, and niche so the pack has a clear commercial target.">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <FieldLabel>Product type</FieldLabel>
            <SelectField value={project.productType || ""} options={["", ...PRODUCT_TYPES]} onChange={(value) => updateProject("productType", value)} />
          </div>
          <div className="space-y-2">
            <FieldLabel>Buyer persona</FieldLabel>
            <SelectField value={project.buyerPersona || ""} options={["", ...BUYER_PERSONAS]} onChange={(value) => updateProject("buyerPersona", value)} />
          </div>
          <div className="space-y-2">
            <FieldLabel>Occasion</FieldLabel>
            <SelectField value={project.occasion || ""} options={["", ...OCCASIONS]} onChange={(value) => updateProject("occasion", value)} />
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
        {project.productType === "Other" ? (
          <div className="space-y-2">
            <FieldLabel>Specify product type</FieldLabel>
            <TextInput
              value={project.customProductType || ""}
              onChange={(value) => updateProject("customProductType", value)}
              placeholder="Example: Squishy Acrylic Fridge Magnet, Custom Photo Acrylic Plaque, Pet Memorial Suncatcher"
            />
            <p className="text-xs leading-5 text-secondary">Tell the tool what this product actually is. This helps avoid generic output like &quot;custom product.&quot;</p>
          </div>
        ) : null}
      </FormSection>

      <FormSection title="Brand Direction" helper="Choose the tone and visual language the generated angles should follow.">
        <div className="space-y-2">
          <FieldLabel>Brand voice</FieldLabel>
          <MultiPillPicker options={BRAND_VOICES} selected={project.brandVoice || []} onChange={(value) => updateProject("brandVoice", value)} />
        </div>
        <div className="space-y-2">
          <FieldLabel>Visual style</FieldLabel>
          <MultiPillPicker options={ART_STYLES} selected={project.visualStyle || []} onChange={(value) => updateProject("visualStyle", value)} />
        </div>
        {project.visualStyle?.includes("Other") ? (
          <div className="space-y-2">
            <FieldLabel>Specify visual style</FieldLabel>
            <TextInput
              value={project.customVisualStyle || ""}
              onChange={(value) => updateProject("customVisualStyle", value)}
              placeholder="Example: funny custom character with realistic photo face and soft squishy belly"
            />
            <p className="text-xs leading-5 text-secondary">
              Describe the visual direction in plain words. Example: funny cartoon body with realistic photo face and soft squishy belly.
            </p>
          </div>
        ) : null}
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

      <FormSection title="Output Goals" helper="Select the deliverables you want in the creative pack. Three or more gives the best workflow coverage.">
        <div className="grid gap-2 md:grid-cols-2">
          {OUTPUT_REQUESTS.map((option) => {
            const active = project.outputs?.includes(option) || false;
            return (
              <button
                type="button"
                key={option}
                onClick={() => updateProject("outputs", active ? (project.outputs || []).filter((item) => item !== option) : [...(project.outputs || []), option])}
                className={cx(
                  "focus-ring flex min-h-11 items-center gap-3 rounded-full border px-4 text-left text-sm font-medium transition",
                  active ? "border-black/10 bg-accent text-primary" : "border-border bg-white text-secondary hover:bg-surface-muted",
                )}
              >
                <span className={cx("grid h-5 w-5 shrink-0 place-items-center rounded-full border", active ? "border-primary bg-primary text-white" : "border-shade-30 bg-white")}>
                  {active ? <Check size={13} /> : null}
                </span>
                <span>{option}</span>
              </button>
            );
          })}
        </div>
      </FormSection>

      <div className="flex flex-wrap justify-end gap-3">
        <button type="button" onClick={onClearDraft} className="focus-ring inline-flex h-11 items-center gap-2 rounded-full border border-primary bg-white px-5 text-sm font-medium text-primary hover:bg-surface-muted">
          {clearNeedsConfirm ? "Confirm clear?" : "Clear Draft"}
        </button>
        <button type="button" onClick={onSaveDraft} className="focus-ring inline-flex h-11 items-center gap-2 rounded-full border border-primary bg-white px-5 text-sm font-medium text-primary hover:bg-surface-muted">
          <Check size={17} />
          Save Draft
        </button>
        <button type="button" onClick={onGenerate} disabled={isGenerating} className="focus-ring inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-white hover:bg-shade-70 disabled:cursor-not-allowed disabled:opacity-70">
          <Sparkles size={17} className={isGenerating ? "animate-pulse" : ""} />
          {isGenerating ? "Generating..." : "Generate Strategy"}
        </button>
      </div>
    </form>
  );
}

function FormSection({ title, helper, children }: { title: string; helper: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-4 rounded-xl border border-border bg-white p-5 md:p-6">
      <legend className="sr-only">{title}</legend>
      <div>
        <h2 className="text-xl font-medium text-primary">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-secondary">{helper}</p>
      </div>
      {children}
    </fieldset>
  );
}

function BriefSummary({
  project,
  screenshot,
  analysis,
  selectedCount,
  onGenerate,
  isGenerating,
  readiness,
}: {
  project: Project;
  screenshot: ScreenshotState | null;
  analysis: Analysis | null;
  selectedCount: number;
  onGenerate: () => void;
  isGenerating: boolean;
  readiness: ReadinessResult;
}) {
  const normalized = normalizeProject(project);
  const summary = [
    ["Product type", project.productType === "Other" ? normalized.normalizedProductType : project.productType],
    ["Buyer", project.buyerPersona],
    ["Occasion", project.occasion],
    ["Niche", project.niche],
    ["Brand voice", project.brandVoice?.join(", ")],
    ["Visual style", project.visualStyle?.includes("Other") ? normalized.normalizedVisualDirection : project.visualStyle?.join(", ")],
    ["Outputs", `${project.outputs?.length || 0} selected`],
    ["Competitor input", project.competitorUrl || project.productDescription ? "Provided" : "Missing"],
    ["Screenshot", screenshot ? screenshot.name : "Not uploaded"],
    ["Notes", project.userNotes || project.avoidList ? "Provided" : "Not added"],
  ];
  const ready = readiness.score >= 80;

  return (
    <aside className="h-fit space-y-4 xl:sticky xl:top-28">
      <div className={cx("rounded-xl border p-6 md:p-8", ready ? "border-black/10 bg-accent" : "border-border bg-white")}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-2xl font-medium">Creative readiness</h3>
            <p className="mt-2 text-sm leading-6 text-shade-70">A quick preflight for the brief. Generation stays available while this shows what would improve the pack.</p>
          </div>
          <span className={cx("rounded-full border px-3 py-1 text-xs font-medium", ready ? "border-black/10 bg-white/70 text-primary" : "border-border bg-surface-muted text-secondary")}>
            {readiness.label}
          </span>
        </div>
        <div className="mt-5">
          <div className="flex items-end justify-between gap-4">
            <p className="text-4xl font-semibold">{readiness.score}%</p>
            <p className="text-sm text-secondary">
              {readiness.completed}/{readiness.total} complete
            </p>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/80">
            <div className={cx("h-full rounded-full", ready ? "bg-primary" : "bg-shade-70")} style={{ width: `${readiness.score}%` }} />
          </div>
        </div>
        <div className="mt-4 space-y-3">
          {summary.map(([label, value]) => (
            <div key={label} className="rounded-lg border border-black/10 bg-white/70 px-3 py-2">
              <p className="text-xs font-medium text-secondary">{label}</p>
              <p className="mt-1 text-sm font-medium text-primary">{value || "Not set"}</p>
            </div>
          ))}
        </div>
        {readiness.missing.length ? (
          <div className="mt-4 rounded-lg border border-border bg-white/70 p-4">
            <p className="text-sm font-medium text-primary">Helpful next inputs</p>
            <ul className="mt-2 space-y-1 text-sm leading-6 text-secondary">
              {readiness.missing.slice(0, 4).map((item) => (
                <li key={item}>- {item}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <button type="button" onClick={onGenerate} disabled={isGenerating} className="focus-ring mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-white hover:bg-shade-70 disabled:cursor-not-allowed disabled:opacity-70">
          <RefreshCw size={16} className={isGenerating ? "animate-spin" : ""} />
          {isGenerating ? "Generating..." : "Generate Strategy"}
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
    <div className="rounded-xl border border-dashed border-border bg-surface-muted px-5 py-12 text-center md:px-8">
      <p className="text-xs font-medium uppercase tracking-[0.06em] text-secondary">Creative Pack</p>
      <Sparkles className="mx-auto mt-4 text-primary" size={30} />
      <h3 className="mt-4 text-2xl font-medium">Your product strategy will appear here.</h3>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-secondary">
        Add a competitor signal, choose a buyer and occasion, then generate a pack with angles, prompts, Shopify copy, and Meta ad ideas.
      </p>
      <div className="mx-auto mt-6 grid max-w-3xl gap-3 md:grid-cols-3">
        {["Custom fields map", "Design + mockup prompts", "Shopify + Meta copy"].map((item) => (
          <div key={item} className="rounded-xl border border-border bg-white px-4 py-4 text-sm font-medium text-primary">
            {item}
          </div>
        ))}
      </div>
      <button type="button" onClick={onGenerate} disabled={isGenerating} className="focus-ring mt-5 inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-white hover:bg-shade-70 disabled:cursor-not-allowed disabled:opacity-70">
        <Sparkles size={16} className={isGenerating ? "animate-pulse" : ""} />
        {isGenerating ? "Generating..." : "Generate Strategy"}
      </button>
    </div>
  );
}

function LoadingState() {
  const steps = [
    "Reading competitor signal",
    "Mapping personalization fields",
    "Building original angles",
    "Writing prompts and copy",
    "Preparing export pack",
  ];

  return (
    <div className="rounded-xl border border-border bg-surface-muted p-6 md:p-8">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-full bg-primary text-white">
          <Sparkles size={18} className="animate-pulse" />
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.06em] text-secondary">Generating</p>
          <h3 className="text-2xl font-medium">Building your creative pack.</h3>
        </div>
      </div>
      <div className="mt-6 grid gap-3">
        {steps.map((step, index) => (
          <div key={step} className="flex items-center gap-3 rounded-full border border-border bg-white px-4 py-3 text-sm font-medium text-primary">
            <span className={cx("grid h-6 w-6 place-items-center rounded-full text-xs", index === 0 ? "bg-primary text-white" : "bg-accent text-primary")}>
              {index + 1}
            </span>
            {step}
          </div>
        ))}
      </div>
    </div>
  );
}

function OverviewTab({ analysis, onCopied }: { analysis: Analysis; onCopied: () => void }) {
  const breakdown = analysis.productBreakdown;
  return (
    <div className="space-y-5">
      <TabIntro
        eyebrow="Overview"
        title="Product strategy overview"
        description="Use this as the strategic brief before designing, listing, or advertising the product."
        action={<CopyButton value={JSON.stringify(analysis, null, 2)} onCopied={onCopied} label="Copy tab" />}
      />
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

function CustomMapTab({ analysis, onCopied }: { analysis: Analysis; onCopied: () => void }) {
  return (
    <div className="space-y-5">
      <TabIntro
        eyebrow="Custom Map"
        title="Personalization map"
        description="Turn these rows into product options, image upload fields, and shopper-facing Shopify labels."
        action={<CopyButton value={JSON.stringify(analysis.customFields, null, 2)} onCopied={onCopied} label="Copy tab" />}
      />
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
  conceptExtras,
  onToggle,
  onUpdateExtra,
  onCopied,
  onRegenerate,
}: {
  concepts: Concept[];
  conceptExtras: ConceptExtras;
  onToggle: (id: string) => void;
  onUpdateExtra: (id: string, value: { favorite?: boolean; notes?: string }) => void;
  onCopied: () => void;
  onRegenerate: () => void;
}) {
  return (
    <div className="space-y-4">
      <TabIntro
        eyebrow="Concepts"
        title="Original product angles"
        description="Select the angles you want to carry into prompts, Shopify copy, ads, and exports."
        action={
          <>
            <CopyButton value={JSON.stringify(concepts, null, 2)} onCopied={onCopied} label="Copy tab" />
            <button type="button" onClick={onRegenerate} className="focus-ring inline-flex h-10 items-center gap-2 rounded-full border border-primary bg-white px-4 text-sm font-medium text-primary hover:bg-surface-muted">
              <RefreshCw size={16} />
              Regenerate
            </button>
          </>
        }
      />
      <div className="hidden justify-end">
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
                {concept.selected ? "Selected" : "Choose concept"}
              </button>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <ScoreBadge label="Custom" value={concept.scores.customDepth} />
              <ScoreBadge label="Ads" value={concept.scores.adsPotential} />
              <ScoreBadge label="Originality" value={concept.scores.copyRisk === "low" ? "high" : "medium"} />
              <ScoreBadge label="Production" value={concept.scores.productionDifficulty} />
            </div>
            <dl className="mt-4 grid gap-3 text-sm">
              <Detail label="Design" value={concept.designDirection} />
              <Detail label="Mockup" value={concept.mockupDirection} />
              <Detail label="Ad hook" value={concept.adHook} />
            </dl>
            <div className="mt-4 flex gap-2">
              <CopyButton value={JSON.stringify(concept, null, 2)} onCopied={onCopied} label="Copy selected concept" />
              <button
                type="button"
                onClick={() => onUpdateExtra(concept.id, { favorite: !conceptExtras[concept.id]?.favorite })}
                className={cx(
                  "focus-ring inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-medium",
                  conceptExtras[concept.id]?.favorite ? "border-black/10 bg-primary text-white" : "border-primary bg-white text-primary hover:bg-surface-muted",
                )}
              >
                <Star size={14} />
                {conceptExtras[concept.id]?.favorite ? "Favorited" : "Favorite"}
              </button>
              <button type="button" className="focus-ring inline-flex h-9 items-center gap-1.5 rounded-full border border-primary bg-white px-3 text-xs font-medium text-primary hover:bg-surface-muted">
                <RefreshCw size={14} />
                Regenerate
              </button>
            </div>
            <div className="mt-4 space-y-2">
              <FieldLabel>Why this concept is promising</FieldLabel>
              <TextArea
                value={conceptExtras[concept.id]?.notes || ""}
                onChange={(value) => onUpdateExtra(concept.id, { notes: value })}
                rows={3}
                placeholder="Add selection notes, testing hypothesis, or production concerns."
              />
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
      <TabIntro
        eyebrow="Prompts"
        title="Design and lifestyle prompts"
        description="Use these prompts to brief image generation, design production, mockup creation, and ad creative variants."
        action={<CopyButton value={JSON.stringify(selectedConcepts.map((concept) => promptPacks[concept.id]).filter(Boolean), null, 2)} onCopied={onCopied} label="Copy tab" />}
      />
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
      <TabIntro
        eyebrow="Shopify Copy"
        title="Shopify-ready listing copy"
        description="Use this as a first-pass listing kit, then edit claims, production details, and shipping notes before publishing."
        action={<CopyButton value={JSON.stringify(selectedConcepts.map((concept) => copyPacks[concept.id]).filter(Boolean), null, 2)} onCopied={onCopied} label="Copy tab" />}
      />
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
      <TabIntro
        eyebrow="Meta Ads"
        title="Ad hooks and creative angles"
        description="Use these hooks and primary texts as test starters for emotional angles, offer framing, and UGC scripts."
        action={<CopyButton value={JSON.stringify(selectedConcepts.map((concept) => copyPacks[concept.id]).filter(Boolean), null, 2)} onCopied={onCopied} label="Copy tab" />}
      />
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

function CreativeAssetsTab({
  selectedConcepts,
  assetPlans,
  onApprove,
  onCopied,
  onDownload,
}: {
  selectedConcepts: Concept[];
  assetPlans: CreativeAssetPlan[];
  onApprove: (assetId: string) => void;
  onCopied: () => void;
  onDownload: (name: string, value: string, type: string) => void;
}) {
  if (!selectedConcepts.length) {
    return <p className="text-sm text-secondary">Select concepts before planning creative assets.</p>;
  }

  const promptPack = assetPlans.map((asset) => `${asset.title} (${asset.ratio})\n${asset.prompt}`).join("\n\n");

  return (
    <div className="space-y-6">
      <TabIntro
        eyebrow="Creative Assets"
        title="Production-ready asset plan"
        description="Use these prompt cards as the handoff layer before connecting an image provider."
        action={
          <>
            <CopyButton value={promptPack} onCopied={onCopied} label="Copy prompts" />
            <button type="button" onClick={() => onDownload("creative-asset-prompts.txt", promptPack, "text/plain")} className="focus-ring inline-flex h-10 items-center gap-2 rounded-full border border-primary bg-white px-4 text-sm font-medium text-primary hover:bg-surface-muted">
              <Download size={16} />
              Export prompts
            </button>
          </>
        }
      />
      {selectedConcepts.map((concept) => {
        const plans = assetPlans.filter((asset) => asset.conceptId === concept.id);
        return (
          <section key={concept.id} className="space-y-3">
            <h3 className="text-xl font-medium">{concept.name}</h3>
            <div className="grid gap-3 md:grid-cols-2">
              {plans.map((asset) => (
                <article key={asset.id} className="rounded-xl border border-border bg-white p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-border bg-surface-muted px-3 py-1 text-xs font-medium text-secondary">{asset.type}</span>
                    <span className="rounded-full border border-border bg-white px-3 py-1 text-xs font-medium text-secondary">{asset.ratio}</span>
                    <span className={cx("rounded-full border px-3 py-1 text-xs font-medium", asset.status === "approved" ? "border-black/10 bg-accent text-primary" : "border-border bg-surface-muted text-secondary")}>
                      {asset.status}
                    </span>
                  </div>
                  <h4 className="mt-3 text-base font-medium">{asset.title}</h4>
                  <p className="mt-2 max-h-32 overflow-auto text-sm leading-6 text-secondary">{asset.prompt}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <CopyButton value={asset.prompt} onCopied={onCopied} label="Copy prompt" />
                    <button type="button" disabled className="inline-flex h-9 cursor-not-allowed items-center rounded-full border border-border bg-surface-muted px-3 text-xs font-medium text-secondary">
                      Provider not configured
                    </button>
                    <button type="button" onClick={() => onApprove(asset.id)} className="focus-ring inline-flex h-9 items-center rounded-full border border-primary bg-white px-3 text-xs font-medium text-primary hover:bg-surface-muted">
                      {asset.status === "approved" ? "Unapprove" : "Approve"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function ExportTab({
  markdown,
  jsonValue,
  assetPlans,
  copyPacks,
  selectedConcepts,
  analysis,
  generationMeta,
  versions,
  screenshotIncluded,
  flags,
  hasGenericWarning,
  onCopied,
  onDownload,
}: {
  markdown: string;
  jsonValue: string;
  assetPlans: CreativeAssetPlan[];
  copyPacks: Record<string, CopyPack>;
  selectedConcepts: Concept[];
  analysis: Analysis | null;
  generationMeta?: GenerationMeta;
  versions: GenerationVersion[];
  screenshotIncluded: boolean;
  flags: OutputFlags;
  hasGenericWarning: boolean;
  onCopied: () => void;
  onDownload: (name: string, value: string, type: string) => void;
}) {
  const assetPromptPack = assetPlans.map((asset) => `## ${asset.title}\n- Type: ${asset.type}\n- Ratio: ${asset.ratio}\n\n${asset.prompt}`).join("\n\n");
  const shopifyPack = selectedConcepts
    .map((concept) => {
      const pack = copyPacks[concept.id];
      if (!pack) return "";
      return `# ${concept.name}\n\n${pack.shopifyTitles.join("\n")}\n\n${pack.fullDescription}\n\n${pack.bulletBenefits.map((item) => `- ${item}`).join("\n")}\n\n${pack.personalizationInstructions}\n\n${pack.tags.join(", ")}`;
    })
    .filter(Boolean)
    .join("\n\n");
  const metaPack = selectedConcepts
    .map((concept) => {
      const pack = copyPacks[concept.id];
      if (!pack) return "";
      return `# ${concept.name}\n\nHooks:\n${pack.metaHooks.map((item) => `- ${item}`).join("\n")}\n\nPrimary text:\n${pack.primaryTexts.map((item) => `- ${item}`).join("\n")}\n\nHeadlines:\n${pack.headlines.map((item) => `- ${item}`).join("\n")}\n\nCreative assets:\n${assetPlans.filter((asset) => asset.conceptId === concept.id).map((asset) => `- ${asset.title} (${asset.ratio})`).join("\n")}`;
    })
    .filter(Boolean)
    .join("\n\n");
  const checklist = `# Production Checklist

## Generation Metadata
- Strategy source: ${getSourceLabel(generationMeta)}
- Model: ${generationMeta?.model || "Not set"}
- Fallback used: ${generationMeta?.fallbackUsed ? "Yes" : "No"}
- Generated at: ${generationMeta?.generatedAt || "Not generated"}
- Versions saved: ${versions.length}
- Screenshot included: ${screenshotIncluded ? "Yes" : "No"}

## Custom Fields
${analysis?.customFields.map((field) => `- ${field.name}: ${field.example}`).join("\n") || "No custom map generated."}

## Assets
${assetPlans.map((asset) => `- ${asset.title} · ${asset.ratio} · ${asset.status}`).join("\n") || "No assets planned."}

## Risks / Avoid
${analysis?.inspirationRules.doNotCopy.map((item) => `- ${item}`).join("\n") || "- Review competitor risks before production."}`;

  return (
    <div className="space-y-5">
      <TabIntro
        eyebrow="Export"
        title="Download or copy the full pack"
        description="Download everything as Markdown or JSON so you can use it with Codex, Shopify, or your design workflow."
      />
      {hasGenericWarning ? (
        <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm leading-6 text-warning">
          This output may be too generic. Add a specific product type or visual style before exporting.
        </div>
      ) : null}
      <div className="flex flex-wrap gap-3">
        {flags.exportMarkdown ? (
          <button type="button" onClick={() => onDownload("pod-creative-pack.md", markdown, "text/markdown")} className="focus-ring inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-white hover:bg-shade-70">
            <Download size={17} />
            Export Markdown
          </button>
        ) : null}
        {flags.exportJson ? (
          <button type="button" onClick={() => onDownload("pod-creative-pack.json", jsonValue, "application/json")} className="focus-ring inline-flex h-11 items-center gap-2 rounded-full border border-primary bg-white px-5 text-sm font-medium text-primary hover:bg-surface-muted">
            <FileJson size={17} />
            Export JSON
          </button>
        ) : null}
        <CopyButton value={markdown} onCopied={onCopied} label="Copy tab" />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {[
          ["Creative Prompt Pack", "creative-prompt-pack.txt", assetPromptPack || "No asset prompts planned yet.", "text/plain"],
          ["Shopify Listing Draft", "shopify-listing-draft.md", shopifyPack || "No Shopify copy generated yet.", "text/markdown"],
          ["Meta Ads Pack", "meta-ads-pack.md", metaPack || "No Meta ads copy generated yet.", "text/markdown"],
          ["Production Checklist", "production-checklist.md", checklist, "text/markdown"],
        ].map(([label, filename, value, type]) => (
          <div key={label} className="rounded-xl border border-border bg-white p-4">
            <h4 className="font-medium">{label}</h4>
            <div className="mt-3 flex flex-wrap gap-2">
              <CopyButton value={value} onCopied={onCopied} label="Copy" />
              <button type="button" onClick={() => onDownload(filename, value, type)} className="focus-ring inline-flex h-9 items-center gap-2 rounded-full border border-primary bg-white px-3 text-xs font-medium text-primary hover:bg-surface-muted">
                <Download size={14} />
                Download
              </button>
            </div>
          </div>
        ))}
      </div>
      <PromptBlock title="Markdown preview" value={markdown} onCopied={onCopied} />
    </div>
  );
}
