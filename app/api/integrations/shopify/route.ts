import { NextResponse } from "next/server";
import { logIntegrationRun } from "@/lib/integrationLog";
import { getRuntimeSetting } from "@/lib/runtimeSettings";

type ShopifyPayload = {
  title?: string;
  body_html?: string;
  tags?: string[];
  product_type?: string;
  status?: "draft" | "active";
};

function shopifyBaseUrl(storeDomain?: string, apiVersion?: string) {
  const domain = (storeDomain || process.env.SHOPIFY_STORE_DOMAIN)?.replace(/^https?:\/\//, "").replace(/\/$/, "");
  if (!domain) return null;
  return `https://${domain}/admin/api/${apiVersion || process.env.SHOPIFY_API_VERSION || "2025-10"}`;
}

function id(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function POST(request: Request) {
  const body = (await request.json()) as { product?: ShopifyPayload; raw?: unknown };
  const settings = await getRuntimeSetting("shopify");
  const baseUrl = shopifyBaseUrl(settings.enabled ? settings.storeDomain : undefined, settings.enabled ? settings.apiVersion : undefined);
  const token = settings.enabled ? settings.apiKey || process.env.SHOPIFY_ADMIN_ACCESS_TOKEN : process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;

  if (!body.product?.title) {
    return NextResponse.json({ source: "shopify", status: "failed", error: "Missing product title." }, { status: 400 });
  }

  if (!baseUrl || !token) {
    await logIntegrationRun({ id: id("integration"), integrationType: "shopify", status: "not_configured", payload: body });
    return NextResponse.json({
      source: "handoff",
      status: "not_configured",
      message: "SHOPIFY_STORE_DOMAIN and SHOPIFY_ADMIN_ACCESS_TOKEN are not configured. Product payload is ready for manual import.",
      product: body.product,
    });
  }

  try {
    const response = await fetch(`${baseUrl}/products.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": token,
      },
      body: JSON.stringify({
        product: {
          title: body.product.title,
          body_html: body.product.body_html || "",
          product_type: body.product.product_type || "POD Product",
          tags: body.product.tags?.join(", ") || "",
          status: body.product.status || "draft",
        },
      }),
    });
    const data = await response.json();

    if (!response.ok) {
      await logIntegrationRun({ id: id("integration"), integrationType: "shopify", status: "failed", payload: body, response: data });
      return NextResponse.json({ source: "shopify", status: "failed", error: data }, { status: response.status });
    }

    await logIntegrationRun({ id: id("integration"), integrationType: "shopify", status: "created", payload: body, response: data });
    return NextResponse.json({ source: "shopify", status: "created", product: data.product });
  } catch (error) {
    await logIntegrationRun({ id: id("integration"), integrationType: "shopify", status: "failed", payload: body, response: error instanceof Error ? error.message : "Shopify publish failed." });
    return NextResponse.json({ source: "shopify", status: "failed", error: error instanceof Error ? error.message : "Shopify publish failed." }, { status: 502 });
  }
}
