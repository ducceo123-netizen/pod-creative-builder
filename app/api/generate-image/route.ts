import { NextResponse } from "next/server";

type ImageProvider = "openai" | "gemini" | "replicate" | "fal" | "none";

type ImageGenerationRequest = {
  provider?: ImageProvider;
  prompt: string;
  ratio: string;
  referenceImageBase64?: string;
  productImageBase64?: string;
  seed?: number;
};

export async function POST(request: Request) {
  const body = (await request.json()) as ImageGenerationRequest;
  const provider = body.provider || (process.env.IMAGE_PROVIDER as ImageProvider | undefined) || "none";

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

  return NextResponse.json(
    {
      provider,
      status: "failed",
      error: "Image provider route is configured, but provider execution is not implemented yet.",
      ratio: body.ratio,
    },
    { status: 501 },
  );
}
