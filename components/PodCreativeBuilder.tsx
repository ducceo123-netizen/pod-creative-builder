"use client";

import {
  Archive,
  Bell,
  Check,
  Clipboard,
  Download,
  FileJson,
  Home,
  Layers3,
  Library,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { BRAND_VOICES, ART_STYLES, BUYER_PERSONAS, OCCASIONS, OUTPUT_REQUESTS, PRODUCT_TYPES } from "@/lib/constants";
import { buildArtworkAssets, formatArtworkAssetsJson, formatArtworkAssetsMarkdown, formatArtworkToolBrief } from "@/lib/artworkAssets";
import { exportMarkdown } from "@/lib/exportMarkdown";
import { createProject, generateComponentPromptPack } from "@/lib/generate";
import { buildSearchText, cleanGenericOtherLanguage, getCustomFields, hasGenericOutputWarning, normalizeProject } from "@/lib/normalizeProject";
import { filterExportData, getOutputFlags, type OutputFlags } from "@/lib/outputFilters";
import { buildProductDecomposition, formatProductDecompositionMarkdown } from "@/lib/productDecomposition";
import { buildLocalStrategy, type GenerateStrategyResponse } from "@/lib/strategy";
import { buildAssetSlots, buildDesignLayoutPlan, buildTeeinblueManifest, buildTeeinbluePackageSync, formatTeeinblueSetupGuide } from "@/lib/teeinbluePackage";
import { createZipBlob, dataUrlToBytes, type ZipFileInput } from "@/lib/zipPackage";
import type { Analysis } from "@/types/analysis";
import type { ArtworkAsset, ArtworkAssetGroup, ArtworkAssetType } from "@/types/artworkAsset";
import type { ComponentPromptPack } from "@/types/componentPrompt";
import type { Concept } from "@/types/concept";
import type { CopyPack } from "@/types/copyPack";
import type { DesignLayoutPlan, TeeinbluePackageSync } from "@/types/designPackage";
import type { ComponentAssetPlan, DesignComponent, ProductDecomposition } from "@/types/productDecomposition";
import type { Project } from "@/types/project";
import type { PromptPack } from "@/types/promptPack";

const tabs = ["Snapshot", "Decomposition", "Personalization Map", "Asset Plan", "Component Prompts", "Material Notes", "Ad Matrix", "Copy", "Artwork Assets", "Teeinblue Package", "Export"];
const PROJECT_DRAFT_KEY = "pod-builder-project-draft";
const SCREENSHOT_DRAFT_KEY = "pod-builder-screenshot-draft";
const DRAFTS_KEY = "pod-creative-drafts";
const CURRENT_DRAFT_ID_KEY = "pod-current-draft-id";
const navItems: Array<[string, LucideIcon, boolean]> = [
  ["Dashboard", Home, false],
  ["Projects", Archive, false],
  ["Competitor Briefs", Plus, false],
  ["Creative Generator", Sparkles, false],
  ["Drafts", Library, false],
  ["Prompt Library", Layers3, false],
  ["Exports", FileJson, false],
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
  artworkAssets: ArtworkAsset[];
  componentPromptPacks: Record<string, ComponentPromptPack>;
  copyPacks: Record<string, CopyPack>;
  generationMeta: GenerationMeta;
  createdAt: string;
};

type ExportRecord = {
  id: string;
  draftId?: string | null;
  exportType: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

type InferredProjectContext = {
  normalizedProductType: string;
  buyerPersona: string;
  giftRecipient: string[];
  occasion: string[];
  niche: string;
  visualStyle: string;
  brandVoice: string[];
  customFields: string[];
  coreEmotion: string;
  visualMechanism: string;
  likelyPurchaseReason: string;
  copyRisk: "Low" | "Medium" | "High";
  recommendedOutputs: string[];
  confidence: number;
  inferredFrom: string[];
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

type ComponentAssetWorkflowState = Record<
  string,
  {
    status: ComponentAssetPlan["status"];
    uploadedAssetUrl?: string;
    uploadedAssetName?: string;
    uploadedAssetType?: string;
    uploadedAssetSource?: "local" | "supabase-storage";
    uploadedAssetStoragePath?: string;
    updatedAt: string;
  }
>;

type OpportunityScore = {
  customDepth: number;
  emotionalPull: number;
  adCreativePotential: number;
  giftability: number;
  seasonality: number;
  productionComplexity: number;
  copycatRisk: number;
  overall: number;
  explanations: Record<string, string>;
};

type CreativeAngleGroup = {
  group: string;
  angles: Array<{
    id: string;
    name: string;
    insight: string;
    hook: string;
    direction: string;
  }>;
};

type AdMatrixRow = {
  id: string;
  angleName: string;
  buyerInsight: string;
  hook: string;
  visualDirection: string;
  primaryText: string;
  headline: string;
  cta: string;
  recommendedAssetType: string;
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
  status: Project["status"];
  project: Project;
  analysis?: Analysis | null;
  concepts?: Concept[];
  promptPacks?: Record<string, PromptPack>;
  artworkAssets?: ArtworkAsset[];
  componentPromptPacks?: Record<string, ComponentPromptPack>;
  copyPacks?: Record<string, CopyPack>;
  screenshot?: ScreenshotState | null;
  conceptExtras?: ConceptExtras;
  assetPlans?: CreativeAssetPlan[];
  componentAssetWorkflow?: ComponentAssetWorkflowState;
  generationMeta?: GenerationMeta;
  versions?: GenerationVersion[];
  exportRecords?: ExportRecord[];
  opportunityScore?: OpportunityScore;
  inferredContext?: InferredProjectContext | null;
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

function createDemoProject() {
  return createProject({
    name: "Demo Teeinblue workflow",
    competitorBrand: "Wander Prints",
    productTitle: "Custom Photo Poke Dad Bod Belly - Personalized Squishy Acrylic Fridge Magnet",
    productDescription:
      "A funny personalized squishy acrylic fridge magnet. Customers upload a photo of dad, husband, boyfriend, or grandpa and the product turns him into a playful dad-bod character with a soft pokeable belly.",
    competitorUrl: "https://example.com/custom-photo-poke-dad-bod-belly-magnet",
    productType: "Squishy Acrylic Fridge Magnet",
    customProductType: "",
    buyerPersona: "Dad",
    occasion: "Father's Day",
    niche: "Funny personalized dad gift, husband gift, Father's Day gift, family humor gift",
    priceRange: "$19-$29",
    brandVoice: ["Fun", "Gift-focused", "US-market natural"],
    visualStyle: ["Funny Custom Character"],
    customVisualStyle: "",
    avoidList: "No copied competitor artwork, slogans, product layout, logos, or brand styling.",
    userNotes: "Demo workflow seed for testing Artwork Assets and Teeinblue Package tabs.",
    outputs: OUTPUT_REQUESTS,
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

async function fetchRemoteDrafts(): Promise<CreativeDraft[] | null> {
  try {
    const response = await fetch("/api/drafts", { cache: "no-store" });
    if (!response.ok) return null;
    const data = (await response.json()) as { source?: string; drafts?: CreativeDraft[] };
    return data.source === "supabase" ? data.drafts || [] : null;
  } catch {
    return null;
  }
}

async function saveRemoteDraft(draft: CreativeDraft) {
  try {
    await fetch("/api/drafts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
  } catch {
    // LocalStorage remains the offline fallback.
  }
}

async function saveRemoteGeneration(version: GenerationVersion) {
  try {
    await fetch("/api/generations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(version),
    });
  } catch {
    // Draft state remains usable even if history sync is unavailable.
  }
}

async function saveRemoteExport(record: ExportRecord) {
  try {
    await fetch("/api/exports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(record),
    });
  } catch {
    // Export download already completed; history sync can retry on a later export.
  }
}

async function saveRemoteArtworkAssets(draftId: string, assets: ArtworkAsset[]) {
  try {
    await fetch("/api/artwork-assets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ draftId, assets }),
    });
  } catch {
    // Draft payload remains the source of truth if asset row sync is unavailable.
  }
}

async function saveRemoteComponentAssetWorkflow(draftId: string, workflow: ComponentAssetWorkflowState) {
  try {
    await fetch("/api/component-asset-workflow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ draftId, workflow }),
    });
  } catch {
    // Draft payload remains the source of truth if workflow row sync is unavailable.
  }
}

async function saveRemoteDesignPackages(draftId: string, packages: TeeinbluePackageSync[]) {
  try {
    const response = await fetch("/api/design-packages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ draftId, packages }),
    });
    if (!response.ok) return "local-fallback";
    const data = (await response.json()) as { source?: string };
    return data.source || "local-fallback";
  } catch {
    return "local-fallback";
  }
}

async function uploadRemoteArtworkAsset(payload: {
  draftId: string;
  assetId: string;
  filename: string;
  contentType: string;
  dataUrl: string;
}) {
  try {
    const response = await fetch("/api/upload-asset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as {
      source?: string;
      storageUrl?: string;
      path?: string;
    };
    return data.source === "supabase-storage" && data.storageUrl ? data : null;
  } catch {
    return null;
  }
}

async function patchRemoteDraft(draft: CreativeDraft) {
  try {
    await fetch(`/api/drafts/${encodeURIComponent(draft.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
  } catch {
    // LocalStorage remains the offline fallback.
  }
}

async function deleteRemoteDraft(draftId: string) {
  try {
    await fetch(`/api/drafts/${encodeURIComponent(draftId)}`, { method: "DELETE" });
  } catch {
    // LocalStorage remains the offline fallback.
  }
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
  if (project.status === "archived" || project.status === "exported" || project.status === "ready-for-design") return project.status;
  if (concepts.some((concept) => concept.selected) && project.status === "prompt-ready") return "prompt-ready";
  if (concepts.some((concept) => concept.selected)) return "selected";
  if (analysis || project.status === "generated") return "generated";
  if (project.status === "analyzed") return "analyzed";
  return "draft";
}

function getSourceLabel(meta?: GenerationMeta) {
  if (!meta) return "Not generated";
  if (meta.fallbackUsed) return "Local template";
  if (meta.generationSource === "groq") return "Groq";
  return meta.generationSource;
}

function getSourceHelp(meta?: GenerationMeta) {
  if (!meta) return "No generation has been saved for this draft yet.";
  if (meta.fallbackUsed) return meta.fallbackReason || "Groq was unavailable, so the app used the built-in local template.";
  return `Generated with ${getSourceLabel(meta)}${meta.model ? ` · ${meta.model}` : ""}.`;
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

function getExportType(filename: string, contentType: string) {
  if (contentType.includes("json") || filename.endsWith(".json")) return "json";
  if (contentType.includes("markdown") || filename.endsWith(".md")) return "markdown";
  if (contentType.includes("text") || filename.endsWith(".txt")) return "text";
  return filename.split(".").pop() || "file";
}

function getArtworkWorkflowStatus(asset: ArtworkAsset) {
  if (asset.status === "Not Started") return "Missing";
  if (asset.status === "Copied" || asset.status === "Generated Externally") return "Prompt Copied";
  return asset.status;
}

function loadPreviewImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

async function renderTeeinbluePreviewPng(layout: DesignLayoutPlan, assets: ArtworkAsset[]) {
  const previewMax = 1400;
  const scale = previewMax / Math.max(layout.canvas.width, layout.canvas.height);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(layout.canvas.width * scale);
  canvas.height = Math.round(layout.canvas.height * scale);
  const context = canvas.getContext("2d");
  if (!context) return null;

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = "#108043";
  context.setLineDash([12, 8]);
  context.lineWidth = 2;
  const safeInset = layout.printArea.safeMargin * scale;
  context.strokeRect(safeInset, safeInset, canvas.width - safeInset * 2, canvas.height - safeInset * 2);
  context.setLineDash([]);

  for (const layer of layout.layers) {
    const asset = assets.find((item) => `layer-${item.id}` === layer.id);
    const x = layer.x * scale;
    const y = layer.y * scale;
    const width = layer.width * scale;
    const height = layer.height * scale;

    if (asset?.uploadedAssetUrl?.startsWith("data:")) {
      try {
        const image = await loadPreviewImage(asset.uploadedAssetUrl);
        context.drawImage(image, x, y, width, height);
      } catch {
        context.fillStyle = "#eaf4ff";
        context.fillRect(x, y, width, height);
      }
    } else {
      context.fillStyle = layer.teeinblueRole === "guide_do_not_print" ? "rgba(255, 244, 206, 0.72)" : "rgba(234, 244, 255, 0.82)";
      context.fillRect(x, y, width, height);
    }

    context.strokeStyle = layer.teeinblueRole === "guide_do_not_print" ? "#d89b00" : "#005bd3";
    context.lineWidth = 2;
    context.strokeRect(x, y, width, height);
    context.fillStyle = layer.teeinblueRole === "guide_do_not_print" ? "#8a6116" : "#005bd3";
    context.font = "600 20px Arial, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(layer.name, x + width / 2, y + height / 2, Math.max(80, width - 16));
  }

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) return null;
  return new Uint8Array(await blob.arrayBuffer());
}

function buildDraft(args: {
  id?: string;
  project: Project;
  analysis: Analysis | null;
  concepts: Concept[];
  promptPacks: Record<string, PromptPack>;
  artworkAssets: ArtworkAsset[];
  componentPromptPacks: Record<string, ComponentPromptPack>;
  copyPacks: Record<string, CopyPack>;
  screenshot: ScreenshotState | null;
  conceptExtras: ConceptExtras;
  assetPlans: CreativeAssetPlan[];
  componentAssetWorkflow: ComponentAssetWorkflowState;
  generationMeta?: GenerationMeta;
  versions: GenerationVersion[];
  exportRecords: ExportRecord[];
  inferredContext?: InferredProjectContext | null;
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
    artworkAssets: args.artworkAssets,
    componentPromptPacks: args.componentPromptPacks,
    copyPacks: args.copyPacks,
    screenshot: args.screenshot,
    conceptExtras: args.conceptExtras,
    assetPlans: args.assetPlans,
    componentAssetWorkflow: args.componentAssetWorkflow,
    generationMeta: args.generationMeta,
    versions: args.versions,
    exportRecords: args.exportRecords,
    opportunityScore: getOpportunityScore(args.project, args.analysis),
    inferredContext: args.inferredContext || null,
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

function componentAssetArtworkId(conceptId: string, assetId: string) {
  return `component-artwork-${conceptId}-${assetId}`;
}

function mapComponentAssetGroup(asset: ComponentAssetPlan): ArtworkAssetGroup {
  if (asset.assetSource === "mockup_context") return "Mockup Assets";
  if (asset.assetSource === "fixed_template") return "Material / Structure Assets";
  return "Product Design Assets";
}

function mapComponentAssetType(asset: ComponentAssetPlan): ArtworkAssetType {
  if (asset.assetSource === "customer_upload") return "face_integration";
  if (asset.assetSource === "mockup_context") return "product_mockup";
  if (asset.assetSource === "fixed_template") return "product_structure";
  if (asset.recommendedFormat === "Text layer") return "typography";
  if (asset.assetName.toLowerCase().includes("material")) return "material_detail";
  return "main_artwork";
}

function mapComponentAssetTool(tool: ComponentAssetPlan["recommendedTool"]): ArtworkAsset["recommendedTool"] {
  if (tool === "ChatGPT" || tool === "Ideogram" || tool === "Midjourney" || tool === "Figma" || tool === "Any") return tool;
  return "Figma";
}

function mapComponentAssetFormat(format: ComponentAssetPlan["recommendedFormat"]): ArtworkAsset["outputFormat"] {
  if (format === "PNG transparent" || format === "PNG") return "PNG transparent";
  if (format === "JPG") return "JPG mockup";
  if (format === "SVG") return "SVG/vector reference";
  return "Prompt only";
}

function mapComponentAssetPriority(priority: ComponentAssetPlan["priority"]): ArtworkAsset["priority"] {
  if (priority === "Must Have") return "Must Have";
  if (priority === "Should Have") return "Good To Have";
  return "Optional";
}

function mapComponentAssetStatus(status: ComponentAssetPlan["status"]): ArtworkAsset["status"] {
  if (status === "Prompt Copied") return "Copied";
  if (status === "Generated") return "Generated Externally";
  if (status === "Uploaded" || status === "Approved" || status === "Needs Revision") return status;
  return "Not Started";
}

function buildArtworkAssetFromComponentPlan(args: {
  asset: ComponentAssetPlan;
  concept: Concept;
  project: Project;
  draftId?: string | null;
  workflow?: ComponentAssetWorkflowState[string];
}): ArtworkAsset {
  const now = new Date().toISOString();
  return {
    id: componentAssetArtworkId(args.concept.id, args.asset.id),
    projectId: args.project.id,
    generationId: args.draftId || undefined,
    conceptId: args.concept.id,
    conceptName: args.concept.name,
    assetGroup: mapComponentAssetGroup(args.asset),
    assetType: mapComponentAssetType(args.asset),
    title: args.asset.assetName,
    purpose: args.asset.assetPurpose,
    prompt: args.asset.prompt,
    recommendedTool: mapComponentAssetTool(args.asset.recommendedTool),
    recommendedRatio: args.asset.suggestedSize,
    outputFormat: mapComponentAssetFormat(args.asset.recommendedFormat),
    priority: mapComponentAssetPriority(args.asset.priority),
    uploadedAssetUrl: args.workflow?.uploadedAssetUrl,
    uploadedAssetName: args.workflow?.uploadedAssetName,
    uploadedAssetType: args.workflow?.uploadedAssetType,
    uploadedAssetSource: args.workflow?.uploadedAssetSource,
    uploadedAssetStoragePath: args.workflow?.uploadedAssetStoragePath,
    status: mapComponentAssetStatus(args.workflow?.status || args.asset.status),
    createdAt: now,
    updatedAt: args.workflow?.updatedAt || now,
  };
}

function buildComponentPromptPacks(selectedConcepts: Concept[], productType: string): Record<string, ComponentPromptPack> {
  return Object.fromEntries(selectedConcepts.map((concept) => [concept.id, generateComponentPromptPack(concept, productType)]));
}

function levelScore(value: "low" | "medium" | "high" | "easy" | "hard" | undefined, inverted = false) {
  const score = value === "high" || value === "hard" ? 8 : value === "medium" ? 6 : value === "low" || value === "easy" ? 3 : 5;
  return inverted ? 11 - score : score;
}

function inferProjectContext(project: Project, screenshot: ScreenshotState | null): InferredProjectContext {
  const normalized = normalizeProject(project);
  const text = buildSearchText(project);
  const inferredFrom = [
    project.productTitle ? "Product title" : "",
    project.productDescription ? "Product notes" : "",
    project.competitorUrl ? "Competitor URL" : "",
    screenshot ? "Screenshot uploaded" : "",
  ].filter(Boolean);
  const productType = normalized.normalizedProductType;
  const isDadGift = /dad|father|husband|grandpa|papa|belly|bbq|grill/.test(text);
  const isPet = /pet|dog|cat|memorial|rainbow|paw/.test(text);
  const isHoliday = /christmas|ornament|stocking|holiday/.test(text);
  const buyerPersona = project.buyerPersona || (isDadGift ? "Dad" : isPet ? "Pet Lover" : "Family");
  const occasion = project.occasion || (isDadGift ? "Father's Day" : isPet ? "Pet Memorial" : isHoliday ? "Christmas" : "Birthday");
  const visualStyle = normalized.normalizedVisualDirection.includes("Funny custom character")
    ? "Funny Custom Character"
    : productType === "Stained Glass Suncatcher"
      ? "Stained Glass"
      : productType === "Custom Photo Cap"
        ? "Embroidery Style"
        : "Clean Ecommerce Product Mockup";
  const brandVoice = project.brandVoice?.length ? project.brandVoice : isDadGift ? ["Fun", "Gift-focused", "US-market natural"] : ["Warm", "Gift-focused", "US-market natural"];
  const customFields = getCustomFields(productType).map((field) => field.name);
  const confidence = Math.min(96, 48 + (project.productTitle ? 16 : 0) + (project.productDescription ? 16 : 0) + (project.competitorUrl ? 8 : 0) + (screenshot ? 8 : 0));

  return {
    normalizedProductType: productType,
    buyerPersona,
    giftRecipient: isDadGift ? ["Dad", "Husband", "Grandpa"] : isPet ? ["Dog Mom", "Cat Mom", "Pet Lover"] : [buyerPersona],
    occasion: [occasion],
    niche: project.niche || (isDadGift ? "Funny personalized dad gifts and family humor gifts" : isPet ? "Personalized pet memorial gifts" : `Personalized ${productType.toLowerCase()} gifts`),
    visualStyle,
    brandVoice,
    customFields,
    coreEmotion: isDadGift ? "Playful family humor" : isPet ? "Warm remembrance" : "Personal, thoughtful recognition",
    visualMechanism: normalized.normalizedVisualDirection,
    likelyPurchaseReason: isDadGift
      ? "The buyer wants a custom funny gift that feels more personal than a generic Father's Day product."
      : "The buyer wants a personalized gift that feels specific to the recipient and occasion.",
    copyRisk: project.productDescription ? "Medium" : "Low",
    recommendedOutputs: OUTPUT_REQUESTS,
    confidence,
    inferredFrom: inferredFrom.length ? inferredFrom : ["Fallback rules"],
  };
}

function getOpportunityScore(project: Project, analysis: Analysis | null): OpportunityScore {
  const normalized = normalizeProject(project);
  const text = `${project.productTitle || ""} ${project.productDescription || ""} ${project.niche || ""} ${project.occasion || ""}`.toLowerCase();
  const isGift = /gift|father|mother|birthday|christmas|anniversary|memorial|dad|grandpa|husband|wife/.test(text);
  const isSeasonal = /father|mother|christmas|valentine|halloween|thanksgiving|birthday/.test(text);
  const hasPhoto = analysis?.customFields.some((field) => field.name.toLowerCase().includes("photo")) || /photo|face|custom/.test(text);
  const customDepth = Math.min(10, levelScore(analysis?.scores.customDepth) + (hasPhoto ? 1 : 0));
  const emotionalPull = Math.min(10, analysis?.productBreakdown.coreEmotion ? 7 : 5);
  const adCreativePotential = Math.min(10, levelScore(analysis?.scores.adsPotential) + (normalized.normalizedProductType.includes("Squishy") ? 1 : 0));
  const giftability = isGift ? 8 : 6;
  const seasonality = isSeasonal ? 8 : 5;
  const productionComplexity = levelScore(analysis?.scores.productionDifficulty, true);
  const copycatRisk = levelScore(analysis?.scores.copyRisk);
  const overall = Number(((customDepth + emotionalPull + adCreativePotential + giftability + seasonality + productionComplexity + (11 - copycatRisk)) / 7).toFixed(1));

  return {
    customDepth,
    emotionalPull,
    adCreativePotential,
    giftability,
    seasonality,
    productionComplexity,
    copycatRisk,
    overall,
    explanations: {
      customDepth: hasPhoto ? "Photo upload and multiple personalization fields create clear customization depth." : "Based on available custom fields and product specificity.",
      emotionalPull: analysis?.productBreakdown.coreEmotion || "Emotional pull depends on buyer, occasion, and relationship clarity.",
      adCreativePotential: analysis?.scores.adsPotential === "high" ? "The concept has strong visual hooks and clear demo potential." : "Ad potential can improve with stronger visual action.",
      giftability: isGift ? "Buyer and occasion map clearly to a gift purchase." : "Gift angle is present but could be sharpened.",
      seasonality: isSeasonal ? "The brief includes a seasonal or event-based buying reason." : "No strong seasonal trigger yet.",
      productionComplexity: "Higher score means easier production relative to personalization depth.",
      copycatRisk: "Higher risk means stronger transformation rules are needed before production.",
    },
  };
}

function buildCreativeAngleGroups(project: Project, analysis: Analysis | null): CreativeAngleGroup[] {
  const normalized = normalizeProject(project);
  const buyer = project.buyerPersona || analysis?.productBreakdown.coreBuyer || "Gift buyer";
  const occasion = project.occasion || analysis?.productBreakdown.coreOccasion || "gift moment";
  const product = normalized.normalizedProductType;
  const isSquishyMagnet = product === "Squishy Acrylic Fridge Magnet";
  const baseVisual = isSquishyMagnet ? "custom face on cartoon body, squishy belly poke moment, fridge close-up" : analysis?.productBreakdown.visualMechanism || normalized.normalizedVisualDirection;

  const groups: CreativeAngleGroup[] = [
    {
      group: "Buyer Angles",
      angles: [
        ["Wife Buying For Husband", "She wants a funny custom gift that feels personal without being sentimental.", "Upload his face and turn him into the fridge joke.", baseVisual],
        ["Kids Buying For Dad", "Kids want a gift Dad will laugh at and use every day.", "The gift the whole family will poke.", "child hand interacting with the product in a bright kitchen"],
        ["Daughter Buying For Grandpa", "Grandpa gifts work best when they feel affectionate and easy to understand.", "Grandpa's new favorite fridge buddy.", "grandkids laughing near the fridge"],
      ].map(([name, insight, hook, direction], index) => ({ id: `buyer-${index}`, name, insight, hook, direction })),
    },
    {
      group: "Occasion Angles",
      angles: [
        [`${occasion} Gift`, `The shopper needs a ${occasion.toLowerCase()} gift that does not feel generic.`, `Not another boring ${occasion} gift.`, "gift reveal on kitchen counter"],
        ["Birthday Gag Gift", "Birthdays need low-pressure humor that still feels custom.", "A tiny custom version of him for his birthday.", "close-up product reveal with wrapping paper"],
        ["Christmas Stocking Stuffer", "Small personalized items work well as surprise add-ons.", "The stocking stuffer everyone notices first.", "holiday fridge or gift table context"],
      ].map(([name, insight, hook, direction], index) => ({ id: `occasion-${index}`, name, insight, hook, direction })),
    },
    {
      group: "Relationship Angles",
      angles: [
        ["Dad Mode", "Relationship labels make the product instantly understandable.", "Dad Mode belongs on the fridge.", "front-facing product with bold relationship label"],
        ["Husband Joke Gift", "Couple humor can be playful without being mean.", "For the husband who checks the fridge like a job.", "wife placing product on fridge"],
        ["Office Buddy", "Gag gifts travel beyond home when the product has a desk or cabinet use case.", "Put his snack inspector energy on the office cabinet.", "office cabinet with snacks and sticky notes"],
      ].map(([name, insight, hook, direction], index) => ({ id: `relationship-${index}`, name, insight, hook, direction })),
    },
    {
      group: "Humor Angles",
      angles: [
        ["Pokeable Belly Demo", "The tactile action is the fastest way to explain the product.", "Yes, the belly is pokeable.", "tight hand-poking close-up"],
        ["Snack Inspector", "Food and fridge behavior creates relatable family humor.", "The official snack inspector has arrived.", "fridge snack shelf context"],
        ["BBQ Belly Buddy", "Hobby themes help personalize beyond the face upload.", "Grill Boss, now in magnet form.", "summer BBQ kitchen transition scene"],
      ].map(([name, insight, hook, direction], index) => ({ id: `humor-${index}`, name, insight, hook, direction })),
    },
    {
      group: "UGC And Lifestyle Angles",
      angles: [
        ["Unboxing Reaction", "Reaction content sells the personalization payoff.", "Wait until he sees his mini fridge twin.", "phone-shot unboxing reveal"],
        ["Kitchen Fridge Close-up", "A clean fridge placement shows scale and use case fast.", "The fridge magnet that starts conversations.", "realistic iPhone close-up on stainless fridge"],
        ["Before And After", "Showing uploaded photo to finished product makes customization clear.", "From photo to pokeable fridge buddy.", "split before-after creative"],
      ].map(([name, insight, hook, direction], index) => ({ id: `ugc-${index}`, name, insight, hook, direction })),
    },
    {
      group: "Bundle And Retention Angles",
      angles: [
        ["Family Set", "Multiple recipients can turn one product into a bundle.", "Make one for Dad, Grandpa, and the office legend.", "three custom variants arranged together"],
        ["Holiday Set", "Seasonal outfit themes create repeat purchases.", "Swap the outfit. Keep the family joke going.", "holiday, BBQ, and office outfit variants"],
        ["Add-on Gift", "Small personalized products can lift cart value.", "Add the fridge buddy to the main gift.", "gift box plus product close-up"],
      ].map(([name, insight, hook, direction], index) => ({ id: `bundle-${index}`, name, insight, hook, direction })),
    },
  ];

  if (!isSquishyMagnet) {
    return groups.map((group) => ({
      ...group,
      angles: group.angles.map((angle) => ({
        ...angle,
        name: angle.name.replace("Dad", buyer).replace("Husband", buyer).replace("Grandpa", buyer),
        hook: angle.hook.replace("fridge", product.toLowerCase()).replace("belly", "custom detail"),
        direction: angle.direction === baseVisual ? baseVisual : `${angle.direction}, ${product.toLowerCase()}, ${normalized.normalizedVisualDirection}`,
      })),
    }));
  }

  return groups;
}

function buildAdMatrixRows(project: Project, analysis: Analysis | null, concepts: Concept[], copyPacks: Record<string, CopyPack>): AdMatrixRow[] {
  const selected = concepts.filter((concept) => concept.selected);
  const fallbackAngles = buildCreativeAngleGroups(project, analysis).flatMap((group) => group.angles).slice(0, 8);
  const conceptRows = selected.map((concept, index) => {
    const copy = copyPacks[concept.id];
    return {
      id: `concept-matrix-${concept.id}`,
      angleName: concept.name,
      buyerInsight: concept.oneLineIdea,
      hook: copy?.metaHooks[index % Math.max(copy.metaHooks.length, 1)] || concept.adHook,
      visualDirection: concept.mockupDirection,
      primaryText: copy?.primaryTexts[index % Math.max(copy.primaryTexts.length, 1)] || `Turn ${analysis?.productBreakdown.coreBuyer || "the recipient"} into a custom ${normalizeProject(project).normalizedProductType.toLowerCase()} with a clear personal moment.`,
      headline: copy?.headlines[index % Math.max(copy.headlines.length, 1)] || concept.adHook,
      cta: "Shop Now",
      recommendedAssetType: index % 2 === 0 ? "Meta 1:1 image, 9:16 UGC reel" : "4:5 lifestyle image, 9:16 demo frame",
    };
  });

  const angleRows = fallbackAngles.slice(0, Math.max(0, 10 - conceptRows.length)).map((angle, index) => ({
    id: `angle-matrix-${angle.id}`,
    angleName: angle.name,
    buyerInsight: angle.insight,
    hook: angle.hook,
    visualDirection: angle.direction,
    primaryText: `${angle.insight} Make the product feel original, personal, and easy to understand in the first three seconds.`,
    headline: angle.hook,
    cta: "Shop Now",
    recommendedAssetType: index % 2 === 0 ? "Meta 1:1 image" : "9:16 UGC reel",
  }));

  return [...conceptRows, ...angleRows];
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
  if (!size) return "0 B";
  if (size < 1024) return `${size} B`;
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
      className="focus-ring inline-flex h-9 items-center gap-1.5 rounded-lg border border-primary bg-white px-3 text-xs font-medium text-primary hover:bg-surface-muted"
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
  const [artworkAssets, setArtworkAssets] = useState<ArtworkAsset[]>(() => getCurrentDraft()?.artworkAssets || []);
  const [componentPromptPacks, setComponentPromptPacks] = useState<Record<string, ComponentPromptPack>>(() => getCurrentDraft()?.componentPromptPacks || {});
  const [copyPacks, setCopyPacks] = useState<Record<string, CopyPack>>(() => getCurrentDraft()?.copyPacks || {});
  const [activeTab, setActiveTab] = useState("Analysis");
  const [activeView, setActiveView] = useState<AppView>("Dashboard");
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
  const [exportRecords, setExportRecords] = useState<ExportRecord[]>(() => getCurrentDraft()?.exportRecords || []);
  const [inferredContext, setInferredContext] = useState<InferredProjectContext | null>(() => getCurrentDraft()?.inferredContext || null);
  const [activeVersionId, setActiveVersionId] = useState("");
  const [conceptExtras, setConceptExtras] = useState<ConceptExtras>(() => getCurrentDraft()?.conceptExtras || {});
  const [assetPlans, setAssetPlans] = useState<CreativeAssetPlan[]>(() => getCurrentDraft()?.assetPlans || []);
  const [componentAssetWorkflow, setComponentAssetWorkflow] = useState<ComponentAssetWorkflowState>(() => getCurrentDraft()?.componentAssetWorkflow || {});
  const [health, setHealth] = useState<{ groqConfigured: boolean; supabaseConfigured: boolean; imageProvider: string; imageProviderConfigured: boolean; appVersion: string } | null>(null);
  const [draftSyncStatus, setDraftSyncStatus] = useState("Checking workspace sync");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [clearNeedsConfirm, setClearNeedsConfirm] = useState(false);
  const clearConfirmTimer = useRef<number | null>(null);
  const outputRef = useRef<HTMLElement | null>(null);

  const selectedConcepts = useMemo(() => concepts.filter((concept) => concept.selected), [concepts]);
  const outputFlags = useMemo(() => getOutputFlags(project), [project]);
  const visibleTabs = useMemo(
    () =>
      tabs.filter((tab) => {
        if (tab === "Snapshot") return true;
        if (tab === "Decomposition") return true;
        if (tab === "Personalization Map") return true;
        if (tab === "Asset Plan") return true;
        if (tab === "Material Notes") return true;
        if (tab === "Copy") return outputFlags.shopifyCopy || outputFlags.seo || outputFlags.metaAds;
        if (tab === "Artwork Assets") return true;
        if (tab === "Teeinblue Package") return true;
        if (tab === "Component Prompts") return true;
        if (tab === "Export") return outputFlags.exportMarkdown || outputFlags.exportJson;
        return true;
      }),
    [outputFlags],
  );
  const displayedActiveTab = visibleTabs.includes(activeTab) ? activeTab : visibleTabs[0] || "Snapshot";
  const readiness = useMemo(() => getReadiness(project, screenshot), [project, screenshot]);
  const opportunityScore = useMemo(() => getOpportunityScore(project, analysis), [analysis, project]);
  const baseProductDecomposition = useMemo(() => buildProductDecomposition(project, analysis, artworkAssets), [analysis, artworkAssets, project]);
  const productDecomposition = useMemo<ProductDecomposition>(
    () => ({
      ...baseProductDecomposition,
      componentAssetPlan: baseProductDecomposition.componentAssetPlan.map((asset) =>
        componentAssetWorkflow[asset.id] ? { ...asset, status: componentAssetWorkflow[asset.id].status } : asset,
      ),
    }),
    [baseProductDecomposition, componentAssetWorkflow],
  );
  const creativeAngleGroups = useMemo(() => buildCreativeAngleGroups(project, analysis), [analysis, project]);
  const adMatrixRows = useMemo(() => buildAdMatrixRows(project, analysis, concepts, copyPacks), [analysis, concepts, copyPacks, project]);
  const hasGeneratedPack = Boolean(analysis);
  const markdown = useMemo(() => {
    const base = exportMarkdown({ project, analysis, concepts, prompts: promptPacks, componentPrompts: componentPromptPacks, copies: copyPacks, flags: outputFlags });
    const decompositionMarkdown = formatProductDecompositionMarkdown(productDecomposition);
    return `${decompositionMarkdown}

${base}
## Generation Metadata

- Strategy source: ${getSourceLabel(generationMeta)}
- Model: ${generationMeta?.model || "Not set"}
- Fallback used: ${generationMeta?.fallbackUsed ? "Yes" : "No"}
- Generated at: ${generationMeta?.generatedAt || "Not generated"}
- Draft ID: ${currentDraftId || "Unsaved"}
- Version ID: ${activeVersionId || versions[0]?.id || "No version"}
- Artwork assets: ${artworkAssets.length}
- Screenshot included: ${screenshot ? "Yes" : "No"}
`;
  }, [activeVersionId, analysis, artworkAssets.length, componentPromptPacks, concepts, copyPacks, currentDraftId, generationMeta, outputFlags, productDecomposition, project, promptPacks, screenshot, versions]);
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
        designComponents: productDecomposition.designComponents,
        personalizationMap: productDecomposition.personalizationMap,
        componentAssetPlan: productDecomposition.componentAssetPlan,
        componentAssetWorkflow,
        componentPrompts: componentPromptPacks,
        materialNotes: productDecomposition.materialNotes,
        safeTransformationPlan: productDecomposition.safeTransformationPlan,
        opportunityScore,
        creativeAngleGroups,
        adMatrixRows,
        concepts: filtered.concepts,
        promptPacks: filtered.promptPacks,
        artworkAssets,
        componentPromptPacks,
        copyPacks: filtered.copyPacks,
        assetPlans,
        generationMeta,
        versions,
        exportRecords,
        screenshot: screenshot ? { name: screenshot.name, type: screenshot.type, size: screenshot.size } : null,
        screenshotIncluded: Boolean(screenshot),
        exportedAt: new Date().toISOString(),
      },
      null,
      2,
    ));
  }, [adMatrixRows, analysis, artworkAssets, assetPlans, componentAssetWorkflow, componentPromptPacks, concepts, copyPacks, creativeAngleGroups, exportRecords, generationMeta, opportunityScore, productDecomposition, project, promptPacks, screenshot, versions]);
  const genericExportWarning = useMemo(() => hasGenericOutputWarning(`${markdown}\n${jsonExportValue}`), [jsonExportValue, markdown]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const remoteDrafts = await fetchRemoteDrafts();
      if (cancelled) return;
      if (!remoteDrafts) {
        setDraftSyncStatus("Local fallback active");
        return;
      }
      setDrafts(remoteDrafts);
      writeDrafts(remoteDrafts);
      setDraftSyncStatus("Supabase workspace");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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

  const analyzeProduct = () => {
    const hasSignal = Boolean(project.competitorUrl || project.productTitle || project.productDescription || screenshot);
    const sourceProject = hasSignal ? project : createDemoProject();
    const sourceScreenshot = hasSignal ? screenshot : null;

    const inferred = inferProjectContext(sourceProject, sourceScreenshot);
    const nextProject: Project = {
      ...sourceProject,
      status: "analyzed",
      productType: inferred.normalizedProductType,
      buyerPersona: inferred.buyerPersona,
      occasion: inferred.occasion[0] || project.occasion,
      niche: inferred.niche,
      brandVoice: inferred.brandVoice,
      visualStyle: [inferred.visualStyle],
      outputs: inferred.recommendedOutputs,
      updatedAt: new Date().toISOString(),
    };
    const existing = currentDraftId ? drafts.find((draft) => draft.id === currentDraftId) : null;
    const draft = buildDraft({
      id: currentDraftId || undefined,
      project: nextProject,
      analysis,
      concepts,
      promptPacks,
      artworkAssets,
      componentPromptPacks,
      copyPacks,
      screenshot: sourceScreenshot,
      conceptExtras,
      assetPlans,
      componentAssetWorkflow,
      generationMeta,
      versions,
      exportRecords,
      inferredContext: inferred,
      createdAt: existing?.createdAt,
    });
    const nextDrafts = existing ? drafts.map((item) => (item.id === draft.id ? draft : item)) : [draft, ...drafts];

    setProject(nextProject);
    setScreenshot(sourceScreenshot);
    setInferredContext(inferred);
    setDrafts(nextDrafts);
    setCurrentDraftId(draft.id);
    setActiveView("Product Brief");
    writeDrafts(nextDrafts);
    localStorage.setItem(CURRENT_DRAFT_ID_KEY, draft.id);
    localStorage.setItem(PROJECT_DRAFT_KEY, JSON.stringify(nextProject));
    if (!sourceScreenshot) localStorage.removeItem(SCREENSHOT_DRAFT_KEY);
    void saveRemoteDraft(draft);
    setHasUnsavedChanges(false);
    setToast(hasSignal ? "Product analyzed" : "Demo product analyzed");
    window.setTimeout(() => setToast(""), 1400);
  };

  const applyStrategy = (strategy: GenerateStrategyResponse, meta: GenerationMeta, sourceProject = project, sourceInferredContext = inferredContext) => {
    const normalized = normalizeProject(sourceProject);
    const nextProject: Project = {
      ...sourceProject,
      status: "prompt-ready",
      name: sourceProject.productTitle || sourceProject.name,
      updatedAt: new Date().toISOString(),
    };
    const draftId = currentDraftId || id("draft");
    const nextComponentPromptPacks = buildComponentPromptPacks(strategy.concepts.filter((concept) => concept.selected), normalized.normalizedProductType);
    const nextArtworkAssets = buildArtworkAssets(strategy.concepts.filter((concept) => concept.selected), normalized.normalizedProductType, nextProject.id, draftId);
    const version: GenerationVersion = {
      id: id("version"),
      draftId,
      label: `Version ${versions.length + 1}`,
      analysis: strategy.analysis,
      concepts: strategy.concepts,
      promptPacks: strategy.promptPacks,
      artworkAssets: nextArtworkAssets,
      componentPromptPacks: nextComponentPromptPacks,
      copyPacks: strategy.copyPacks,
      generationMeta: meta,
      createdAt: new Date().toISOString(),
    };
    const nextVersions = [version, ...versions];
    const nextAssetPlans = buildAssetPlans(strategy.concepts.filter((concept) => concept.selected), strategy.promptPacks);
    const nextComponentAssetWorkflow: ComponentAssetWorkflowState = {};
    const existing = drafts.find((draft) => draft.id === draftId);
    const nextDraft = buildDraft({
      id: draftId,
      project: nextProject,
      analysis: strategy.analysis,
      concepts: strategy.concepts,
      promptPacks: strategy.promptPacks,
      artworkAssets: nextArtworkAssets,
      componentPromptPacks: nextComponentPromptPacks,
      copyPacks: strategy.copyPacks,
      screenshot,
      conceptExtras,
      assetPlans: nextAssetPlans,
      componentAssetWorkflow: nextComponentAssetWorkflow,
      generationMeta: meta,
      versions: nextVersions,
      exportRecords,
      inferredContext: sourceInferredContext,
      createdAt: existing?.createdAt,
    });
    const nextDrafts = existing ? drafts.map((draft) => (draft.id === draftId ? nextDraft : draft)) : [nextDraft, ...drafts];

    setAnalysis(strategy.analysis);
    setConcepts(strategy.concepts);
    setPromptPacks(strategy.promptPacks);
    setArtworkAssets(nextArtworkAssets);
    setComponentPromptPacks(nextComponentPromptPacks);
    setCopyPacks(strategy.copyPacks);
    setGenerationMeta(meta);
    setStrategySource(getSourceLabel(meta));
    setProject(nextProject);
    setInferredContext(sourceInferredContext);
    setCurrentDraftId(draftId);
    localStorage.setItem(CURRENT_DRAFT_ID_KEY, draftId);
    setVersions(nextVersions);
    setActiveVersionId(version.id);
    setAssetPlans(nextAssetPlans);
    setComponentAssetWorkflow(nextComponentAssetWorkflow);
    setDrafts(nextDrafts);
    writeDrafts(nextDrafts);
    void (async () => {
      await saveRemoteDraft(nextDraft);
      await saveRemoteGeneration(version);
      await saveRemoteArtworkAssets(nextDraft.id, nextArtworkAssets);
    })();
    localStorage.setItem(PROJECT_DRAFT_KEY, JSON.stringify(nextProject));
    if (screenshot) localStorage.setItem(SCREENSHOT_DRAFT_KEY, JSON.stringify(screenshot));
    setHasUnsavedChanges(false);
    setActiveView("Product Brief");
    setActiveTab("Artwork Assets");
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
      const data = (await response.json()) as GenerateStrategyResponse & { source?: string; fallbackReason?: string };
      const fallbackUsed = data.source === "local-fallback" || data.source === "local";
      if (fallbackUsed) {
        setGenerationError(data.fallbackReason || "Groq was not used, so the local template generated this pack.");
      }
      applyStrategy(data, {
        usedAI: data.source === "groq",
        generationSource: data.source === "groq" ? "groq" : "local-template",
        model: data.source === "groq" ? "llama-3.3-70b-versatile" : undefined,
        fallbackUsed,
        fallbackReason: fallbackUsed ? data.fallbackReason || "API route used local template generation." : undefined,
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

  const startDemoWorkflow = () => {
    const demoProject = createDemoProject();
    const inferred = inferProjectContext(demoProject, null);
    const analyzedProject: Project = {
      ...demoProject,
      status: "analyzed",
      productType: inferred.normalizedProductType,
      buyerPersona: inferred.buyerPersona,
      occasion: inferred.occasion[0] || demoProject.occasion,
      niche: inferred.niche,
      brandVoice: inferred.brandVoice,
      visualStyle: [inferred.visualStyle],
      outputs: inferred.recommendedOutputs,
      updatedAt: new Date().toISOString(),
    };
    const strategy = buildLocalStrategy(analyzedProject);
    setScreenshot(null);
    localStorage.removeItem(SCREENSHOT_DRAFT_KEY);
    setGenerationError("Demo data is loaded so the full workflow is visible without a live API call.");
    applyStrategy(
      strategy,
      {
        usedAI: false,
        generationSource: "local-template",
        fallbackUsed: true,
        fallbackReason: "Demo workflow data loaded for testing.",
        durationMs: 0,
        generatedAt: new Date().toISOString(),
      },
      analyzedProject,
      inferred,
    );
  };

  const persistArtworkAssets = (nextArtworkAssets: ArtworkAsset[], workflowOverride = componentAssetWorkflow) => {
    setArtworkAssets(nextArtworkAssets);
    const existing = currentDraftId ? drafts.find((draft) => draft.id === currentDraftId) : null;
    if (!currentDraftId || !existing) {
      setHasUnsavedChanges(true);
      return;
    }

    const draft = buildDraft({
      id: currentDraftId,
      project,
      analysis,
      concepts,
      promptPacks,
      artworkAssets: nextArtworkAssets,
      componentPromptPacks,
      copyPacks,
      screenshot,
      conceptExtras,
      assetPlans,
      componentAssetWorkflow: workflowOverride,
      generationMeta,
      versions,
      exportRecords,
      inferredContext,
      createdAt: existing.createdAt,
    });
    const nextDrafts = drafts.map((item) => (item.id === draft.id ? draft : item));
    setDrafts(nextDrafts);
    writeDrafts(nextDrafts);
    void (async () => {
      await saveRemoteDraft(draft);
      await saveRemoteArtworkAssets(draft.id, nextArtworkAssets);
      await saveRemoteComponentAssetWorkflow(draft.id, workflowOverride);
    })();
    setHasUnsavedChanges(false);
  };

  const upsertArtworkFromComponentAsset = (assetId: string, workflow: ComponentAssetWorkflowState) => {
    const componentAsset = productDecomposition.componentAssetPlan.find((asset) => asset.id === assetId);
    const concept = selectedConcepts[0];
    if (!componentAsset || !concept) return;

    const now = new Date().toISOString();
    const nextArtworkAsset = buildArtworkAssetFromComponentPlan({
      asset: componentAsset,
      concept,
      project,
      draftId: currentDraftId,
      workflow: workflow[assetId],
    });
    const exists = artworkAssets.some((asset) => asset.id === nextArtworkAsset.id);
    const nextArtworkAssets = exists
      ? artworkAssets.map((asset) =>
          asset.id === nextArtworkAsset.id
            ? {
                ...asset,
                ...nextArtworkAsset,
                createdAt: asset.createdAt,
                updatedAt: workflow[assetId]?.updatedAt || now,
              }
            : asset,
        )
      : [nextArtworkAsset, ...artworkAssets];
    persistArtworkAssets(nextArtworkAssets, workflow);
  };

  const updateArtworkAssetStatus = (assetId: string, status: ArtworkAsset["status"]) => {
    const now = new Date().toISOString();
    const nextArtworkAssets = artworkAssets.map((asset) => (asset.id === assetId ? { ...asset, status, updatedAt: now } : asset));
    persistArtworkAssets(nextArtworkAssets);
    setToast(`Asset marked ${status}`);
    window.setTimeout(() => setToast(""), 1400);
  };

  const uploadArtworkAsset = (assetId: string, file: File) => {
    if (!["image/png", "image/jpeg", "image/svg+xml"].includes(file.type)) {
      setToast("Use PNG, JPG, or SVG");
      window.setTimeout(() => setToast(""), 1400);
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const now = new Date().toISOString();
      const localDataUrl = String(reader.result);
      const remoteUpload = await uploadRemoteArtworkAsset({
        draftId: currentDraftId || project.id,
        assetId,
        filename: file.name,
        contentType: file.type,
        dataUrl: localDataUrl,
      });
      const uploadedAssetUrl = remoteUpload?.storageUrl || localDataUrl;
      const nextArtworkAssets = artworkAssets.map((asset) =>
        asset.id === assetId
          ? {
              ...asset,
              uploadedAssetUrl,
              uploadedAssetName: file.name,
              uploadedAssetType: file.type,
              uploadedAssetSource: remoteUpload ? ("supabase-storage" as const) : ("local" as const),
              uploadedAssetStoragePath: remoteUpload?.path,
              status: "Uploaded" as const,
              updatedAt: now,
            }
          : asset,
      );
      persistArtworkAssets(nextArtworkAssets);
      setToast(remoteUpload ? "Asset uploaded to Supabase Storage" : "Asset uploaded locally");
      window.setTimeout(() => setToast(""), 1400);
    };
    reader.readAsDataURL(file);
  };

  const persistComponentAssetWorkflow = (nextWorkflow: ComponentAssetWorkflowState) => {
    setComponentAssetWorkflow(nextWorkflow);
    const existing = currentDraftId ? drafts.find((draft) => draft.id === currentDraftId) : null;
    if (!currentDraftId || !existing) {
      setHasUnsavedChanges(true);
      return;
    }

    const draft = buildDraft({
      id: currentDraftId,
      project,
      analysis,
      concepts,
      promptPacks,
      artworkAssets,
      componentPromptPacks,
      copyPacks,
      screenshot,
      conceptExtras,
      assetPlans,
      componentAssetWorkflow: nextWorkflow,
      generationMeta,
      versions,
      exportRecords,
      inferredContext,
      createdAt: existing.createdAt,
    });
    const nextDrafts = drafts.map((item) => (item.id === draft.id ? draft : item));
    setDrafts(nextDrafts);
    writeDrafts(nextDrafts);
    void (async () => {
      await saveRemoteDraft(draft);
      await saveRemoteComponentAssetWorkflow(draft.id, nextWorkflow);
    })();
    setHasUnsavedChanges(false);
  };

  const updateComponentAssetStatus = (assetId: string, status: ComponentAssetPlan["status"]) => {
    const nextWorkflow: ComponentAssetWorkflowState = {
      ...componentAssetWorkflow,
      [assetId]: {
        ...componentAssetWorkflow[assetId],
        status,
        updatedAt: new Date().toISOString(),
      },
    };
    persistComponentAssetWorkflow(nextWorkflow);
    upsertArtworkFromComponentAsset(assetId, nextWorkflow);
    setToast(`Component asset marked ${status}`);
    window.setTimeout(() => setToast(""), 1400);
  };

  const uploadComponentAsset = (assetId: string, file: File) => {
    if (!["image/png", "image/jpeg", "image/svg+xml"].includes(file.type)) {
      setToast("Use PNG, JPG, or SVG");
      window.setTimeout(() => setToast(""), 1400);
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const localDataUrl = String(reader.result);
      const remoteUpload = await uploadRemoteArtworkAsset({
        draftId: currentDraftId || project.id,
        assetId: `component-${assetId}`,
        filename: file.name,
        contentType: file.type,
        dataUrl: localDataUrl,
      });
      const nextWorkflow: ComponentAssetWorkflowState = {
        ...componentAssetWorkflow,
        [assetId]: {
          ...componentAssetWorkflow[assetId],
          status: "Uploaded",
          uploadedAssetUrl: remoteUpload?.storageUrl || localDataUrl,
          uploadedAssetName: file.name,
          uploadedAssetType: file.type,
          uploadedAssetSource: remoteUpload ? "supabase-storage" : "local",
          uploadedAssetStoragePath: remoteUpload?.path,
          updatedAt: new Date().toISOString(),
        },
      };
      persistComponentAssetWorkflow(nextWorkflow);
      upsertArtworkFromComponentAsset(assetId, nextWorkflow);
      setToast(remoteUpload ? "Component asset uploaded to Supabase Storage" : "Component asset uploaded locally");
      window.setTimeout(() => setToast(""), 1400);
    };
    reader.readAsDataURL(file);
  };

  const getTeeinblueConceptAssets = (concept: Concept) => {
    const conceptAssets = artworkAssets.filter((asset) => asset.conceptId === concept.id);
    const existingIds = new Set(conceptAssets.map((asset) => asset.id));
    const componentAssets = productDecomposition.componentAssetPlan
      .map((asset) =>
        buildArtworkAssetFromComponentPlan({
          asset,
          concept,
          project,
          draftId: currentDraftId,
          workflow: componentAssetWorkflow[asset.id],
        }),
      )
      .filter((asset) => !existingIds.has(asset.id));
    return [...conceptAssets, ...componentAssets];
  };

  const buildTeeinbluePackagesForSync = (draftId: string, conceptsToPackage = selectedConcepts) =>
    conceptsToPackage.map((concept) => {
      const conceptAssets = getTeeinblueConceptAssets(concept);
      return buildTeeinbluePackageSync(draftId, project, concept, conceptAssets);
    });

  const ensureDraftForPackage = (draftId: string) => {
    const existing = drafts.find((draft) => draft.id === draftId);
    const draft = buildDraft({
      id: draftId,
      project,
      analysis,
      concepts,
      promptPacks,
      artworkAssets,
      componentPromptPacks,
      copyPacks,
      screenshot,
      conceptExtras,
      assetPlans,
      componentAssetWorkflow,
      generationMeta,
      versions,
      exportRecords,
      inferredContext,
      createdAt: existing?.createdAt,
    });
    const nextDrafts = existing ? drafts.map((item) => (item.id === draft.id ? draft : item)) : [draft, ...drafts];
    setCurrentDraftId(draftId);
    setDrafts(nextDrafts);
    writeDrafts(nextDrafts);
    localStorage.setItem(CURRENT_DRAFT_ID_KEY, draftId);
    return draft;
  };

  const syncTeeinbluePackages = async (concept?: Concept) => {
    if (!selectedConcepts.length) {
      setToast("Select a concept first");
      window.setTimeout(() => setToast(""), 1400);
      return;
    }
    const draftId = currentDraftId || id("draft");
    const draft = ensureDraftForPackage(draftId);
    const packages = buildTeeinbluePackagesForSync(draftId, concept ? [concept] : selectedConcepts);
    const packageAssets = (concept ? [concept] : selectedConcepts).flatMap((item) => getTeeinblueConceptAssets(item));
    await saveRemoteDraft(draft);
    await saveRemoteArtworkAssets(draftId, packageAssets);
    await saveRemoteComponentAssetWorkflow(draftId, componentAssetWorkflow);
    const source = await saveRemoteDesignPackages(draftId, packages);
    setToast(source === "supabase" ? "Teeinblue package synced" : "Package saved locally; Supabase table may need SQL");
    window.setTimeout(() => setToast(""), 1800);
  };

  const exportTeeinblueZip = async (concept: Concept) => {
    const draftId = currentDraftId || id("draft");
    const conceptAssets = getTeeinblueConceptAssets(concept);
    const packageSync = buildTeeinbluePackageSync(draftId, project, concept, conceptAssets);
    const decompositionJson = JSON.stringify({ ...productDecomposition, componentAssetWorkflow }, null, 2);
    const filePrefix = concept.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "teeinblue-package";
    const files: ZipFileInput[] = [
      { path: "design-package/setup_guide.md", data: packageSync.setupGuide },
      { path: "design-package/teeinblue_manifest.json", data: JSON.stringify(packageSync.manifest, null, 2) },
      { path: "design-package/layout_plan.json", data: JSON.stringify(packageSync.layoutPlan, null, 2) },
      { path: "design-package/asset_slots.json", data: JSON.stringify(packageSync.assetSlots, null, 2) },
      { path: "design-package/component_asset_plan.json", data: JSON.stringify(productDecomposition.componentAssetPlan, null, 2) },
      { path: "design-package/component_asset_workflow.json", data: JSON.stringify(componentAssetWorkflow, null, 2) },
      { path: "product-decomposition/product-decomposition.md", data: formatProductDecompositionMarkdown(productDecomposition) },
      { path: "product-decomposition/product-decomposition.json", data: decompositionJson },
    ];

    conceptAssets.forEach((asset) => {
      if (!asset.uploadedAssetUrl?.startsWith("data:")) return;
      const extension = asset.uploadedAssetName?.split(".").pop() || (asset.uploadedAssetType === "image/svg+xml" ? "svg" : asset.uploadedAssetType === "image/jpeg" ? "jpg" : "png");
      const safeName = (asset.uploadedAssetName || asset.title).toLowerCase().replace(/\.[a-z0-9]+$/i, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || asset.id;
      files.push({
        path: `design-package/assets/${safeName}.${extension}`,
        data: dataUrlToBytes(asset.uploadedAssetUrl),
      });
    });

    const previewPng = await renderTeeinbluePreviewPng(packageSync.layoutPlan, conceptAssets);
    if (previewPng) {
      files.push({ path: "exports/final_preview.png", data: previewPng });
    } else {
      files.push({ path: "exports/final_preview_note.txt", data: "Preview PNG could not be rendered in this browser session. Use the layout_plan.json and uploaded assets to assemble the final preview in Teeinblue/Figma." });
    }

    const zip = createZipBlob(files);
    downloadBlob(`${filePrefix}-teeinblue-package.zip`, zip, {
      conceptId: concept.id,
      packageType: "teeinblue",
      assetCount: conceptAssets.length,
      uploadedAssetCount: packageSync.uploadedAssets.length,
    });
  };

  const saveDraft = () => {
    const existing = currentDraftId ? drafts.find((draft) => draft.id === currentDraftId) : null;
    const draft = buildDraft({
      id: currentDraftId || undefined,
      project,
      analysis,
      concepts,
      promptPacks,
      artworkAssets,
      componentPromptPacks,
      copyPacks,
      screenshot,
      conceptExtras,
      assetPlans,
      componentAssetWorkflow,
      generationMeta,
      versions,
      exportRecords,
      inferredContext,
      createdAt: existing?.createdAt,
    });
    const nextDrafts = existing ? drafts.map((item) => (item.id === draft.id ? draft : item)) : [draft, ...drafts];
    setDrafts(nextDrafts);
    setCurrentDraftId(draft.id);
    writeDrafts(nextDrafts);
    void (async () => {
      await saveRemoteDraft(draft);
      await saveRemoteArtworkAssets(draft.id, artworkAssets);
      await saveRemoteComponentAssetWorkflow(draft.id, componentAssetWorkflow);
    })();
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
    const normalized = normalizeProject(draft.project);
    setCurrentDraftId(draft.id);
    localStorage.setItem(CURRENT_DRAFT_ID_KEY, draft.id);
    setProject(draft.project);
    setAnalysis(draft.analysis || null);
    setConcepts(draft.concepts || []);
    setPromptPacks(draft.promptPacks || {});
    setArtworkAssets(draft.artworkAssets || buildArtworkAssets((draft.concepts || []).filter((concept) => concept.selected), normalized.normalizedProductType, draft.project.id, draft.id));
    setComponentPromptPacks(draft.componentPromptPacks || buildComponentPromptPacks((draft.concepts || []).filter((concept) => concept.selected), normalized.normalizedProductType));
    setCopyPacks(draft.copyPacks || {});
    setScreenshot(draft.screenshot || null);
    setConceptExtras(draft.conceptExtras || {});
    setAssetPlans(draft.assetPlans || []);
    setComponentAssetWorkflow(draft.componentAssetWorkflow || {});
    setGenerationMeta(draft.generationMeta);
    setVersions(draft.versions || []);
    setExportRecords(draft.exportRecords || []);
    setInferredContext(draft.inferredContext || null);
    setStrategySource(getSourceLabel(draft.generationMeta));
    setActiveView("Product Brief");
    setActiveTab("Snapshot");
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
    setArtworkAssets([]);
    setComponentPromptPacks({});
    setCopyPacks({});
    setScreenshot(null);
    setConceptExtras({});
    setAssetPlans([]);
    setComponentAssetWorkflow({});
    setGenerationMeta(undefined);
    setVersions([]);
    setExportRecords([]);
    setInferredContext(null);
    setStrategySource("");
    setActiveView("Product Brief");
    setActiveTab("Snapshot");
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
    void saveRemoteDraft(copy);
    setToast("Draft duplicated");
    window.setTimeout(() => setToast(""), 1400);
  };

  const archiveDraft = (draftId: string) => {
    const nextDrafts = drafts.map((draft) =>
      draft.id === draftId ? { ...draft, status: "archived" as const, updatedAt: new Date().toISOString() } : draft,
    );
    setDrafts(nextDrafts);
    writeDrafts(nextDrafts);
    const archived = nextDrafts.find((draft) => draft.id === draftId);
    if (archived) void patchRemoteDraft(archived);
  };

  const deleteDraft = (draftId: string) => {
    const nextDrafts = drafts.filter((draft) => draft.id !== draftId);
    setDrafts(nextDrafts);
    writeDrafts(nextDrafts);
    void deleteRemoteDraft(draftId);
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
      void deleteRemoteDraft(currentDraftId);
    }
    localStorage.removeItem(CURRENT_DRAFT_ID_KEY);
    setCurrentDraftId(null);
    setProject(createDefaultProject());
    setAnalysis(null);
    setConcepts([]);
    setPromptPacks({});
    setArtworkAssets([]);
    setComponentPromptPacks({});
    setCopyPacks({});
    setActiveTab("Snapshot");
    setStrategySource("");
    setGenerationError("");
    setScreenshot(null);
    setConceptExtras({});
    setAssetPlans([]);
    setComponentAssetWorkflow({});
    setGenerationMeta(undefined);
    setVersions([]);
    setExportRecords([]);
    setInferredContext(null);
    setHasUnsavedChanges(false);
    setClearNeedsConfirm(false);
    setToast("Draft cleared");
    window.setTimeout(() => setToast(""), 1400);
  };

  const restoreVersion = (versionId: string) => {
    const version = versions.find((item) => item.id === versionId);
    if (!version) return;
    setAnalysis(version.analysis);
    setConcepts(version.concepts);
    setPromptPacks(version.promptPacks);
    setArtworkAssets(version.artworkAssets || buildArtworkAssets(version.concepts.filter((concept) => concept.selected), normalizeProject(project).normalizedProductType, project.id, version.draftId));
    setComponentPromptPacks(version.componentPromptPacks || buildComponentPromptPacks(version.concepts.filter((concept) => concept.selected), normalizeProject(project).normalizedProductType));
    setCopyPacks(version.copyPacks);
    setGenerationMeta(version.generationMeta);
    setActiveVersionId(version.id);
    setAssetPlans(buildAssetPlans(version.concepts.filter((concept) => concept.selected), version.promptPacks));
    setToast("Version restored");
    window.setTimeout(() => setToast(""), 1400);
  };

  const download = (name: string, value: string, type: string) => {
    const blob = new Blob([value], { type });
    const draftId = currentDraftId || id("draft");
    const record: ExportRecord = {
      id: id("export"),
      draftId,
      exportType: getExportType(name, type),
      filename: name,
      contentType: type,
      sizeBytes: blob.size,
      metadata: {
        activeTab: displayedActiveTab,
        activeVersionId: activeVersionId || versions[0]?.id || null,
        generationSource: generationMeta?.generationSource || null,
      },
      createdAt: new Date().toISOString(),
    };
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = name;
    link.click();
    URL.revokeObjectURL(href);
    const nextExportRecords = [record, ...exportRecords].slice(0, 25);
    const nextProject: Project = { ...project, status: "exported", updatedAt: new Date().toISOString() };
    const existing = drafts.find((draft) => draft.id === draftId);
    const nextDraft = buildDraft({
      id: draftId,
      project: nextProject,
      analysis,
      concepts,
      promptPacks,
      artworkAssets,
      componentPromptPacks,
      copyPacks,
      screenshot,
      conceptExtras,
      assetPlans,
      componentAssetWorkflow,
      generationMeta,
      versions,
      exportRecords: nextExportRecords,
      inferredContext,
      createdAt: existing?.createdAt,
    });
    const nextDrafts = existing ? drafts.map((draft) => (draft.id === draftId ? nextDraft : draft)) : [nextDraft, ...drafts];
    setExportRecords(nextExportRecords);
    setProject(nextProject);
    setCurrentDraftId(draftId);
    setDrafts(nextDrafts);
    writeDrafts(nextDrafts);
    localStorage.setItem(CURRENT_DRAFT_ID_KEY, draftId);
    localStorage.setItem(PROJECT_DRAFT_KEY, JSON.stringify(nextProject));
    void (async () => {
      await saveRemoteDraft(nextDraft);
      await saveRemoteExport(record);
    })();
  };

  const downloadBlob = (name: string, blob: Blob, metadata: Record<string, unknown> = {}) => {
    const draftId = currentDraftId || id("draft");
    const record: ExportRecord = {
      id: id("export"),
      draftId,
      exportType: getExportType(name, blob.type || "application/octet-stream"),
      filename: name,
      contentType: blob.type || "application/octet-stream",
      sizeBytes: blob.size,
      metadata: {
        activeTab: displayedActiveTab,
        activeVersionId: activeVersionId || versions[0]?.id || null,
        generationSource: generationMeta?.generationSource || null,
        ...metadata,
      },
      createdAt: new Date().toISOString(),
    };
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = name;
    link.click();
    URL.revokeObjectURL(href);
    const nextExportRecords = [record, ...exportRecords].slice(0, 25);
    const nextProject: Project = { ...project, status: "exported", updatedAt: new Date().toISOString() };
    const existing = drafts.find((draft) => draft.id === draftId);
    const nextDraft = buildDraft({
      id: draftId,
      project: nextProject,
      analysis,
      concepts,
      promptPacks,
      artworkAssets,
      componentPromptPacks,
      copyPacks,
      screenshot,
      conceptExtras,
      assetPlans,
      componentAssetWorkflow,
      generationMeta,
      versions,
      exportRecords: nextExportRecords,
      inferredContext,
      createdAt: existing?.createdAt,
    });
    const nextDrafts = existing ? drafts.map((draft) => (draft.id === draftId ? nextDraft : draft)) : [nextDraft, ...drafts];
    setExportRecords(nextExportRecords);
    setProject(nextProject);
    setCurrentDraftId(draftId);
    setDrafts(nextDrafts);
    writeDrafts(nextDrafts);
    localStorage.setItem(CURRENT_DRAFT_ID_KEY, draftId);
    localStorage.setItem(PROJECT_DRAFT_KEY, JSON.stringify(nextProject));
    void (async () => {
      await saveRemoteDraft(nextDraft);
      await saveRemoteExport(record);
    })();
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
    if (label === "Dashboard" || label === "Projects" || label === "Drafts") {
      setActiveView("Dashboard");
      return;
    }
    if (label === "Settings") {
      void openSettings();
      return;
    }
    setActiveView("Product Brief");
    if (label === "Competitor Briefs" || label === "Creative Generator") {
      document.getElementById("product-brief")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (label === "Prompt Library") setActiveTab("Component Prompts");
    else if (label === "Exports") setActiveTab("Export");
    else setActiveTab(label === "Shopify Copy" ? "Copy" : label);
    outputRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const isNavActive = (label: string) => {
    if (label === "Dashboard" || label === "Projects" || label === "Drafts") return activeView === "Dashboard";
    if (label === "Competitor Briefs" || label === "Creative Generator") return activeView === "Product Brief";
    if (label === "Prompt Library") return activeView === "Product Brief" && displayedActiveTab === "Component Prompts";
    if (label === "Exports") return activeView === "Product Brief" && displayedActiveTab === "Export";
    if (label === "Settings") return activeView === "Settings";
    return false;
  };

  const useSampleBrief = () => {
    setProject(createDemoProject());
    setActiveView("Product Brief");
    setHasUnsavedChanges(true);
    setToast("Sample brief loaded");
    window.setTimeout(() => setToast(""), 1400);
  };

  return (
    <main className="min-h-screen bg-background text-primary">
      <header className="sticky top-0 z-30 border-b border-[#3d3d3d] bg-[#1f1f1f] text-white">
        <div className="flex min-h-[64px] flex-wrap items-center justify-between gap-3 px-4 py-3 md:flex-nowrap md:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-white text-primary">
              <Sparkles size={18} />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold leading-5">POD Builder</div>
              <div className="truncate text-xs text-zinc-400">{currentDraftId ? getDraftTitle(project) : "Default Project"}</div>
            </div>
          </div>

          <label className="relative hidden w-full max-w-xl md:block">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              className="h-9 w-full rounded-lg border border-[#4a4a4a] bg-[#2b2b2b] pl-9 pr-3 text-sm text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#005bd3]"
              placeholder="Search projects, competitors, prompts..."
            />
          </label>

          <div className="flex items-center gap-2">
            <span className={cx("hidden rounded-full px-3 py-1 text-xs font-semibold md:inline-flex", generationMeta?.fallbackUsed ? "bg-[#fff4ce] text-[#8a6116]" : generationMeta?.usedAI ? "bg-[#e3f1df] text-[#108043]" : "bg-[#2b2b2b] text-zinc-300")}>
              {generationMeta?.usedAI ? "Groq connected" : generationMeta?.fallbackUsed ? "Local fallback" : "Not generated"}
            </span>
            <button type="button" className="grid h-9 w-9 place-items-center rounded-lg border border-[#4a4a4a] bg-[#2b2b2b] text-zinc-200">
              <Bell size={16} />
            </button>
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-zinc-100 text-sm font-semibold text-primary">DN</div>
          </div>
        </div>
      </header>

      <div className="flex min-h-[calc(100vh-72px)]">
        <aside className="hidden w-[240px] shrink-0 border-r border-border bg-[#ebebeb] p-3 lg:flex lg:flex-col">
          <nav className="sticky top-20 flex min-h-[calc(100vh-88px)] flex-col">
            <div className="space-y-1">
            {navItems.map(([label, Icon, comingSoon]) => (
              <button
                type="button"
                key={label}
                onClick={() => openNav(label)}
                className={cx(
                  "focus-ring flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm",
                  isNavActive(label)
                    ? "bg-white font-semibold text-primary shadow-[0_1px_0_rgba(0,0,0,0.04)]"
                    : "text-secondary hover:bg-white",
                )}
              >
                <Icon size={16} />
                <span className="min-w-0 flex-1 text-left">{label}</span>
                {label === "Competitor Briefs" && hasUnsavedChanges ? <span className="rounded-lg bg-white px-2 py-0.5 text-[10px] font-medium text-primary">Draft</span> : null}
                {label === "Creative Generator" && hasGeneratedPack ? <span className="rounded-lg bg-white px-2 py-0.5 text-[10px] font-medium text-primary">Ready</span> : null}
                {comingSoon ? <span className="rounded-lg bg-white px-2 py-0.5 text-[10px] font-medium text-secondary">Soon</span> : null}
              </button>
            ))}
            </div>
            <div className="mt-auto rounded-xl border border-[#cce0ff] bg-[#eaf4ff] p-4">
              <h4 className="text-sm font-semibold text-primary">Need more generations?</h4>
              <p className="mt-1 text-xs leading-5 text-secondary">Upgrade for image creative workflows.</p>
              <span className="mt-3 inline-flex rounded-lg border border-[#b5d6ff] bg-white px-3 py-1 text-xs font-semibold text-[#005bd3]">Coming soon</span>
            </div>
          </nav>
        </aside>

        <section className="min-w-0 flex-1 px-4 py-6 md:px-8 lg:py-8">
          <div className="mx-auto max-w-[1200px] space-y-6">
            <nav className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:hidden">
              {navItems.map(([label, Icon, comingSoon]) => (
                <button
                  type="button"
                  key={label}
                  onClick={() => openNav(label)}
                  className={cx(
                    "focus-ring inline-flex h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-medium",
                    isNavActive(label) ? "border-black/10 bg-accent text-primary" : "border-border bg-white text-secondary",
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
                draftSyncStatus={draftSyncStatus}
                onCreate={createNewDraft}
                onDemo={startDemoWorkflow}
                onOpen={loadDraft}
                onDuplicate={duplicateDraft}
                onArchive={archiveDraft}
                onDelete={deleteDraft}
              />
            ) : activeView === "Settings" ? (
              <SettingsView health={health} generationMeta={generationMeta} onRefresh={openSettings} />
            ) : (
              <>
                <section className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                  <div>
                    <p className="mb-2 text-xs font-medium uppercase tracking-[0.06em] text-secondary">Creative Generator</p>
                    <h1 className="page-title">Creative Generator</h1>
                    <p className="mt-2 max-w-[720px] text-sm leading-6 text-secondary">
                      Paste a competitor signal, analyze the product context, then generate a complete creative pack.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={saveDraft} className="focus-ring h-9 rounded-lg border border-shade-30 bg-white px-4 text-sm font-semibold text-primary hover:bg-surface-muted">
                      Save Draft
                    </button>
                    <button type="button" onClick={inferredContext ? generateStrategy : analyzeProduct} disabled={isGenerating} className="focus-ring h-9 rounded-lg bg-primary px-4 text-sm font-semibold text-white hover:bg-shade-70 disabled:opacity-70">
                      {isGenerating ? "Generating..." : inferredContext ? "Generate Creative Pack" : "Analyze Product"}
                    </button>
                  </div>
                </section>

                <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
                  <div className="min-w-0">
                    <BriefForm
                      project={project}
                      screenshot={screenshot}
                      updateProject={updateProject}
                      updateScreenshot={updateScreenshotDraft}
                      onAnalyze={analyzeProduct}
                      onGenerate={generateStrategy}
                      onSaveDraft={saveDraft}
                      onClearDraft={clearDraft}
                      isGenerating={isGenerating}
                      clearNeedsConfirm={clearNeedsConfirm}
                      inferredContext={inferredContext}
                    />
                  </div>

                  <BriefSummary
                    project={project}
                    screenshot={screenshot}
                    analysis={analysis}
                    selectedCount={selectedConcepts.length}
                    onGenerate={generateStrategy}
                    isGenerating={isGenerating}
                    readiness={readiness}
                    opportunityScore={opportunityScore}
                    inferredContext={inferredContext}
                    generationMeta={generationMeta}
                    versions={versions}
                    componentPromptCount={Object.values(componentPromptPacks).reduce((total, pack) => total + pack.prompts.length, 0)}
                    onAnalyze={analyzeProduct}
                    onSaveDraft={saveDraft}
                    onExportMarkdown={() => download("pod-creative-pack.md", markdown, "text/markdown")}
                  />
                </section>

            {isGenerating || analysis ? (
            <section ref={outputRef} className="min-w-0 scroll-mt-24 rounded-xl border border-border bg-white shadow-[0_1px_0_rgba(0,0,0,0.04)]">
              <div className="overflow-x-auto border-b border-border p-3">
                <div className="flex min-w-max items-center gap-1">
                  {visibleTabs.map((tab) => (
                    <button
                      type="button"
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={cx(
                        "focus-ring rounded-lg px-3 py-2 text-sm font-semibold",
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
                      className="focus-ring ml-2 h-10 rounded-lg border border-border bg-white px-3 text-sm font-medium text-secondary"
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
                  <EmptyState onGenerate={generateStrategy} onUseSample={useSampleBrief} onDemo={startDemoWorkflow} isGenerating={isGenerating} />
                ) : (
                  <>
                    <div className="mb-5 rounded-xl border border-border bg-surface-muted p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <h2 className="text-lg font-semibold">{project.productTitle || project.name || "Generated creative pack"}</h2>
                          <p className="mt-1 text-sm text-secondary">Review analysis, selected concepts, prompts, Shopify copy, ads, and export packages.</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <span className="rounded-full bg-[#eaf4ff] px-3 py-1 text-xs font-semibold text-[#005bd3]">{normalizeProject(project).normalizedProductType}</span>
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-secondary">{project.buyerPersona || "Buyer not set"}</span>
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-secondary">{project.occasion || "Occasion not set"}</span>
                          <span className={cx("rounded-full px-3 py-1 text-xs font-semibold", generationMeta?.fallbackUsed ? "bg-[#fff4ce] text-[#8a6116]" : "bg-[#e3f1df] text-[#108043]")}>
                            {generationMeta?.fallbackUsed ? "Local fallback used" : "Generated with Groq"}
                          </span>
                        </div>
                      </div>
                    </div>
                    {generationError ? (
                      <div className="mb-5 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-warning">
                        API generation failed, so a local fallback was used. {generationError}
                      </div>
                    ) : null}
                    {strategySource ? (
                      <p className="mb-4 text-xs font-medium uppercase tracking-[0.06em] text-secondary">Generated via {strategySource}</p>
                    ) : null}
                    <VersionHistoryPanel versions={versions} activeVersionId={activeVersionId} onRestore={restoreVersion} />
                    {displayedActiveTab === "Snapshot" && <SnapshotTab project={project} analysis={analysis} opportunityScore={opportunityScore} decomposition={productDecomposition} onCopied={showCopied} />}
                    {displayedActiveTab === "Decomposition" && <DecompositionTab decomposition={productDecomposition} onCopied={showCopied} />}
                    {displayedActiveTab === "Personalization Map" && <PersonalizationMapTab decomposition={productDecomposition} onCopied={showCopied} />}
                    {displayedActiveTab === "Asset Plan" && (
                      <ComponentAssetPlanTab
                        decomposition={productDecomposition}
                        workflow={componentAssetWorkflow}
                        onStatusChange={updateComponentAssetStatus}
                        onUpload={uploadComponentAsset}
                        onCopied={showCopied}
                      />
                    )}
                    {displayedActiveTab === "Material Notes" && <MaterialNotesTab decomposition={productDecomposition} onCopied={showCopied} />}
                    {displayedActiveTab === "Ad Matrix" && <AdMatrixTab rows={adMatrixRows} onCopied={showCopied} onDownload={download} />}
                    {displayedActiveTab === "Copy" && (
                      <CopyOutcomeTab selectedConcepts={selectedConcepts} copyPacks={copyPacks} flags={outputFlags} onCopied={showCopied} />
                    )}
                    {displayedActiveTab === "Artwork Assets" && (
                      <ArtworkAssetsTab
                        project={project}
                        selectedConcepts={selectedConcepts}
                        artworkAssets={artworkAssets}
                        onStatusChange={updateArtworkAssetStatus}
                        onUpload={uploadArtworkAsset}
                        onCopied={showCopied}
                        onDownload={download}
                      />
                    )}
                    {displayedActiveTab === "Teeinblue Package" && (
                      <TeeinbluePackageTab
                        project={project}
                        selectedConcepts={selectedConcepts}
                        artworkAssets={artworkAssets}
                        decomposition={productDecomposition}
                        workflow={componentAssetWorkflow}
                        draftId={currentDraftId}
                        onDownload={download}
                        onExportZip={exportTeeinblueZip}
                        onSyncPackage={syncTeeinbluePackages}
                      />
                    )}
                    {displayedActiveTab === "Component Prompts" && (
                      <ComponentPromptsTab
                        selectedConcepts={selectedConcepts}
                        componentPromptPacks={componentPromptPacks}
                        analysis={analysis}
                        onCopied={showCopied}
                        onDownload={download}
                      />
                    )}
                    {displayedActiveTab === "Export" && (
                      <ExportTab
                        markdown={markdown}
                        jsonValue={jsonExportValue}
                        productDecomposition={productDecomposition}
                        componentAssetWorkflow={componentAssetWorkflow}
                        assetPlans={assetPlans}
                        artworkAssets={artworkAssets}
                        componentPromptPacks={componentPromptPacks}
                        copyPacks={copyPacks}
                        selectedConcepts={selectedConcepts}
                        opportunityScore={opportunityScore}
                        creativeAngleGroups={creativeAngleGroups}
                        adMatrixRows={adMatrixRows}
                        analysis={analysis}
                        generationMeta={generationMeta}
                        versions={versions}
                        exportRecords={exportRecords}
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
            ) : null}
              </>
            )}
          </div>
        </section>
      </div>
      {toast ? <div className="fixed bottom-5 right-5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white shadow-soft">{toast}</div> : null}
    </main>
  );
}

function DashboardView({
  drafts,
  draftSyncStatus,
  onCreate,
  onDemo,
  onOpen,
  onDuplicate,
  onArchive,
  onDelete,
}: {
  drafts: CreativeDraft[];
  draftSyncStatus: string;
  onCreate: () => void;
  onDemo: () => void;
  onOpen: (draft: CreativeDraft) => void;
  onDuplicate: (draft: CreativeDraft) => void;
  onArchive: (draftId: string) => void;
  onDelete: (draftId: string) => void;
}) {
  const [draftSearch, setDraftSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [productFilter, setProductFilter] = useState("");
  const [occasionFilter, setOccasionFilter] = useState("");
  const visibleDrafts = drafts.filter((draft) => draft.status !== "archived");
  const archivedDrafts = drafts.filter((draft) => draft.status === "archived");
  const generatedDrafts = visibleDrafts.filter((draft) => draft.generationMeta);
  const highOpportunityDrafts = visibleDrafts.filter((draft) => (draft.opportunityScore?.overall || 0) >= 7.5);
  const promptReadyDrafts = visibleDrafts.filter((draft) => (draft.artworkAssets?.length || 0) > 0 || draft.status === "prompt-ready" || (draft.componentPromptPacks && Object.keys(draft.componentPromptPacks).length > 0));
  const exportedDrafts = visibleDrafts.filter((draft) => draft.status === "exported");
  const assetsReadyCount = visibleDrafts.reduce((total, draft) => total + (draft.artworkAssets || []).filter((asset) => asset.status === "Uploaded" || asset.status === "Approved").length, 0);
  const teeinbluePackageCount = visibleDrafts.reduce(
    (total, draft) => total + (draft.exportRecords || []).filter((record) => record.filename.endsWith(".zip") || record.metadata?.packageType === "teeinblue").length,
    0,
  );
  const statusOptions = Array.from(new Set(visibleDrafts.map((draft) => draft.status))).sort();
  const productOptions = Array.from(new Set(visibleDrafts.map((draft) => draft.productType).filter(Boolean))).sort();
  const occasionOptions = Array.from(new Set(visibleDrafts.map((draft) => draft.occasion).filter(Boolean))).sort();
  const filteredDrafts = visibleDrafts.filter((draft) => {
    const haystack = [draft.title, draft.competitorBrand, draft.productType, draft.occasion, draft.buyerPersona].filter(Boolean).join(" ").toLowerCase();
    return (
      (!draftSearch || haystack.includes(draftSearch.toLowerCase())) &&
      (!statusFilter || draft.status === statusFilter) &&
      (!productFilter || draft.productType === productFilter) &&
      (!occasionFilter || draft.occasion === occasionFilter)
    );
  });
  const exportDraft = (draft: CreativeDraft) => {
    const blob = new Blob([JSON.stringify(draft, null, 2)], { type: "application/json" });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = `${draft.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "pod-draft"}.json`;
    link.click();
    URL.revokeObjectURL(href);
  };
  const getAssetProgress = (draft: CreativeDraft) => {
    const assets = draft.artworkAssets || [];
    const copied = assets.filter((asset) => asset.status !== "Not Started").length;
    return assets.length ? `${copied}/${assets.length} assets started` : "No asset pack";
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.06em] text-secondary">Dashboard</p>
          <h1 className="mt-2 text-[28px] font-semibold">Dashboard</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-secondary">Analyze competitor URLs, screenshots, titles, or notes, then move into Artwork Assets and a Teeinblue-ready package.</p>
          <span className="mt-3 inline-flex rounded-full border border-border bg-white px-3 py-1 text-xs font-semibold text-secondary">{draftSyncStatus}</span>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onCreate} className="focus-ring inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-white hover:bg-shade-70">
            Analyze Product
          </button>
          <button type="button" onClick={onDemo} className="focus-ring inline-flex h-9 items-center justify-center rounded-lg border border-shade-30 bg-white px-4 text-sm font-semibold text-primary hover:bg-surface-muted">
            Try Demo Workflow
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-[#cce0ff] bg-[#eaf4ff] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.06em] text-[#005bd3]">New workflow</p>
            <h2 className="mt-2 text-xl font-semibold text-primary">Competitor intake to Teeinblue package</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-secondary">Open the intake form, review inferred product context, generate the creative pack, upload external assets, then export a Teeinblue package.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={onCreate} className="focus-ring inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-white hover:bg-shade-70">Open Intake</button>
            <button type="button" onClick={onDemo} className="focus-ring inline-flex h-10 items-center rounded-lg border border-primary bg-white px-4 text-sm font-semibold text-primary hover:bg-surface-muted">Load Demo Pack</button>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-7">
        {[
          ["Recent Drafts", visibleDrafts.length],
          ["Recent Generations", generatedDrafts.length],
          ["High Opportunity", highOpportunityDrafts.length],
          ["Prompt Ready", promptReadyDrafts.length],
          ["Assets Ready", assetsReadyCount],
          ["Teeinblue Packages", teeinbluePackageCount],
          ["Exports", exportedDrafts.length],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-border bg-white p-4">
            <p className="text-xs font-medium uppercase tracking-[0.06em] text-secondary">{label}</p>
            <p className="mt-2 text-2xl font-semibold text-primary">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-white p-5 shadow-[0_1px_0_rgba(0,0,0,0.04)]">
          <h3 className="text-base font-semibold">Quick actions</h3>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <button type="button" onClick={onCreate} className="focus-ring h-9 rounded-lg bg-primary px-4 text-sm font-semibold text-white hover:bg-shade-70">Open Intake</button>
            <button type="button" onClick={onDemo} className="focus-ring h-9 rounded-lg border border-shade-30 bg-white px-4 text-sm font-semibold text-primary hover:bg-surface-muted">Demo Workflow</button>
            <button type="button" disabled className="h-9 cursor-not-allowed rounded-lg border border-border bg-surface-muted px-4 text-sm font-semibold text-secondary">Save after analysis</button>
            <button type="button" disabled className="h-9 cursor-not-allowed rounded-lg border border-border bg-surface-muted px-4 text-sm font-semibold text-secondary">Export after generation</button>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-white p-5 shadow-[0_1px_0_rgba(0,0,0,0.04)]">
          <h3 className="text-base font-semibold">Generation status</h3>
          <dl className="mt-4 space-y-3 text-sm">
            <Detail label="Recent drafts" value={`${visibleDrafts.length}`} />
            <Detail label="Generated drafts" value={`${generatedDrafts.length}`} />
            <Detail label="Export readiness" value={promptReadyDrafts.length ? "Ready" : "Draft"} />
            <Detail label="Draft storage" value={draftSyncStatus} />
          </dl>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold">Recent drafts</h2>
        <p className="mt-1 text-sm text-secondary">Open, duplicate, archive, or delete drafts. Drafts sync through the Supabase workspace when connected.</p>
      </div>

      {!visibleDrafts.length ? (
        <div className="rounded-xl border border-dashed border-border bg-white p-10 text-center">
          <h3 className="text-2xl font-medium">Start with one competitor product</h3>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-secondary">
            Paste a competitor product URL or upload a screenshot. The tool will infer product type, buyer, custom fields, ad angles, and prompt packs.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <button type="button" onClick={onCreate} className="focus-ring inline-flex h-11 items-center rounded-lg bg-primary px-5 text-sm font-medium text-white hover:bg-shade-70">
              Analyze Product
            </button>
            <button type="button" onClick={onDemo} className="focus-ring inline-flex h-11 items-center rounded-lg border border-primary bg-white px-5 text-sm font-medium text-primary hover:bg-surface-muted">
              Try Demo Workflow
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid gap-3 rounded-xl border border-border bg-white p-4 lg:grid-cols-[minmax(220px,1fr)_180px_180px_180px]">
            <label className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary" />
              <input
                value={draftSearch}
                onChange={(event) => setDraftSearch(event.target.value)}
                placeholder="Search drafts..."
                className="focus-ring h-10 w-full rounded-lg border border-border bg-white pl-9 pr-3 text-sm text-primary placeholder:text-muted"
              />
            </label>
            <select value={productFilter} onChange={(event) => setProductFilter(event.target.value)} className="focus-ring h-10 rounded-lg border border-border bg-white px-3 text-sm text-primary">
              <option value="">All products</option>
              {productOptions.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <select value={occasionFilter} onChange={(event) => setOccasionFilter(event.target.value)} className="focus-ring h-10 rounded-lg border border-border bg-white px-3 text-sm text-primary">
              <option value="">All occasions</option>
              {occasionOptions.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="focus-ring h-10 rounded-lg border border-border bg-white px-3 text-sm text-primary">
              <option value="">All statuses</option>
              {statusOptions.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>

          <div className="hidden overflow-x-auto rounded-xl border border-border lg:block">
            <table className="w-full min-w-[1100px] border-collapse bg-white text-left text-sm">
              <thead className="bg-surface-muted text-xs uppercase tracking-[0.06em] text-secondary">
                <tr>
                  {["Product Title", "Competitor", "Product Type", "Occasion", "Status", "Opportunity", "Updated", "Source", "Actions"].map((head) => (
                    <th key={head} className="px-4 py-3 font-medium">{head}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredDrafts.map((draft) => (
                  <tr key={draft.id} className="border-t border-border align-top">
                    <td className="max-w-[280px] px-4 py-3 font-semibold text-primary">{draft.title}</td>
                    <td className="px-4 py-3 text-secondary">{draft.competitorBrand || "Not set"}</td>
                    <td className="px-4 py-3 text-secondary">{draft.productType || "Not set"}</td>
                    <td className="px-4 py-3 text-secondary">{draft.occasion || "Not set"}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full border border-black/10 bg-accent px-3 py-1 text-xs font-medium capitalize">{draft.status}</span>
                    </td>
                    <td className="px-4 py-3 text-secondary">{draft.opportunityScore ? `${draft.opportunityScore.overall}/10` : "Not scored"}</td>
                    <td className="px-4 py-3 text-secondary">
                      <div>{formatDate(draft.updatedAt)}</div>
                      <div className="mt-1 text-xs">{getAssetProgress(draft)}</div>
                    </td>
                    <td className="px-4 py-3 text-secondary" title={getSourceHelp(draft.generationMeta)}>{getSourceLabel(draft.generationMeta)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => onOpen(draft)} className="focus-ring h-8 rounded-lg bg-primary px-3 text-xs font-medium text-white hover:bg-shade-70">Open</button>
                        <button type="button" onClick={() => onDuplicate(draft)} className="focus-ring h-8 rounded-lg border border-primary bg-white px-3 text-xs font-medium text-primary hover:bg-surface-muted">Duplicate</button>
                        <button type="button" onClick={() => exportDraft(draft)} className="focus-ring h-8 rounded-lg border border-primary bg-white px-3 text-xs font-medium text-primary hover:bg-surface-muted">Export</button>
                        <button type="button" onClick={() => onArchive(draft.id)} className="focus-ring h-8 rounded-lg border border-border bg-white px-3 text-xs font-medium text-secondary hover:bg-surface-muted">Archive</button>
                        <button type="button" onClick={() => onDelete(draft.id)} className="focus-ring h-8 rounded-lg border border-border bg-white px-3 text-xs font-medium text-danger hover:bg-red-50">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-4 lg:hidden">
            {filteredDrafts.map((draft) => (
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
                  <Detail label="Occasion" value={draft.occasion || "Not set"} />
                  <Detail label="Opportunity" value={draft.opportunityScore ? `${draft.opportunityScore.overall}/10` : "Not scored"} />
                  <Detail label="Artwork assets" value={getAssetProgress(draft)} />
                  <Detail label="Source" value={getSourceLabel(draft.generationMeta)} />
                  <Detail label="Updated" value={formatDate(draft.updatedAt)} />
                </dl>
                <div className="mt-5 flex flex-wrap gap-2">
                  <button type="button" onClick={() => onOpen(draft)} className="focus-ring inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-white hover:bg-shade-70">Open</button>
                  <button type="button" onClick={() => onDuplicate(draft)} className="focus-ring inline-flex h-10 items-center rounded-lg border border-primary bg-white px-4 text-sm font-medium text-primary hover:bg-surface-muted">Duplicate</button>
                  <button type="button" onClick={() => exportDraft(draft)} className="focus-ring inline-flex h-10 items-center rounded-lg border border-primary bg-white px-4 text-sm font-medium text-primary hover:bg-surface-muted">Export</button>
                  <button type="button" onClick={() => onArchive(draft.id)} className="focus-ring inline-flex h-10 items-center rounded-lg border border-border bg-white px-4 text-sm font-medium text-secondary hover:bg-surface-muted">Archive</button>
                  <button type="button" onClick={() => onDelete(draft.id)} className="focus-ring inline-flex h-10 items-center rounded-lg border border-border bg-white px-4 text-sm font-medium text-danger hover:bg-red-50">Delete</button>
                </div>
              </article>
            ))}
          </div>

          {!filteredDrafts.length ? (
            <div className="rounded-xl border border-dashed border-border bg-white p-8 text-center">
              <h3 className="text-lg font-semibold">No drafts match these filters.</h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-secondary">Clear the filters to get back to your full workspace, or analyze a new competitor product.</p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setDraftSearch("");
                    setProductFilter("");
                    setOccasionFilter("");
                    setStatusFilter("");
                  }}
                  className="focus-ring inline-flex h-10 items-center rounded-lg border border-primary bg-white px-4 text-sm font-medium text-primary hover:bg-surface-muted"
                >
                  Clear filters
                </button>
                <button type="button" onClick={onCreate} className="focus-ring inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-white hover:bg-shade-70">
                  Analyze Product
                </button>
              </div>
            </div>
          ) : null}
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
  health: { groqConfigured: boolean; supabaseConfigured: boolean; imageProvider: string; imageProviderConfigured: boolean; appVersion: string } | null;
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
        <button type="button" onClick={onRefresh} className="focus-ring inline-flex h-11 items-center rounded-lg border border-primary bg-white px-5 text-sm font-medium text-primary hover:bg-surface-muted">
          Refresh status
        </button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <InfoCard title="Groq strategy generation" value={health ? (health.groqConfigured ? "Connected" : "Missing") : "Not checked"} />
        <InfoCard title="Supabase workspace" value={health ? (health.supabaseConfigured ? "Connected" : "Missing env") : "Not checked"} />
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
  onAnalyze,
  onGenerate,
  onSaveDraft,
  onClearDraft,
  isGenerating,
  clearNeedsConfirm,
  inferredContext,
}: {
  project: Project;
  screenshot: ScreenshotState | null;
  updateProject: <K extends keyof Project>(key: K, value: Project[K]) => void;
  updateScreenshot: (screenshot: ScreenshotState | null) => void;
  onAnalyze: () => void;
  onGenerate: () => void;
  onSaveDraft: () => void;
  onClearDraft: () => void;
  isGenerating: boolean;
  clearNeedsConfirm: boolean;
  inferredContext: InferredProjectContext | null;
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
      <FormSection title="1. Competitor Signal" helper="Paste one strong signal. URL, screenshot, title, or notes is enough to analyze the product.">
        <div className="space-y-2">
          <FieldLabel>Competitor product URL</FieldLabel>
          <TextInput value={project.competitorUrl || ""} onChange={(value) => updateProject("competitorUrl", value)} placeholder="https://..." />
        </div>
        <div className="space-y-2">
          <FieldLabel>Product title optional</FieldLabel>
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
                  <button type="button" onClick={() => updateScreenshot(null)} className="focus-ring inline-flex h-8 items-center gap-1 rounded-lg border border-border bg-white px-3 font-semibold text-primary">
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
        <div className="flex flex-wrap justify-end gap-3">
          <button type="button" onClick={onAnalyze} className="focus-ring inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-medium text-white hover:bg-shade-70">
            <Search size={17} />
            Analyze Product
          </button>
        </div>
      </FormSection>

      {inferredContext ? (
        <FormSection title="2. Quick review" helper="We suggested the basics from your competitor signal. Edit only what looks wrong. You can generate now and refine later.">
          {inferredContext.confidence < 65 ? (
            <div className="rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-sm leading-6 text-warning">
              This suggestion may be off. Add product notes or edit the fields below before generating.
            </div>
          ) : null}
          <div className="grid gap-3 md:grid-cols-4">
            <CompactField label="Product type">
              <SelectField value={project.productType || ""} options={["", ...PRODUCT_TYPES]} onChange={(value) => updateProject("productType", value)} />
            </CompactField>
            <CompactField label="Buyer">
              <SelectField value={project.buyerPersona || ""} options={["", ...BUYER_PERSONAS]} onChange={(value) => updateProject("buyerPersona", value)} />
            </CompactField>
            <CompactField label="Occasion">
              <SelectField value={project.occasion || ""} options={["", ...OCCASIONS]} onChange={(value) => updateProject("occasion", value)} />
            </CompactField>
            <CompactField label="Niche">
              <TextInput value={project.niche || ""} onChange={(value) => updateProject("niche", value)} placeholder="Personalized pet gifts" />
            </CompactField>
          </div>
          {project.productType === "Other" ? (
            <CompactField label="Specify product type">
              <TextInput
                value={project.customProductType || ""}
                onChange={(value) => updateProject("customProductType", value)}
                placeholder="Example: Squishy Acrylic Fridge Magnet"
              />
            </CompactField>
          ) : null}
          <details className="rounded-xl border border-border bg-surface-muted p-4">
            <summary className="cursor-pointer text-sm font-semibold text-primary">More inferred details</summary>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <Detail label="Visual style" value={inferredContext.visualStyle} />
              <Detail label="Brand voice" value={inferredContext.brandVoice.join(", ")} />
              <Detail label="Core emotion" value={inferredContext.coreEmotion} />
              <Detail label="Visual mechanism" value={inferredContext.visualMechanism} />
              <Detail label="Likely purchase reason" value={inferredContext.likelyPurchaseReason} />
              <Detail label="Copy risk" value={inferredContext.copyRisk} />
              <Detail label="Custom fields" value={inferredContext.customFields.join(", ")} />
              <Detail label="Suggestion source" value={getInferenceSignalLabel(inferredContext)} />
            </div>
          </details>
          <div className="flex flex-wrap justify-end gap-3">
            <button type="button" onClick={onGenerate} disabled={isGenerating} className="focus-ring inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-medium text-white hover:bg-shade-70 disabled:cursor-not-allowed disabled:opacity-70">
              <Sparkles size={17} className={isGenerating ? "animate-pulse" : ""} />
              {isGenerating ? "Generating..." : "Generate Creative Pack"}
            </button>
          </div>
        </FormSection>
      ) : null}

      <details className="rounded-xl border border-border bg-white p-5 md:p-6">
        <summary className="cursor-pointer text-xl font-medium text-primary">Advanced creative controls</summary>
        <div className="mt-4 grid gap-5">
        <div className="space-y-2">
          <FieldLabel>Competitor brand/store</FieldLabel>
          <TextInput value={project.competitorBrand || ""} onChange={(value) => updateProject("competitorBrand", value)} placeholder="PawfectHouse, Etsy shop, Amazon seller" />
        </div>
        <div className="space-y-2">
          <FieldLabel>Price range</FieldLabel>
          <TextInput value={project.priceRange || ""} onChange={(value) => updateProject("priceRange", value)} placeholder="$19-$39" />
        </div>
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
        <div className="space-y-2">
          <FieldLabel>Output goals</FieldLabel>
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
        </div>
        </div>
      </details>

      <div className="flex flex-wrap justify-end gap-3">
        <button type="button" onClick={onClearDraft} className="focus-ring inline-flex h-11 items-center gap-2 rounded-lg border border-primary bg-white px-5 text-sm font-medium text-primary hover:bg-surface-muted">
          {clearNeedsConfirm ? "Confirm clear?" : "Clear Draft"}
        </button>
        <button type="button" onClick={onSaveDraft} className="focus-ring inline-flex h-11 items-center gap-2 rounded-lg border border-primary bg-white px-5 text-sm font-medium text-primary hover:bg-surface-muted">
          <Check size={17} />
          Save Draft
        </button>
        <button type="button" onClick={onGenerate} disabled={isGenerating || !inferredContext} className="focus-ring inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-medium text-white hover:bg-shade-70 disabled:cursor-not-allowed disabled:opacity-70">
          <Sparkles size={17} className={isGenerating ? "animate-pulse" : ""} />
          {isGenerating ? "Generating..." : "Generate Creative Pack"}
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

function CompactField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block rounded-xl border border-border bg-surface-muted p-3">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.06em] text-secondary">{label}</span>
      {children}
    </label>
  );
}

function getInferenceSignalLabel(inferredContext: InferredProjectContext) {
  const source = inferredContext.inferredFrom.join(", ");
  if (inferredContext.confidence < 65) return "Low signal - add product notes for better results";
  if (!inferredContext.inferredFrom.length || inferredContext.inferredFrom.includes("Fallback rules")) return "Suggested context may need review";
  return `Suggested from ${source.toLowerCase()}`;
}

function BriefSummary({
  project,
  screenshot,
  analysis,
  selectedCount,
  onGenerate,
  isGenerating,
  readiness,
  opportunityScore,
  inferredContext,
  generationMeta,
  versions,
  componentPromptCount,
  onAnalyze,
  onSaveDraft,
  onExportMarkdown,
}: {
  project: Project;
  screenshot: ScreenshotState | null;
  analysis: Analysis | null;
  selectedCount: number;
  onGenerate: () => void;
  isGenerating: boolean;
  readiness: ReadinessResult;
  opportunityScore: OpportunityScore;
  inferredContext: InferredProjectContext | null;
  generationMeta?: GenerationMeta;
  versions: GenerationVersion[];
  componentPromptCount: number;
  onAnalyze: () => void;
  onSaveDraft: () => void;
  onExportMarkdown: () => void;
}) {
  const hasCompetitorSignal = Boolean(project.competitorUrl || project.productTitle);
  const hasNotes = Boolean(project.productDescription || project.userNotes);
  const sourceLabel = inferredContext ? getInferenceSignalLabel(inferredContext) : "";

  return (
    <aside className="h-fit space-y-4 xl:sticky xl:top-24">
      <div className="rounded-xl border border-border bg-white p-5">
        {!inferredContext ? (
          <div>
            <h3 className="text-lg font-semibold">Brief status</h3>
            <dl className="mt-4 grid gap-3 text-sm">
              <Detail label="Competitor signal" value={hasCompetitorSignal ? "Added" : "Missing"} />
              <Detail label="Notes" value={hasNotes ? "Added" : "Missing"} />
              <Detail label="Screenshot" value={screenshot ? "Added" : "Optional"} />
            </dl>
            {readiness.missing.length ? (
              <p className="mt-4 text-xs leading-5 text-secondary">Add one strong signal, then analyze. Extra details can wait.</p>
            ) : null}
            <button type="button" onClick={onAnalyze} className="focus-ring mt-5 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-white hover:bg-shade-70">
              <Search size={16} />
              Analyze Product
            </button>
          </div>
        ) : analysis ? (
          <div>
            <h3 className="text-lg font-semibold">Creative pack</h3>
            <dl className="mt-4 grid gap-3 text-sm">
              <Detail label="Generated with" value={getSourceLabel(generationMeta)} />
              <Detail label="Concepts" value={`${selectedCount} selected`} />
              <Detail label="Component prompts" value={`${componentPromptCount}`} />
              <Detail label="Export" value="Ready" />
            </dl>
            <div className="mt-4 grid gap-2">
              <button type="button" onClick={onExportMarkdown} className="focus-ring h-10 rounded-lg bg-primary px-3 text-sm font-medium text-white hover:bg-shade-70">
                Export Pack
              </button>
              <button type="button" onClick={onSaveDraft} className="focus-ring h-9 rounded-lg border border-primary bg-white px-3 text-sm font-medium text-primary hover:bg-surface-muted">
                Save Draft
              </button>
            </div>
          </div>
        ) : (
          <div>
            <h3 className="text-lg font-semibold">Ready to generate</h3>
            <dl className="mt-4 grid gap-3 text-sm">
              <Detail label="Product" value={project.productType || inferredContext.normalizedProductType} />
              <Detail label="Context" value={`${project.buyerPersona || inferredContext.buyerPersona} / ${project.occasion || inferredContext.occasion[0]}`} />
              <Detail label="Source" value={sourceLabel} />
            </dl>
            <button type="button" onClick={onGenerate} disabled={isGenerating} className="focus-ring mt-5 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-white hover:bg-shade-70 disabled:cursor-not-allowed disabled:opacity-70">
              <RefreshCw size={16} className={isGenerating ? "animate-spin" : ""} />
              {isGenerating ? "Generating..." : "Generate Creative Pack"}
            </button>
            <button
              type="button"
              onClick={() => document.getElementById("product-brief")?.scrollIntoView({ behavior: "smooth", block: "start" })}
              className="focus-ring mt-2 h-9 w-full rounded-lg border border-primary bg-white px-3 text-sm font-medium text-primary hover:bg-surface-muted"
            >
              Edit review
            </button>
          </div>
        )}
      </div>
      {analysis ? (
        <div className="rounded-xl border border-border bg-white p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-secondary">Opportunity score</p>
              <p className="mt-1 text-3xl font-semibold">{opportunityScore.overall}/10</p>
            </div>
            <span className={cx("rounded-full px-3 py-1 text-xs font-semibold", opportunityScore.overall >= 7.5 ? "bg-accent text-success" : "bg-amber-50 text-warning")}>
              {opportunityScore.overall >= 7.5 ? "Strong" : "Review"}
            </span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-secondary">
            <span className="rounded-lg bg-surface-muted px-3 py-2">Custom {opportunityScore.customDepth}/10</span>
            <span className="rounded-lg bg-surface-muted px-3 py-2">Ads {opportunityScore.adCreativePotential}/10</span>
            <span className="rounded-lg bg-surface-muted px-3 py-2">Gift {opportunityScore.giftability}/10</span>
            <span className="rounded-lg bg-surface-muted px-3 py-2">Risk {opportunityScore.copycatRisk}/10</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <ScoreBadge label="Custom" value={analysis.scores.customDepth} />
            <ScoreBadge label="Ads" value={analysis.scores.adsPotential} />
          </div>
        </div>
        ) : null}
      {versions.length ? (
        <div className="rounded-xl border border-border bg-white p-5">
          <p className="text-sm font-medium text-secondary">Workspace</p>
          <dl className="mt-3 grid gap-2 text-sm">
            <Detail label="Versions" value={`${versions.length}`} />
            <Detail label="Last source" value={getSourceLabel(generationMeta)} />
          </dl>
        </div>
      ) : null}
    </aside>
  );
}

function EmptyState({ onGenerate, onUseSample, onDemo, isGenerating }: { onGenerate: () => void; onUseSample: () => void; onDemo: () => void; isGenerating: boolean }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-surface-muted px-5 py-12 text-center md:px-8">
      <p className="text-xs font-medium uppercase tracking-[0.06em] text-secondary">Creative Pack</p>
      <Sparkles className="mx-auto mt-4 text-primary" size={30} />
      <h3 className="mt-4 text-2xl font-medium">Your creative pack will appear here</h3>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-secondary">
        Add a competitor product and generate a strategy pack to review concepts, artwork assets, Teeinblue package exports, Shopify copy, and ads.
      </p>
      <div className="mx-auto mt-6 grid max-w-3xl gap-3 md:grid-cols-3">
        {["Competitor intake", "Artwork asset slots", "Teeinblue package"].map((item) => (
          <div key={item} className="rounded-xl border border-border bg-white px-4 py-4 text-sm font-medium text-primary">
            {item}
          </div>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <button type="button" onClick={onUseSample} className="focus-ring inline-flex h-9 items-center rounded-lg border border-shade-30 bg-white px-4 text-sm font-semibold text-primary hover:bg-surface-muted">
          Use sample intake
        </button>
        <button type="button" onClick={onDemo} className="focus-ring inline-flex h-9 items-center rounded-lg border border-primary bg-white px-4 text-sm font-semibold text-primary hover:bg-surface-muted">
          Load demo workflow
        </button>
        <button type="button" onClick={onGenerate} disabled={isGenerating} className="focus-ring inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white hover:bg-shade-70 disabled:cursor-not-allowed disabled:opacity-70">
          <Sparkles size={16} className={isGenerating ? "animate-pulse" : ""} />
          {isGenerating ? "Generating..." : "Generate Strategy"}
        </button>
      </div>
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
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary text-white">
          <Sparkles size={18} className="animate-pulse" />
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.06em] text-secondary">Generating</p>
          <h3 className="text-2xl font-medium">Building your creative pack.</h3>
        </div>
      </div>
      <div className="mt-6 grid gap-3">
        {steps.map((step, index) => (
          <div key={step} className="flex items-center gap-3 rounded-lg border border-border bg-white px-4 py-3 text-sm font-medium text-primary">
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

function SnapshotTab({
  project,
  analysis,
  opportunityScore,
  decomposition,
  onCopied,
}: {
  project: Project;
  analysis: Analysis;
  opportunityScore: OpportunityScore;
  decomposition: ProductDecomposition;
  onCopied: () => void;
}) {
  const normalized = normalizeProject(project);
  const requiredAssets = decomposition.componentAssetPlan.filter((asset) => asset.required).length;
  const highRiskComponents = decomposition.designComponents.filter((component) => component.copyRisk === "High").length;
  const snapshot = {
    productType: normalized.normalizedProductType,
    buyer: project.buyerPersona || analysis.productBreakdown.coreBuyer,
    occasion: project.occasion || analysis.productBreakdown.coreOccasion,
    coreMechanism: analysis.productBreakdown.visualMechanism,
    opportunityScore: opportunityScore.overall,
    assetComplexity: `${requiredAssets} required assets`,
    copyRisk: decomposition.safeTransformationPlan.copyRisk,
  };

  return (
    <div className="space-y-6">
      <TabIntro
        eyebrow="Snapshot"
        title="Build-ready product snapshot"
        description="Start here before generating assets. This summarizes the product mechanism, buyer, risk, and required component workload."
        action={<CopyButton value={JSON.stringify(snapshot, null, 2)} onCopied={onCopied} label="Copy snapshot" />}
      />
      <div className="grid gap-3 md:grid-cols-4">
        <InfoCard title="Product Type" value={snapshot.productType} />
        <InfoCard title="Buyer" value={snapshot.buyer} />
        <InfoCard title="Occasion" value={snapshot.occasion} />
        <InfoCard title="Opportunity" value={`${opportunityScore.overall}/10`} />
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-xl border border-border bg-white p-5">
          <h3 className="text-lg font-semibold">Core mechanism</h3>
          <p className="mt-2 text-sm leading-6 text-secondary">{analysis.productBreakdown.visualMechanism}</p>
          <div className="mt-4 grid gap-2 text-sm">
            <Detail label="Personalization logic" value={analysis.productBreakdown.personalizationLogic} />
            <Detail label="Likely purchase reason" value={analysis.productBreakdown.likelyPurchaseReason} />
          </div>
        </div>
        <div className="rounded-xl border border-border bg-white p-5">
          <h3 className="text-lg font-semibold">Design workload</h3>
          <dl className="mt-4 grid gap-3 text-sm">
            <Detail label="Components" value={`${decomposition.designComponents.length}`} />
            <Detail label="Required assets" value={`${requiredAssets}`} />
            <Detail label="High-risk components" value={`${highRiskComponents}`} />
            <Detail label="Copy risk" value={decomposition.safeTransformationPlan.copyRisk} />
          </dl>
        </div>
      </div>
    </div>
  );
}

function componentGroupLabel(component: DesignComponent) {
  if (component.role === "customer_input") return "Customer Inputs";
  if (component.role === "ai_generated_asset" || component.componentType === "clipart" || component.componentType === "character_body") return "Generated Artwork";
  if (component.componentType.includes("text") || component.componentType === "typography" || component.componentType === "badge") return "Text / Typography";
  if (component.role === "product_material" || component.role === "production_layer" || component.componentType === "product_base" || component.componentType === "material_effect" || component.componentType === "print_area") return "Material / Product Structure";
  if (component.role === "mockup_scene" || component.componentType === "mockup_context") return "Mockup / Context";
  return "Decorative / Options";
}

function DecompositionTab({ decomposition, onCopied }: { decomposition: ProductDecomposition; onCopied: () => void }) {
  const groups = ["Customer Inputs", "Generated Artwork", "Text / Typography", "Material / Product Structure", "Mockup / Context", "Decorative / Options"];
  return (
    <div className="space-y-6">
      <TabIntro
        eyebrow="Decomposition"
        title="Competitor design decomposition"
        description="Break the competitor mechanism into buildable components, then decide what to keep as mechanism and what to change for originality."
        action={<CopyButton value={JSON.stringify(decomposition.designComponents, null, 2)} onCopied={onCopied} label="Copy components" />}
      />
      {groups.map((group) => {
        const components = decomposition.designComponents.filter((component) => componentGroupLabel(component) === group);
        if (!components.length) return null;
        return (
          <section key={group} className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-secondary">{group}</h3>
            <div className="grid gap-3 lg:grid-cols-2">
              {components.map((component) => (
                <article key={component.id} className="rounded-xl border border-border bg-white p-4">
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-semibold text-secondary">{component.componentType.replaceAll("_", " ")}</span>
                    <span className="rounded-full bg-[#eaf4ff] px-3 py-1 text-xs font-semibold text-[#005bd3]">{component.role.replaceAll("_", " ")}</span>
                    <span className={cx("rounded-full px-3 py-1 text-xs font-semibold", component.copyRisk === "High" ? "bg-amber-50 text-warning" : "bg-[#e3f1df] text-[#108043]")}>{component.copyRisk} risk</span>
                  </div>
                  <h4 className="mt-3 font-semibold text-primary">{component.name}</h4>
                  <p className="mt-2 text-sm leading-6 text-secondary">{component.description}</p>
                  <dl className="mt-3 grid gap-2 text-xs text-secondary">
                    <Detail label="Competitor source" value={component.sourceFromCompetitor} />
                    <Detail label="Replace with" value={component.suggestedReplacement || "Keep mechanism, change expression and styling."} />
                    <Detail label="Teeinblue layer" value={component.teeinblueLayerSuggestion || "Not mapped"} />
                  </dl>
                  {component.generationPrompt ? <p className="mt-3 rounded-lg bg-surface-muted p-3 font-mono text-xs leading-5 text-secondary">{component.generationPrompt}</p> : null}
                </article>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function PersonalizationMapTab({ decomposition, onCopied }: { decomposition: ProductDecomposition; onCopied: () => void }) {
  return (
    <div className="space-y-6">
      <TabIntro
        eyebrow="Personalization Map"
        title="Customer inputs and production mapping"
        description="Shows what customers upload, type, or choose, and which production layer each field controls."
        action={<CopyButton value={JSON.stringify(decomposition.personalizationMap, null, 2)} onCopied={onCopied} label="Copy map" />}
      />
      <div className="grid gap-3">
        {decomposition.personalizationMap.map((item) => (
          <article key={item.id} className="grid gap-3 rounded-xl border border-border bg-white p-4 lg:grid-cols-[1fr_180px_140px_1.4fr] lg:items-center">
            <div>
              <h3 className="font-semibold text-primary">{item.customerFacingLabel}</h3>
              <p className="mt-1 text-sm text-secondary">{item.label}</p>
            </div>
            <span className="rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm text-secondary">{item.inputType.replaceAll("_", " ")}</span>
            <span className={cx("rounded-lg px-3 py-2 text-sm font-semibold", item.required ? "bg-[#e3f1df] text-[#108043]" : "bg-surface-muted text-secondary")}>{item.required ? "Required" : "Optional"}</span>
            <div className="text-sm text-secondary">
              <p>{item.productionNote}</p>
              <p className="mt-1 text-xs">Examples: {item.examples.join(", ")}</p>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function ComponentAssetPlanTab({
  decomposition,
  workflow,
  onStatusChange,
  onUpload,
  onCopied,
}: {
  decomposition: ProductDecomposition;
  workflow: ComponentAssetWorkflowState;
  onStatusChange: (assetId: string, status: ComponentAssetPlan["status"]) => void;
  onUpload: (assetId: string, file: File) => void;
  onCopied: () => void;
}) {
  const groups: ComponentAssetPlan["priority"][] = ["Must Have", "Should Have", "Optional"];
  return (
    <div className="space-y-6">
      <TabIntro
        eyebrow="Asset Plan"
        title="Component asset checklist"
        description="Generate or prepare these assets one by one before assembling the final design."
        action={<CopyButton value={JSON.stringify(decomposition.componentAssetPlan, null, 2)} onCopied={onCopied} label="Copy asset plan" />}
      />
      <ComponentLayerPreview decomposition={decomposition} workflow={workflow} />
      {groups.map((group) => {
        const assets = decomposition.componentAssetPlan.filter((asset) => asset.priority === group);
        if (!assets.length) return null;
        return (
          <section key={group} className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-secondary">{group}</h3>
            <div className="grid gap-3">
              {assets.map((asset) => (
                <article key={asset.id} className="rounded-xl border border-border bg-white p-4">
                  {(() => {
                    const uploaded = workflow[asset.id];
                    return uploaded?.uploadedAssetUrl ? (
                      <div className="mb-3 rounded-lg border border-border bg-surface-muted p-3">
                        <div className="flex items-center gap-3">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={uploaded.uploadedAssetUrl} alt={`${asset.assetName} uploaded preview`} className="h-16 w-16 rounded-md border border-border bg-white object-cover" />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-primary">{uploaded.uploadedAssetName || "Uploaded component asset"}</p>
                            <p className="text-xs text-secondary">{uploaded.uploadedAssetSource === "supabase-storage" ? "Stored in Supabase Storage." : "Local component preview."}</p>
                          </div>
                        </div>
                      </div>
                    ) : null;
                  })()}
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full bg-[#eaf4ff] px-3 py-1 text-xs font-semibold text-[#005bd3]">{asset.assetSource.replaceAll("_", " ")}</span>
                        <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-semibold text-secondary">{asset.recommendedFormat}</span>
                        <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-semibold text-secondary">{asset.recommendedTool}</span>
                      </div>
                      <h4 className="mt-3 font-semibold text-primary">{asset.assetName}</h4>
                      <p className="mt-1 text-sm leading-6 text-secondary">{asset.assetPurpose}</p>
                    </div>
                    <span className={cx("rounded-full px-3 py-1 text-xs font-semibold", asset.status === "Not Started" ? "bg-amber-50 text-warning" : "bg-[#e3f1df] text-[#108043]")}>{asset.status}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-secondary">
                    <span className="rounded-lg border border-border bg-surface-muted px-3 py-1">{asset.required ? "Required" : "Optional"}</span>
                    <span className="rounded-lg border border-border bg-surface-muted px-3 py-1">{asset.suggestedSize || "Flexible size"}</span>
                  </div>
                  <div className="mt-3 flex flex-col gap-2 md:flex-row md:items-start">
                    <p className="min-w-0 flex-1 rounded-lg bg-surface-muted p-3 font-mono text-xs leading-5 text-secondary">{asset.prompt}</p>
                    <CopyButton value={asset.prompt} onCopied={onCopied} label="Copy prompt" />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
                    <label className="focus-ring inline-flex h-8 cursor-pointer items-center rounded-lg border border-primary bg-white px-3 text-xs font-medium text-primary hover:bg-surface-muted">
                      Upload asset
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/svg+xml"
                        className="sr-only"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) onUpload(asset.id, file);
                          event.currentTarget.value = "";
                        }}
                      />
                    </label>
                    {(["Not Started", "Prompt Copied", "Generated", "Uploaded", "Approved", "Needs Revision"] as const).map((status) => (
                      <button
                        key={status}
                        type="button"
                        onClick={() => onStatusChange(asset.id, status)}
                        className={cx(
                          "focus-ring h-8 rounded-lg border px-3 text-xs font-medium",
                          asset.status === status ? "border-primary bg-primary text-white" : "border-border bg-white text-secondary hover:bg-surface-muted",
                        )}
                      >
                        {status === "Not Started" ? "Missing" : status}
                      </button>
                    ))}
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

function ComponentLayerPreview({ decomposition, workflow }: { decomposition: ProductDecomposition; workflow: ComponentAssetWorkflowState }) {
  const layerComponents = decomposition.designComponents.filter((component) => component.teeinblueLayerSuggestion || component.role !== "mockup_scene");
  const completed = decomposition.componentAssetPlan.filter((asset) => {
    const status = workflow[asset.id]?.status || asset.status;
    return status === "Uploaded" || status === "Approved" || status === "Generated";
  }).length;

  return (
    <section className="rounded-xl border border-border bg-surface-muted p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 className="text-base font-semibold text-primary">Layout plan preview</h3>
          <p className="mt-1 text-sm leading-6 text-secondary">Approximate component/layer order for Figma, Photoshop, or Teeinblue assembly. This is a planning map, not a rendered design file.</p>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-secondary">
          {completed}/{decomposition.componentAssetPlan.length} assets ready
        </span>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-[320px_1fr]">
        <div className="relative mx-auto h-[360px] w-[280px] overflow-hidden rounded-xl border border-dashed border-shade-30 bg-white">
          <div className="absolute inset-5 rounded-lg border border-dashed border-[#108043]" />
          {layerComponents.slice(0, 8).map((component, index) => {
            const isText = component.componentType.includes("text") || component.componentType === "typography" || component.componentType === "badge";
            const isMaterial = component.role === "product_material" || component.role === "production_layer";
            const top = 28 + index * 34;
            const left = isText ? 52 : isMaterial ? 28 : 44;
            const width = isText ? 176 : isMaterial ? 224 : 192;
            const height = isText ? 28 : isMaterial ? 246 - index * 8 : 58;

            return (
              <div
                key={component.id}
                className={cx(
                  "absolute grid place-items-center overflow-hidden border px-2 text-center text-[10px] font-semibold leading-tight",
                  isMaterial ? "border-amber-300 bg-amber-50/70 text-warning" : isText ? "border-[#005bd3]/40 bg-[#eaf4ff]/80 text-[#005bd3]" : "border-[#108043]/40 bg-[#e3f1df]/80 text-[#108043]",
                )}
                style={{
                  left,
                  top: isMaterial ? 70 : top,
                  width,
                  height: Math.max(24, height),
                  zIndex: index + 1,
                }}
              >
                {component.teeinblueLayerSuggestion || component.name}
              </div>
            );
          })}
        </div>
        <div className="grid gap-2">
          {layerComponents.map((component, index) => (
            <div key={component.id} className="grid gap-2 rounded-lg border border-border bg-white px-3 py-2 text-sm md:grid-cols-[40px_1fr_180px] md:items-center">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-accent text-xs font-semibold text-success">{index + 1}</span>
              <div className="min-w-0">
                <p className="truncate font-medium text-primary">{component.name}</p>
                <p className="truncate text-xs text-secondary">{component.role.replaceAll("_", " ")} · {component.componentType.replaceAll("_", " ")}</p>
              </div>
              <span className="rounded-lg border border-border bg-surface-muted px-3 py-1 text-xs font-semibold text-secondary">{component.teeinblueLayerSuggestion || "Manual layer"}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function MaterialNotesTab({ decomposition, onCopied }: { decomposition: ProductDecomposition; onCopied: () => void }) {
  return (
    <div className="space-y-6">
      <TabIntro
        eyebrow="Material Notes"
        title="Material and production cues"
        description="Use these notes to make generated assets and mockups feel physically plausible for the selected product type."
        action={<CopyButton value={decomposition.materialNotes.map((item) => `- ${item}`).join("\n")} onCopied={onCopied} label="Copy notes" />}
      />
      <div className="grid gap-3 lg:grid-cols-2">
        {decomposition.materialNotes.map((note, index) => (
          <div key={note} className="rounded-xl border border-border bg-white p-4">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-accent text-sm font-semibold text-success">{index + 1}</span>
            <p className="mt-3 text-sm leading-6 text-secondary">{note}</p>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-border bg-white p-5">
        <h3 className="text-lg font-semibold">Safe transformation plan</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <ListCard title="Keep mechanism" items={decomposition.safeTransformationPlan.keep} />
          <ListCard title="Change expression" items={decomposition.safeTransformationPlan.change} />
          <ListCard title="Avoid copying" items={decomposition.safeTransformationPlan.avoid} danger />
          <ListCard title="Originality moves" items={decomposition.safeTransformationPlan.originalityMoves} />
        </div>
      </div>
    </div>
  );
}

function CopyOutcomeTab({ selectedConcepts, copyPacks, flags, onCopied }: { selectedConcepts: Concept[]; copyPacks: Record<string, CopyPack>; flags: OutputFlags; onCopied: () => void }) {
  return (
    <div className="space-y-8">
      <ShopifyTab selectedConcepts={selectedConcepts} copyPacks={copyPacks} flags={flags} onCopied={onCopied} />
      <MetaTab selectedConcepts={selectedConcepts} copyPacks={copyPacks} flags={flags} onCopied={onCopied} />
    </div>
  );
}

function AdMatrixTab({
  rows,
  onCopied,
  onDownload,
}: {
  rows: AdMatrixRow[];
  onCopied: () => void;
  onDownload: (name: string, value: string, type: string) => void;
}) {
  const markdown = rows
    .map(
      (row) => `## ${row.angleName}
- Buyer insight: ${row.buyerInsight}
- Hook: ${row.hook}
- Visual direction: ${row.visualDirection}
- Primary text: ${row.primaryText}
- Headline: ${row.headline}
- CTA: ${row.cta}
- Asset type: ${row.recommendedAssetType}`,
    )
    .join("\n\n");
  const csv = [
    ["Angle Name", "Buyer Insight", "Hook", "Visual Direction", "Primary Text", "Headline", "CTA", "Recommended Asset Type"],
    ...rows.map((row) => [row.angleName, row.buyerInsight, row.hook, row.visualDirection, row.primaryText, row.headline, row.cta, row.recommendedAssetType]),
  ]
    .map((cols) => cols.map((col) => `"${col.replaceAll('"', '""')}"`).join(","))
    .join("\n");

  return (
    <div className="space-y-5">
      <TabIntro
        eyebrow="Ad Matrix"
        title="Meta ad content matrix"
        description="A practical grid for turning concepts and angles into Meta image, lifestyle, and UGC tests."
        action={
          <>
            <CopyButton value={markdown} onCopied={onCopied} label="Copy matrix" />
            <button type="button" onClick={() => onDownload("ad-content-matrix.csv", csv, "text/csv")} className="focus-ring inline-flex h-10 items-center gap-2 rounded-lg border border-primary bg-white px-4 text-sm font-medium text-primary hover:bg-surface-muted">
              <Download size={16} />
              Export CSV
            </button>
          </>
        }
      />
      <div className="hidden overflow-x-auto rounded-xl border border-border lg:block">
        <table className="w-full min-w-[1100px] border-collapse bg-white text-left text-sm">
          <thead className="bg-surface-muted text-xs uppercase tracking-[0.06em] text-secondary">
            <tr>
              {["Angle Name", "Buyer Insight", "Hook", "Visual Direction", "Primary Text", "Headline", "CTA", "Asset Type", "Copy"].map((head) => (
                <th key={head} className="px-4 py-3 font-medium">{head}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-border align-top">
                <td className="px-4 py-3 font-semibold">{row.angleName}</td>
                <td className="px-4 py-3 text-secondary">{row.buyerInsight}</td>
                <td className="px-4 py-3 text-primary">{row.hook}</td>
                <td className="px-4 py-3 text-secondary">{row.visualDirection}</td>
                <td className="px-4 py-3 text-secondary">{row.primaryText}</td>
                <td className="px-4 py-3 text-primary">{row.headline}</td>
                <td className="px-4 py-3">{row.cta}</td>
                <td className="px-4 py-3 text-secondary">{row.recommendedAssetType}</td>
                <td className="px-4 py-3">
                  <CopyButton value={JSON.stringify(row, null, 2)} onCopied={onCopied} label="Copy" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-3 lg:hidden">
        {rows.map((row) => (
          <article key={row.id} className="rounded-xl border border-border bg-white p-4">
            <h4 className="font-medium">{row.angleName}</h4>
            <p className="mt-2 text-sm leading-6 text-secondary">{row.buyerInsight}</p>
            <p className="mt-3 rounded-lg bg-surface-muted px-3 py-2 text-sm font-medium">{row.hook}</p>
            <dl className="mt-3 grid gap-2 text-sm">
              <Detail label="Visual" value={row.visualDirection} />
              <Detail label="Primary text" value={row.primaryText} />
              <Detail label="Headline" value={row.headline} />
              <Detail label="Asset type" value={row.recommendedAssetType} />
            </dl>
            <div className="mt-3">
              <CopyButton value={JSON.stringify(row, null, 2)} onCopied={onCopied} label="Copy row" />
            </div>
          </article>
        ))}
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

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-[0.06em] text-secondary">{label}</dt>
      <dd className="mt-1 leading-6 text-secondary">{value}</dd>
    </div>
  );
}

function formatComponentPromptMarkdown(selectedConcepts: Concept[], componentPromptPacks: Record<string, ComponentPromptPack>) {
  return selectedConcepts
    .map((concept) => {
      const pack = componentPromptPacks[concept.id];
      if (!pack) return "";
      return `# ${concept.name}

## Recommended Build Order
${pack.recommendedBuildOrder.map((step, index) => `${index + 1}. ${step}`).join("\n")}

${pack.prompts
  .map(
    (prompt) => `## ${prompt.title}
- Type: ${prompt.promptType}
- Tool: ${prompt.recommendedTool}
- Ratio: ${prompt.recommendedRatio}
- Use: ${prompt.recommendedUse}

${prompt.prompt}`,
  )
  .join("\n\n")}`;
    })
    .filter(Boolean)
    .join("\n\n");
}

function conceptBrief(concept: Concept) {
  return `Concept: ${concept.name}
Idea: ${concept.oneLineIdea}
Buyer: ${concept.buyer}
Occasion: ${concept.occasion}
Design direction: ${concept.designDirection}
Mockup direction: ${concept.mockupDirection}
Ad hook: ${concept.adHook}`;
}

function toolFormattedPrompt(tool: "ChatGPT" | "Midjourney" | "Ideogram", concept: Concept, prompt: ComponentPromptPack["prompts"][number]) {
  if (tool === "Midjourney") return `${prompt.prompt} --ar ${prompt.recommendedRatio.replace(":", ":")} --style raw`;
  if (tool === "Ideogram") return `${prompt.prompt}\n\nTypography guidance: keep any text original, readable, and print-ready. Avoid copied slogans.`;
  return `${conceptBrief(concept)}

Task: ${prompt.title}
Recommended use: ${prompt.recommendedUse}
Recommended ratio: ${prompt.recommendedRatio}

Prompt:
${prompt.prompt}`;
}

function formatChatGPTCreativeBrief(selectedConcepts: Concept[], componentPromptPacks: Record<string, ComponentPromptPack>, analysis: Analysis) {
  return selectedConcepts
    .map((concept) => {
      const pack = componentPromptPacks[concept.id];
      return `# ChatGPT Image Creative Brief

Product concept: ${concept.name}
Product type: ${analysis.productBreakdown.productType}
Selected angle: ${concept.adHook}
Buyer: ${concept.buyer}
Occasion: ${concept.occasion}
Core emotion: ${concept.emotion}
Visual direction: ${concept.designDirection}
Mockup direction: ${concept.mockupDirection}
Custom fields: ${concept.customFields.join(", ")}

No-copy rules:
${analysis.inspirationRules.doNotCopy.map((rule) => `- ${rule}`).join("\n")}

Output goal:
Create production-ready image prompts or assets for this original POD concept. Keep the product original, ecommerce-ready, and clear at small mobile-ad size.

Component prompt pack:
${pack ? pack.prompts.map((prompt) => `## ${prompt.title}
- Prompt type: ${prompt.promptType}
- Target ratio: ${prompt.recommendedRatio}
- Recommended use: ${prompt.recommendedUse}

${prompt.prompt}`).join("\n\n") : "No component prompts available."}`;
    })
    .join("\n\n---\n\n");
}

function ArtworkAssetsTab({
  project,
  selectedConcepts,
  artworkAssets,
  onStatusChange,
  onUpload,
  onCopied,
  onDownload,
}: {
  project: Project;
  selectedConcepts: Concept[];
  artworkAssets: ArtworkAsset[];
  onStatusChange: (assetId: string, status: ArtworkAsset["status"]) => void;
  onUpload: (assetId: string, file: File) => void;
  onCopied: () => void;
  onDownload: (name: string, value: string, type: string) => void;
}) {
  if (!selectedConcepts.length) return <p className="text-sm text-secondary">Select concepts to generate artwork asset packs.</p>;
  const markdown = formatArtworkAssetsMarkdown(artworkAssets);
  const json = formatArtworkAssetsJson(artworkAssets);
  const groups: ArtworkAsset["assetGroup"][] = ["Product Design Assets", "Material / Structure Assets", "Mockup Assets", "Ad Creative Assets"];
  const mustHaveCount = artworkAssets.filter((asset) => asset.priority === "Must Have").length;

  return (
    <div className="space-y-6">
      <TabIntro
        eyebrow="Artwork Assets"
        title="External design asset builder"
        description="Use these product-specific asset prompts to create artwork, mockups, ads, and UGC frames in ChatGPT, Ideogram, Midjourney, Figma, or your design workflow."
        action={
          <>
            <CopyButton value={markdown} onCopied={onCopied} label="Copy asset pack" />
            <button type="button" onClick={() => onDownload("artwork-asset-pack.md", markdown, "text/markdown")} className="focus-ring inline-flex h-10 items-center gap-2 rounded-lg border border-primary bg-white px-4 text-sm font-medium text-primary hover:bg-surface-muted">
              <Download size={16} />
              Export Markdown
            </button>
            <button type="button" onClick={() => onDownload("artwork-asset-pack.json", json, "application/json")} className="focus-ring inline-flex h-10 items-center gap-2 rounded-lg border border-primary bg-white px-4 text-sm font-medium text-primary hover:bg-surface-muted">
              <FileJson size={16} />
              Export JSON
            </button>
          </>
        }
      />
      <div className="grid gap-3 md:grid-cols-3">
        <InfoCard title="Assets planned" value={`${artworkAssets.length}`} />
        <InfoCard title="Must-have assets" value={`${mustHaveCount}`} />
        <InfoCard title="Prompt ready" value={artworkAssets.length ? "Yes" : "No"} />
      </div>
      {selectedConcepts.map((concept) => {
        const conceptAssets = artworkAssets.filter((asset) => asset.conceptId === concept.id);
        const conceptMarkdown = formatArtworkAssetsMarkdown(conceptAssets);
        return (
          <section key={concept.id} className="space-y-4 border-b border-border pb-6 last:border-b-0">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-xl font-semibold">{concept.name}</h3>
                <p className="mt-1 text-sm leading-6 text-secondary">{concept.oneLineIdea}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <CopyButton value={conceptMarkdown} onCopied={onCopied} label="Copy concept assets" />
                <button type="button" onClick={() => onDownload(`${concept.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-assets.md`, conceptMarkdown, "text/markdown")} className="focus-ring inline-flex h-9 items-center gap-2 rounded-lg border border-primary bg-white px-3 text-xs font-medium text-primary hover:bg-surface-muted">
                  <Download size={14} />
                  Export
                </button>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-surface-muted p-4">
              <p className="text-sm font-semibold text-primary">Asset build order</p>
              <ol className="mt-3 grid gap-2 md:grid-cols-2">
                {conceptAssets
                  .filter((asset) => asset.priority === "Must Have")
                  .slice(0, 6)
                  .map((asset, index) => (
                    <li key={asset.id} className="flex gap-3 rounded-lg border border-border bg-white px-3 py-2 text-sm text-secondary">
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent text-xs font-semibold text-success">{index + 1}</span>
                      <span>{asset.title}</span>
                    </li>
                  ))}
              </ol>
            </div>
            {groups.map((group) => {
              const assets = conceptAssets.filter((asset) => asset.assetGroup === group);
              if (!assets.length) return null;
              return (
                <div key={group} className="space-y-3">
                  <h4 className="text-sm font-semibold uppercase tracking-[0.08em] text-secondary">{group}</h4>
                  <div className="grid gap-3 lg:grid-cols-2">
                    {assets.map((asset) => (
                      <article key={asset.id} className="rounded-xl border border-border bg-white p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-semibold text-secondary">{asset.assetType.replaceAll("_", " ")}</span>
                          <span className="rounded-full bg-[#eaf4ff] px-3 py-1 text-xs font-semibold text-[#005bd3]">{asset.recommendedTool}</span>
                          <span className="rounded-full bg-[#e3f1df] px-3 py-1 text-xs font-semibold text-[#108043]">{asset.priority === "Must Have" ? "Required" : "Optional"}</span>
                          <span className={cx("rounded-full px-3 py-1 text-xs font-semibold", getArtworkWorkflowStatus(asset) === "Missing" ? "bg-amber-50 text-warning" : "bg-[#e3f1df] text-[#108043]")}>{getArtworkWorkflowStatus(asset)}</span>
                        </div>
                        <h5 className="mt-3 font-semibold text-primary">{asset.title}</h5>
                        <p className="mt-2 text-sm leading-6 text-secondary">{asset.purpose}</p>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-secondary">
                          <span className="rounded-lg border border-border bg-surface-muted px-3 py-1">{asset.recommendedRatio || "Flexible"}</span>
                          <span className="rounded-lg border border-border bg-surface-muted px-3 py-1">{asset.outputFormat || "Prompt only"}</span>
                          <span className="rounded-lg border border-border bg-surface-muted px-3 py-1">{getArtworkWorkflowStatus(asset)}</span>
                        </div>
                        {asset.uploadedAssetUrl ? (
                          <div className="mt-3 rounded-lg border border-border bg-surface-muted p-3">
                            <div className="flex items-center gap-3">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={asset.uploadedAssetUrl} alt={`${asset.title} uploaded preview`} className="h-16 w-16 rounded-md border border-border bg-white object-cover" />
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-primary">{asset.uploadedAssetName || "Uploaded asset"}</p>
                                <p className="text-xs text-secondary">{asset.uploadedAssetSource === "supabase-storage" ? "Stored in Supabase Storage." : "Local preview. Run the latest SQL to enable Supabase Storage."}</p>
                              </div>
                            </div>
                          </div>
                        ) : null}
                        <p className="mt-3 max-h-36 overflow-auto rounded-lg bg-surface-muted p-3 font-mono text-xs leading-5 text-secondary">{asset.prompt}</p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <CopyButton
                            value={asset.prompt}
                            onCopied={() => {
                              onStatusChange(asset.id, "Copied");
                              onCopied();
                            }}
                            label="Copy Prompt"
                          />
                          <CopyButton
                            value={formatArtworkToolBrief(project, asset)}
                            onCopied={() => {
                              onStatusChange(asset.id, "Copied");
                              onCopied();
                            }}
                            label="Copy For ChatGPT"
                          />
                          <CopyButton
                            value={`${asset.prompt}\n\n--ar ${(asset.recommendedRatio || "1:1").replace(":", ":")} --style raw`}
                            onCopied={() => {
                              onStatusChange(asset.id, "Copied");
                              onCopied();
                            }}
                            label="Copy For Midjourney"
                          />
                          <CopyButton
                            value={`${asset.prompt}\n\nTypography must be original, readable, and print-ready. Avoid copied slogans.`}
                            onCopied={() => {
                              onStatusChange(asset.id, "Copied");
                              onCopied();
                            }}
                            label="Copy For Ideogram"
                          />
                          <CopyButton
                            value={`Figma design brief\n\n${formatArtworkToolBrief(project, asset)}`}
                            onCopied={() => {
                              onStatusChange(asset.id, "Copied");
                              onCopied();
                            }}
                            label="Copy Figma Brief"
                          />
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
                          <label className="focus-ring inline-flex h-8 cursor-pointer items-center rounded-lg border border-primary bg-white px-3 text-xs font-medium text-primary hover:bg-surface-muted">
                            Upload asset
                            <input
                              type="file"
                              accept="image/png,image/jpeg,image/svg+xml"
                              className="sr-only"
                              onChange={(event) => {
                                const file = event.target.files?.[0];
                                if (file) onUpload(asset.id, file);
                                event.currentTarget.value = "";
                              }}
                            />
                          </label>
                          {[
                            ["Missing", "Not Started"],
                            ["Prompt Copied", "Copied"],
                            ["Uploaded", "Uploaded"],
                            ["Approved", "Approved"],
                            ["Needs Revision", "Needs Revision"],
                          ].map(([label, status]) => (
                            <button
                              key={status}
                              type="button"
                              onClick={() => onStatusChange(asset.id, status as ArtworkAsset["status"])}
                              className={cx(
                                "focus-ring h-8 rounded-lg border px-3 text-xs font-medium",
                                getArtworkWorkflowStatus(asset) === label ? "border-primary bg-primary text-white" : "border-border bg-white text-secondary hover:bg-surface-muted",
                              )}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}

function TeeinbluePackageTab({
  project,
  selectedConcepts,
  artworkAssets,
  decomposition,
  workflow,
  draftId,
  onDownload,
  onExportZip,
  onSyncPackage,
}: {
  project: Project;
  selectedConcepts: Concept[];
  artworkAssets: ArtworkAsset[];
  decomposition: ProductDecomposition;
  workflow: ComponentAssetWorkflowState;
  draftId?: string | null;
  onDownload: (name: string, value: string, type: string) => void;
  onExportZip: (concept: Concept) => void;
  onSyncPackage: (concept?: Concept) => void;
}) {
  if (!selectedConcepts.length) return <p className="text-sm text-secondary">Select concepts to build a Teeinblue package.</p>;

  return (
    <div className="space-y-6">
      <TabIntro
        eyebrow="Teeinblue Package"
        title="Design package planning"
        description="Turn approved artwork prompts and uploads into Teeinblue-ready slots, layout layers, manifest JSON, and a setup guide. This does not generate images or publish products."
        action={
          <button type="button" onClick={() => onSyncPackage()} className="focus-ring inline-flex h-10 items-center gap-2 rounded-lg border border-primary bg-white px-4 text-sm font-medium text-primary hover:bg-surface-muted">
            <Upload size={16} />
            Sync packages
          </button>
        }
      />
      {selectedConcepts.map((concept) => {
        const conceptAssets = artworkAssets.filter((asset) => asset.conceptId === concept.id);
        const existingIds = new Set(conceptAssets.map((asset) => asset.id));
        const componentAssets = decomposition.componentAssetPlan
          .map((asset) =>
            buildArtworkAssetFromComponentPlan({
              asset,
              concept,
              project,
              draftId,
              workflow: workflow[asset.id],
            }),
          )
          .filter((asset) => !existingIds.has(asset.id));
        const packageAssets = [...conceptAssets, ...componentAssets];
        const slots = buildAssetSlots(project, concept, packageAssets);
        const layout = buildDesignLayoutPlan(project, concept, packageAssets);
        const manifest = buildTeeinblueManifest(project, concept, packageAssets);
        const manifestJson = JSON.stringify(manifest, null, 2);
        const layoutJson = JSON.stringify(layout, null, 2);
        const setupGuide = formatTeeinblueSetupGuide(project, concept, packageAssets);
        const missingRequired = slots.filter((slot) => slot.required && slot.status === "Missing").length;
        const uploadedCount = slots.filter((slot) => slot.status === "Uploaded" || slot.status === "Approved").length;
        const componentUploadedCount = decomposition.componentAssetPlan.filter((asset) => workflow[asset.id]?.uploadedAssetUrl).length;
        const filePrefix = concept.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "teeinblue-package";

        return (
          <section key={concept.id} className="space-y-5 border-b border-border pb-6 last:border-b-0">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-xl font-semibold text-primary">{concept.name}</h3>
                  <span className="rounded-full bg-[#eaf4ff] px-3 py-1 text-xs font-semibold text-[#005bd3]">{layout.printArea.name}</span>
                  <span className={cx("rounded-full px-3 py-1 text-xs font-semibold", missingRequired ? "bg-amber-50 text-warning" : "bg-[#e3f1df] text-[#108043]")}>
                    {missingRequired ? `${missingRequired} missing required` : "Required slots ready"}
                  </span>
                </div>
                <p className="mt-1 text-sm leading-6 text-secondary">
                  Canvas {layout.canvas.width} x {layout.canvas.height}px. {uploadedCount}/{slots.length} slots have uploaded or approved assets.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => onExportZip(concept)} className="focus-ring inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-xs font-medium text-white hover:bg-shade-70">
                  <Download size={14} />
                  Export ZIP
                </button>
                <button type="button" onClick={() => onSyncPackage(concept)} className="focus-ring inline-flex h-9 items-center gap-2 rounded-lg border border-primary bg-white px-3 text-xs font-medium text-primary hover:bg-surface-muted">
                  <Upload size={14} />
                  Sync
                </button>
                <button type="button" onClick={() => onDownload(`${filePrefix}-teeinblue-manifest.json`, manifestJson, "application/json")} className="focus-ring inline-flex h-9 items-center gap-2 rounded-lg border border-primary bg-white px-3 text-xs font-medium text-primary hover:bg-surface-muted">
                  <FileJson size={14} />
                  Manifest JSON
                </button>
                <button type="button" onClick={() => onDownload(`${filePrefix}-layout-plan.json`, layoutJson, "application/json")} className="focus-ring inline-flex h-9 items-center gap-2 rounded-lg border border-primary bg-white px-3 text-xs font-medium text-primary hover:bg-surface-muted">
                  <Layers3 size={14} />
                  Layout JSON
                </button>
                <button type="button" onClick={() => onDownload(`${filePrefix}-setup-guide.md`, setupGuide, "text/markdown")} className="focus-ring inline-flex h-9 items-center gap-2 rounded-lg border border-primary bg-white px-3 text-xs font-medium text-primary hover:bg-surface-muted">
                  <Download size={14} />
                  Setup Guide
                </button>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(280px,420px)_1fr]">
              <DesignCanvasPreview layout={layout} assets={packageAssets} />
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <InfoCard title="Asset slots" value={`${slots.length}`} />
                  <InfoCard title="Uploaded / approved" value={`${uploadedCount}`} />
                  <InfoCard title="Personalization fields" value={`${manifest.personalizationFields.length}`} />
                </div>
                <div className="rounded-xl border border-border bg-white p-4">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h4 className="text-sm font-semibold uppercase tracking-[0.08em] text-secondary">Component asset workflow</h4>
                      <p className="mt-1 text-xs text-secondary">{componentUploadedCount}/{decomposition.componentAssetPlan.length} component assets have uploads.</p>
                    </div>
                    <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-medium text-secondary">Feeds Teeinblue slots</span>
                  </div>
                  <div className="mt-3 grid gap-2">
                    {decomposition.componentAssetPlan.map((asset) => {
                      const entry = workflow[asset.id];
                      return (
                        <div key={asset.id} className="grid gap-2 rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm md:grid-cols-[1fr_auto_auto] md:items-center">
                          <div className="min-w-0">
                            <p className="truncate font-medium text-primary">{asset.assetName}</p>
                            <p className="truncate text-xs text-secondary">{entry?.uploadedAssetName || asset.assetPurpose}</p>
                          </div>
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-secondary">{asset.required ? "Required" : "Optional"}</span>
                          <span className={cx("rounded-full px-3 py-1 text-xs font-semibold", entry?.status === "Uploaded" || entry?.status === "Approved" ? "bg-[#e3f1df] text-[#108043]" : "bg-amber-50 text-warning")}>
                            {entry?.status || asset.status}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-white p-4">
                  <h4 className="text-sm font-semibold uppercase tracking-[0.08em] text-secondary">Teeinblue asset slots</h4>
                  <div className="mt-3 grid gap-2">
                    {slots.map((slot) => (
                      <div key={slot.id} className="grid gap-2 rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm md:grid-cols-[1fr_auto_auto] md:items-center">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-primary">{slot.slotKey}</p>
                          <p className="truncate text-xs text-secondary">{slot.title}</p>
                        </div>
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-secondary">{slot.recommendedFormat}</span>
                        <span className={cx("rounded-full px-3 py-1 text-xs font-semibold", slot.status === "Missing" ? "bg-amber-50 text-warning" : "bg-[#e3f1df] text-[#108043]")}>{slot.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-sm font-semibold uppercase tracking-[0.08em] text-secondary">teeinblue_manifest.json preview</h4>
                    <CopyButton value={manifestJson} onCopied={() => undefined} label="Copy JSON" />
                  </div>
                  <pre className="mt-3 max-h-64 overflow-auto rounded-lg bg-surface-muted p-3 text-xs leading-5 text-secondary whitespace-pre-wrap">{manifestJson}</pre>
                </div>
                <div className="rounded-xl border border-border bg-white p-4">
                  <h4 className="text-sm font-semibold uppercase tracking-[0.08em] text-secondary">setup_guide.md preview</h4>
                  <pre className="mt-3 max-h-64 overflow-auto rounded-lg bg-surface-muted p-3 text-xs leading-5 text-secondary whitespace-pre-wrap">{setupGuide}</pre>
                </div>
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}

function DesignCanvasPreview({ layout, assets }: { layout: DesignLayoutPlan; assets: ArtworkAsset[] }) {
  const previewMax = 360;
  const scale = previewMax / Math.max(layout.canvas.width, layout.canvas.height);
  const width = Math.round(layout.canvas.width * scale);
  const height = Math.round(layout.canvas.height * scale);
  const printInset = layout.printArea.safeMargin * scale;

  return (
    <div className="rounded-xl border border-border bg-surface-muted p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold uppercase tracking-[0.08em] text-secondary">Canvas preview</h4>
          <p className="mt-1 text-xs text-secondary">
            {layout.printArea.name} / {layout.canvas.width} x {layout.canvas.height}px
          </p>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-secondary">{layout.layers.length} layers</span>
      </div>
      <div
        className="relative mx-auto overflow-hidden border border-dashed border-shade-30 bg-white"
        style={{
          width,
          height,
        }}
      >
        <div
          className="pointer-events-none absolute border border-dashed border-[#108043]"
          style={{
            left: printInset,
            top: printInset,
            right: printInset,
            bottom: printInset,
          }}
        />
        {layout.layers.map((layer) => {
          const asset = assets.find((item) => `layer-${item.id}` === layer.id);
          const isGuide = layer.teeinblueRole === "guide_do_not_print";
          const left = Math.round(layer.x * scale);
          const top = Math.round(layer.y * scale);
          const layerWidth = Math.max(18, Math.round(layer.width * scale));
          const layerHeight = Math.max(18, Math.round(layer.height * scale));

          return (
            <div
              key={layer.id}
              className={cx("absolute grid place-items-center overflow-hidden border text-center text-[10px] font-semibold leading-tight", isGuide ? "border-amber-300 bg-amber-50/60 text-warning" : "border-[#005bd3]/40 bg-[#eaf4ff]/70 text-[#005bd3]")}
              style={{
                left,
                top,
                width: layerWidth,
                height: layerHeight,
                zIndex: layer.zIndex,
              }}
              title={`${layer.name} - ${layer.teeinblueRole}`}
            >
              {asset?.uploadedAssetUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={asset.uploadedAssetUrl} alt={`${asset.title} preview`} className="h-full w-full object-cover" />
              ) : (
                <span className="px-1">{layer.name}</span>
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-xs leading-5 text-secondary">Preview is a planning map for layer order and personalization mapping, not a pixel-perfect Teeinblue renderer.</p>
    </div>
  );
}

function ComponentPromptsTab({
  selectedConcepts,
  componentPromptPacks,
  analysis,
  onCopied,
  onDownload,
}: {
  selectedConcepts: Concept[];
  componentPromptPacks: Record<string, ComponentPromptPack>;
  analysis: Analysis;
  onCopied: () => void;
  onDownload: (name: string, value: string, type: string) => void;
}) {
  if (!selectedConcepts.length) return <p className="text-sm text-secondary">Select concepts to generate component prompt packs.</p>;

  const markdownPack = formatComponentPromptMarkdown(selectedConcepts, componentPromptPacks);
  const jsonPack = JSON.stringify(selectedConcepts.map((concept) => componentPromptPacks[concept.id]).filter(Boolean), null, 2);
  const chatGptBrief = formatChatGPTCreativeBrief(selectedConcepts, componentPromptPacks, analysis);

  return (
    <div className="space-y-6">
      <TabIntro
        eyebrow="Component Prompts"
        title="Design building-block prompts"
        description="Break each selected concept into reusable component prompts for clipart, personalization, materials, assembly, mockups, ads, and UGC frames."
        action={
          <>
            <CopyButton value={markdownPack || "No component prompts generated yet."} onCopied={onCopied} label="Copy pack" />
            <CopyButton value={chatGptBrief} onCopied={onCopied} label="Copy Full Creative Brief for ChatGPT" />
            <button type="button" onClick={() => onDownload("component-prompts.md", markdownPack || "No component prompts generated yet.", "text/markdown")} className="focus-ring inline-flex h-10 items-center gap-2 rounded-lg border border-primary bg-white px-4 text-sm font-medium text-primary hover:bg-surface-muted">
              <Download size={16} />
              Export Markdown
            </button>
            <button type="button" onClick={() => onDownload("component-prompts.json", jsonPack, "application/json")} className="focus-ring inline-flex h-10 items-center gap-2 rounded-lg border border-primary bg-white px-4 text-sm font-medium text-primary hover:bg-surface-muted">
              <FileJson size={16} />
              Export JSON
            </button>
          </>
        }
      />
      {selectedConcepts.map((concept) => {
        const pack = componentPromptPacks[concept.id];
        if (!pack) return null;
        const conceptMarkdown = formatComponentPromptMarkdown([concept], componentPromptPacks);

        return (
          <details key={concept.id} open className="border-b border-border pb-6 last:border-b-0">
            <summary className="cursor-pointer text-xl font-medium text-primary">{concept.name}</summary>
            <div className="mt-4 space-y-4">
              <div className="bg-surface-muted p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-primary">Recommended build order</h4>
                    <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm leading-6 text-secondary">
                      {pack.recommendedBuildOrder.map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ol>
                  </div>
                  <CopyButton value={conceptMarkdown} onCopied={onCopied} label="Copy concept pack" />
                </div>
              </div>
              <div className="grid gap-3">
                {pack.prompts.map((prompt) => (
                  <details key={prompt.id} open className="rounded-xl border border-border bg-white p-4">
                    <summary className="cursor-pointer">
                      <span className="font-medium text-primary">{prompt.title}</span>
                      <span className="ml-2 rounded-full border border-border bg-surface-muted px-2.5 py-1 text-xs font-medium text-secondary">{prompt.promptType}</span>
                    </summary>
                    <div className="mt-3 space-y-3">
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-lg border border-border bg-surface-muted px-3 py-1 text-xs font-medium text-secondary">{prompt.recommendedTool}</span>
                        <span className="rounded-lg border border-border bg-white px-3 py-1 text-xs font-medium text-secondary">{prompt.recommendedRatio}</span>
                        <span className="rounded-lg border border-border bg-white px-3 py-1 text-xs font-medium text-secondary">{prompt.recommendedUse}</span>
                      </div>
                      <p className="max-h-44 overflow-auto rounded-lg bg-surface-muted p-4 font-mono text-sm leading-6 text-secondary">{prompt.prompt}</p>
                      <div className="flex flex-wrap gap-2">
                        <CopyButton value={prompt.prompt} onCopied={onCopied} label="Copy Prompt" />
                        <CopyButton value={`${conceptBrief(concept)}\n\nPrompt:\n${prompt.prompt}`} onCopied={onCopied} label="Copy With Concept Brief" />
                        <CopyButton value={toolFormattedPrompt("ChatGPT", concept, prompt)} onCopied={onCopied} label="Copy For ChatGPT" />
                        <CopyButton value={toolFormattedPrompt("Midjourney", concept, prompt)} onCopied={onCopied} label="Copy For Midjourney" />
                        <CopyButton value={toolFormattedPrompt("Ideogram", concept, prompt)} onCopied={onCopied} label="Copy For Ideogram" />
                      </div>
                    </div>
                  </details>
                ))}
              </div>
            </div>
          </details>
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

function VersionHistoryPanel({
  versions,
  activeVersionId,
  onRestore,
}: {
  versions: GenerationVersion[];
  activeVersionId: string;
  onRestore: (versionId: string) => void;
}) {
  if (!versions.length) return null;
  return (
    <div className="mb-5 rounded-xl border border-border bg-white p-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-secondary">Generation history</p>
          <h3 className="mt-1 text-base font-semibold">{versions.length} saved version{versions.length === 1 ? "" : "s"}</h3>
        </div>
        <span className="text-xs text-secondary">Stored locally and synced to Supabase when configured</span>
      </div>
      <div className="mt-4 grid gap-2 md:grid-cols-2">
        {versions.slice(0, 4).map((version) => (
          <button
            key={version.id}
            type="button"
            onClick={() => onRestore(version.id)}
            className={cx(
              "focus-ring rounded-lg border p-3 text-left transition",
              activeVersionId === version.id ? "border-primary bg-surface-muted" : "border-border bg-white hover:border-shade-40",
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="font-medium">{version.label}</span>
              <span className="rounded-full bg-[#e3f1df] px-2 py-1 text-[11px] font-semibold text-[#108043]">{getSourceLabel(version.generationMeta)}</span>
            </div>
            <p className="mt-1 text-xs text-secondary">
              {formatDate(version.createdAt)}
              {version.generationMeta.model ? ` · ${version.generationMeta.model}` : ""}
              {version.generationMeta.durationMs ? ` · ${formatDuration(version.generationMeta.durationMs)}` : ""}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}

function ExportTab({
  markdown,
  jsonValue,
  productDecomposition,
  componentAssetWorkflow,
  assetPlans,
  artworkAssets,
  componentPromptPacks,
  copyPacks,
  selectedConcepts,
  opportunityScore,
  creativeAngleGroups,
  adMatrixRows,
  analysis,
  generationMeta,
  versions,
  exportRecords,
  screenshotIncluded,
  flags,
  hasGenericWarning,
  onCopied,
  onDownload,
}: {
  markdown: string;
  jsonValue: string;
  productDecomposition: ProductDecomposition;
  componentAssetWorkflow: ComponentAssetWorkflowState;
  assetPlans: CreativeAssetPlan[];
  artworkAssets: ArtworkAsset[];
  componentPromptPacks: Record<string, ComponentPromptPack>;
  copyPacks: Record<string, CopyPack>;
  selectedConcepts: Concept[];
  opportunityScore: OpportunityScore;
  creativeAngleGroups: CreativeAngleGroup[];
  adMatrixRows: AdMatrixRow[];
  analysis: Analysis | null;
  generationMeta?: GenerationMeta;
  versions: GenerationVersion[];
  exportRecords: ExportRecord[];
  screenshotIncluded: boolean;
  flags: OutputFlags;
  hasGenericWarning: boolean;
  onCopied: () => void;
  onDownload: (name: string, value: string, type: string) => void;
}) {
  const assetPromptPack = assetPlans.map((asset) => `## ${asset.title}\n- Type: ${asset.type}\n- Ratio: ${asset.ratio}\n\n${asset.prompt}`).join("\n\n");
  const artworkAssetPack = formatArtworkAssetsMarkdown(artworkAssets);
  const artworkAssetJson = formatArtworkAssetsJson(artworkAssets);
  const productDecompositionMarkdown = formatProductDecompositionMarkdown(productDecomposition);
  const productDecompositionJson = JSON.stringify({ ...productDecomposition, componentAssetWorkflow }, null, 2);
  const componentPromptMarkdown = formatComponentPromptMarkdown(selectedConcepts, componentPromptPacks);
  const componentPromptJson = JSON.stringify(selectedConcepts.map((concept) => componentPromptPacks[concept.id]).filter(Boolean), null, 2);
  const chatGptPromptPack = analysis ? formatChatGPTCreativeBrief(selectedConcepts, componentPromptPacks, analysis) : "";
  const opportunityPack = JSON.stringify(opportunityScore, null, 2);
  const anglePack = creativeAngleGroups
    .map((group) => `# ${group.group}\n\n${group.angles.map((angle) => `## ${angle.name}\n- Insight: ${angle.insight}\n- Hook: ${angle.hook}\n- Direction: ${angle.direction}`).join("\n\n")}`)
    .join("\n\n");
  const adMatrixPack = adMatrixRows
    .map((row) => `## ${row.angleName}\n- Buyer insight: ${row.buyerInsight}\n- Hook: ${row.hook}\n- Visual direction: ${row.visualDirection}\n- Primary text: ${row.primaryText}\n- Headline: ${row.headline}\n- CTA: ${row.cta}\n- Asset type: ${row.recommendedAssetType}`)
    .join("\n\n");
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
- Artwork assets: ${artworkAssets.length}
- Screenshot included: ${screenshotIncluded ? "Yes" : "No"}

## Custom Fields
${analysis?.customFields.map((field) => `- ${field.name}: ${field.example}`).join("\n") || "No custom map generated."}

## Assets
${assetPlans.map((asset) => `- ${asset.title} · ${asset.ratio} · ${asset.status}`).join("\n") || "No assets planned."}

## Artwork Asset Builder
${artworkAssets.map((asset) => `- ${asset.conceptName} · ${asset.assetGroup} · ${asset.title} · ${asset.priority}`).join("\n") || "No artwork assets planned."}

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
          <button type="button" onClick={() => onDownload("pod-creative-pack.md", markdown, "text/markdown")} className="focus-ring inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-medium text-white hover:bg-shade-70">
            <Download size={17} />
            Export Markdown
          </button>
        ) : null}
        {flags.exportJson ? (
          <button type="button" onClick={() => onDownload("pod-creative-pack.json", jsonValue, "application/json")} className="focus-ring inline-flex h-11 items-center gap-2 rounded-lg border border-primary bg-white px-5 text-sm font-medium text-primary hover:bg-surface-muted">
            <FileJson size={17} />
            Export JSON
          </button>
        ) : null}
        <CopyButton value={markdown} onCopied={onCopied} label="Copy tab" />
      </div>
      {exportRecords.length ? (
        <div className="rounded-xl border border-border bg-white p-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-secondary">Export history</p>
              <h3 className="mt-1 text-base font-semibold">Recent downloads</h3>
            </div>
            <span className="text-xs text-secondary">{exportRecords.length} record{exportRecords.length === 1 ? "" : "s"} in this draft</span>
          </div>
          <div className="mt-4 divide-y divide-border">
            {exportRecords.slice(0, 6).map((record) => (
              <div key={record.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">{record.filename}</p>
                  <p className="text-xs text-secondary">
                    {record.exportType.toUpperCase()} · {formatFileSize(record.sizeBytes)} · {formatDate(record.createdAt)}
                  </p>
                </div>
                <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-semibold text-secondary">Synced on export</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <div className="grid gap-3 md:grid-cols-2">
        {[
          ["Opportunity Score", "opportunity-score.json", opportunityPack, "application/json"],
          ["Product Decomposition", "product-decomposition.md", productDecompositionMarkdown, "text/markdown"],
          ["Product Decomposition JSON", "product-decomposition.json", productDecompositionJson, "application/json"],
          ["Creative Angles", "creative-angles.md", anglePack || "No creative angles generated yet.", "text/markdown"],
          ["Ad Matrix", "ad-content-matrix.md", adMatrixPack || "No ad matrix generated yet.", "text/markdown"],
          ["Artwork Asset Pack", "artwork-asset-pack.md", artworkAssetPack || "No artwork assets generated yet.", "text/markdown"],
          ["Artwork Assets JSON", "artwork-assets.json", artworkAssetJson, "application/json"],
          ["Component Prompt Pack", "component-prompts.md", componentPromptMarkdown || "No component prompts generated yet.", "text/markdown"],
          ["Component Prompts JSON", "component-prompts.json", componentPromptJson, "application/json"],
          ["ChatGPT Prompt Pack", "chatgpt-prompt-pack.md", chatGptPromptPack || "No ChatGPT prompt pack generated yet.", "text/markdown"],
          ["Creative Prompt Pack", "creative-prompt-pack.txt", assetPromptPack || "No asset prompts planned yet.", "text/plain"],
          ["Shopify Listing Draft", "shopify-listing-draft.md", shopifyPack || "No Shopify copy generated yet.", "text/markdown"],
          ["Meta Ads Pack", "meta-ads-pack.md", metaPack || "No Meta ads copy generated yet.", "text/markdown"],
          ["Production Checklist", "production-checklist.md", checklist, "text/markdown"],
        ].map(([label, filename, value, type]) => (
          <div key={label} className="rounded-xl border border-border bg-white p-4">
            <h4 className="font-medium">{label}</h4>
            <div className="mt-3 flex flex-wrap gap-2">
              <CopyButton value={value} onCopied={onCopied} label="Copy" />
              <button type="button" onClick={() => onDownload(filename, value, type)} className="focus-ring inline-flex h-9 items-center gap-2 rounded-lg border border-primary bg-white px-3 text-xs font-medium text-primary hover:bg-surface-muted">
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
