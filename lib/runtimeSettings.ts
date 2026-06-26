import { supabaseRest } from "@/lib/supabaseRest";
import { runtimeProviderDefaults, type RuntimeProviderKey, type RuntimeProviderPublicSetting, type RuntimeProviderSetting } from "@/lib/runtimeSettingsShared";
export { runtimeProviderDefaults, type RuntimeProviderKey, type RuntimeProviderPublicSetting, type RuntimeProviderSetting };

function maskSecret(secret?: string) {
  if (!secret) return "";
  if (secret.length <= 8) return "••••••••";
  return `${secret.slice(0, 4)}••••${secret.slice(-4)}`;
}

export function toPublicRuntimeSetting(setting: RuntimeProviderSetting): RuntimeProviderPublicSetting {
  const { apiKey, ...publicSetting } = setting;
  return {
    ...publicSetting,
    hasApiKey: Boolean(apiKey),
    maskedApiKey: maskSecret(apiKey),
  };
}

function mergeWithDefaults(settings: RuntimeProviderSetting[]) {
  return runtimeProviderDefaults.map((fallback) => ({
    ...fallback,
    ...settings.find((setting) => setting.id === fallback.id),
  }));
}

function normalizeSetting(setting: RuntimeProviderSetting): RuntimeProviderSetting {
  const fallback = runtimeProviderDefaults.find((item) => item.id === setting.id);
  return {
    ...(fallback || setting),
    ...setting,
    enabled: Boolean(setting.enabled),
    provider: setting.provider || fallback?.provider || setting.id,
    label: setting.label || fallback?.label || setting.id,
  };
}

export async function getRuntimeSettings(): Promise<RuntimeProviderSetting[]> {
  try {
    const response = await supabaseRest("runtime_provider_settings?select=*&order=id.asc");
    if (!response.ok) throw new Error(await response.text());
    const rows = (await response.json()) as Array<{ setting: RuntimeProviderSetting | null }>;
    return mergeWithDefaults(rows.flatMap((row) => (row.setting ? [normalizeSetting(row.setting)] : [])));
  } catch {
    return runtimeProviderDefaults;
  }
}

export async function getRuntimeSetting(id: RuntimeProviderKey): Promise<RuntimeProviderSetting> {
  const settings = await getRuntimeSettings();
  return settings.find((setting) => setting.id === id) || runtimeProviderDefaults.find((setting) => setting.id === id)!;
}

export async function saveRuntimeSettings(settings: RuntimeProviderSetting[]) {
  const normalized = mergeWithDefaults(settings.map(normalizeSetting));
  const now = new Date().toISOString();
  const rows = normalized.map((setting) => ({
    id: setting.id,
    provider_type: setting.provider,
    enabled: setting.enabled,
    model: setting.model || null,
    endpoint: setting.endpoint || null,
    store_domain: setting.storeDomain || null,
    api_version: setting.apiVersion || null,
    secret_key: setting.apiKey || null,
    setting: { ...setting, updatedAt: now },
    updated_at: now,
  }));

  const response = await supabaseRest("runtime_provider_settings?on_conflict=id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(rows),
  });

  if (!response.ok) throw new Error(await response.text());
  return normalized;
}
