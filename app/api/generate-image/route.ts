import { NextResponse } from "next/server";
import { getRuntimeSetting } from "@/lib/runtimeSettings";

type ImageProvider = "openai" | "gemini" | "replicate" | "fal" | "none";

type ImageGenerationRequest = {
  provider?: ImageProvider;
  prompt: string;
  ratio: string;
  referenceImageBase64?: string;
  productImageBase64?: string;
  seed?: number;
};

function sizeFromRatio(ratio: string) {
  if (ratio.includes("21:9") || ratio.includes("16:9")) return "1536x1024";
  if (ratio.includes("9:16")) return "1024x1536";
  if (ratio.includes("4:5") || ratio.includes("468:598")) return "1024x1536";
  return "1024x1024";
}

export async function POST(request: Request) {
  const body = (await request.json()) as ImageGenerationRequest;
  const imageSettings = await getRuntimeSetting("openaiImage");
  const provider = body.provider || (imageSettings.enabled ? (imageSettings.provider as ImageProvider) : undefined) || (process.env.IMAGE_PROVIDER as ImageProvider | undefined) || "none";

  if (!body.prompt?.trim()) {
    return NextResponse.json({ provider, status: "failed", error: "Missing prompt." }, { status: 400 });
  }

  if (provider === "none") {
    return NextResponse.json(
      {
        provider,
        status: "failed",
        error: "Image provider is not configured. Copy the prompt or set IMAGE_PROVIDER and the matching provider key.",
      },
      { status: 400 },
    );
  }

  if (provider === "openai") {
    const apiKey = imageSettings.enabled ? imageSettings.apiKey || process.env.OPENAI_API_KEY : process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ provider, status: "failed", error: "OPENAI_API_KEY is not configured." }, { status: 400 });
    }

    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: imageSettings.model || process.env.OPENAI_IMAGE_MODEL || "gpt-image-1",
        prompt: body.prompt,
        size: sizeFromRatio(body.ratio || "1:1"),
        quality: process.env.OPENAI_IMAGE_QUALITY || "medium",
        n: 1,
      }),
    });

    const data = (await response.json()) as {
      data?: Array<{ b64_json?: string; url?: string; revised_prompt?: string }>;
      error?: { message?: string };
    };

    if (!response.ok) {
      return NextResponse.json({ provider, status: "failed", error: data.error?.message || "OpenAI image generation failed." }, { status: response.status });
    }

    const image = data.data?.[0];
    const imageUrl = image?.b64_json ? `data:image/png;base64,${image.b64_json}` : image?.url;
    if (!imageUrl) {
      return NextResponse.json({ provider, status: "failed", error: "OpenAI returned no image data." }, { status: 502 });
    }

    return NextResponse.json({
      provider,
      status: "generated",
      imageUrl,
      revisedPrompt: image?.revised_prompt,
      ratio: body.ratio,
    });
  }

  return NextResponse.json(
    {
      provider,
      status: "failed",
      error: `${provider} image generation is not implemented yet. Use IMAGE_PROVIDER=openai or copy prompts to an external image tool.`,
      ratio: body.ratio,
    },
    { status: 501 },
  );
}
