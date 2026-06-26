export type RuntimeProviderKey = "groq" | "openaiImage" | "teeinblue" | "shopify" | "metaAds";

export type RuntimeProviderSetting = {
  id: RuntimeProviderKey;
  label: string;
  enabled: boolean;
  provider: string;
  apiKey?: string;
  model?: string;
  endpoint?: string;
  storeDomain?: string;
  apiVersion?: string;
  updatedAt?: string;
};

export type RuntimeProviderPublicSetting = Omit<RuntimeProviderSetting, "apiKey"> & {
  hasApiKey: boolean;
  maskedApiKey?: string;
};

export const runtimeProviderDefaults: RuntimeProviderSetting[] = [
  { id: "groq", label: "Groq Strategy Agent", enabled: true, provider: "groq", model: "llama-3.3-70b-versatile" },
  { id: "openaiImage", label: "OpenAI Image Agent", enabled: false, provider: "openai", model: "gpt-image-1" },
  { id: "teeinblue", label: "Teeinblue Upload Agent", enabled: false, provider: "teeinblue" },
  { id: "shopify", label: "Shopify Admin Agent", enabled: false, provider: "shopify", apiVersion: "2025-10" },
  { id: "metaAds", label: "Meta Ads Agent", enabled: false, provider: "meta" },
];
