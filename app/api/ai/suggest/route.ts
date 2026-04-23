import { authOptions } from "@/utils/auth";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

type SuggestMode = "draft" | "improve";

type SuggestRequest = {
  mode?: SuggestMode;
  brief?: string;
  title?: string;
  description?: string;
};

type SuggestResponseSource =
  | "openai"
  | "groq"
  | "openrouter"
  | "gemini"
  | "fallback";

const AI_TIMEOUT_MS = 12000;
const AI_RETRY_COUNT = 1;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 15;
const MAX_BRIEF_LENGTH = 300;
const MAX_TITLE_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 3000;

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "this",
  "that",
  "from",
  "your",
  "about",
  "into",
  "video",
  "make",
  "made",
  "have",
  "has",
  "will",
  "just",
  "than",
  "when",
  "what",
  "where",
  "which",
]);

function cleanText(input: string) {
  return input.replace(/\s+/g, " ").trim();
}

function validateInputLengths(input: Required<SuggestRequest>) {
  if (input.brief.length > MAX_BRIEF_LENGTH) {
    return `Brief must be ${MAX_BRIEF_LENGTH} characters or less.`;
  }

  if (input.title.length > MAX_TITLE_LENGTH) {
    return `Title must be ${MAX_TITLE_LENGTH} characters or less.`;
  }

  if (input.description.length > MAX_DESCRIPTION_LENGTH) {
    return `Description must be ${MAX_DESCRIPTION_LENGTH} characters or less.`;
  }

  return null;
}

function isRateLimited(key: string) {
  const now = Date.now();
  const existing = rateLimitStore.get(key);

  if (!existing || existing.resetAt <= now) {
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    });
    return false;
  }

  if (existing.count >= RATE_LIMIT_MAX_REQUESTS) {
    return true;
  }

  existing.count += 1;
  rateLimitStore.set(key, existing);
  return false;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = AI_TIMEOUT_MS
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  retries = AI_RETRY_COUNT
) {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetchWithTimeout(url, init);
      if (response.ok) {
        return response;
      }

      if (attempt < retries && response.status >= 500) {
        continue;
      }

      throw new Error(`Upstream request failed with status ${response.status}`);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Upstream request failed");
      if (attempt === retries) {
        break;
      }
    }
  }

  throw lastError ?? new Error("Upstream request failed");
}

function toTitleCase(input: string) {
  return input
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function extractTopic(brief: string, title: string, description: string) {
  const source = `${brief} ${title} ${description}`.toLowerCase();
  const words = source.match(/[a-z0-9]+/g) ?? [];
  const meaningful = words.filter((word) => word.length > 2 && !STOP_WORDS.has(word));
  const unique = [...new Set(meaningful)].slice(0, 5);

  if (unique.length === 0) {
    return "creative workflow";
  }

  return unique.join(" ");
}

function buildFallbackDraft(brief: string, title: string, description: string) {
  const topic = extractTopic(brief, title, description);
  const generatedTitle = toTitleCase(`How to Improve ${topic}`);
  const generatedDescription = cleanText(
    `In this video, I walk through ${topic} with practical steps you can use right away. We cover the setup, key decisions, and common mistakes so you can get better results faster.`
  );

  return {
    title: generatedTitle,
    description: generatedDescription,
    source: "fallback" as const,
  };
}

function buildFallbackImprovedDescription(
  brief: string,
  title: string,
  description: string
) {
  const topic = extractTopic(brief, title, description);
  const base = cleanText(description);

  if (!base) {
    return {
      title: title || toTitleCase(`Practical Guide to ${topic}`),
      description: cleanText(
        `This video explains ${topic} in a clear, step-by-step way. You will learn what to focus on, how to avoid common pitfalls, and how to apply these ideas in real projects.`
      ),
      source: "fallback" as const,
    };
  }

  return {
    title: title || toTitleCase(`Practical Guide to ${topic}`),
    description: cleanText(
      `${base} This walkthrough focuses on real outcomes, clear examples, and actionable tips you can apply immediately.`
    ),
    source: "fallback" as const,
  };
}

function parseJsonFromModel(content: string) {
  const trimmed = content.trim();
  const withoutFence = trimmed
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "");

  const parsed = JSON.parse(withoutFence) as { title?: string; description?: string };

  return {
    title: cleanText(parsed.title ?? ""),
    description: cleanText(parsed.description ?? ""),
  };
}

async function generateWithOpenAI(input: Required<SuggestRequest>) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return null;
  }

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const systemPrompt =
    "You write concise, engaging YouTube-style metadata. Return strict JSON only: {\"title\":\"...\",\"description\":\"...\"}. No markdown.";

  const userPrompt = [
    `Mode: ${input.mode}`,
    `Brief: ${input.brief || "(none)"}`,
    `Current title: ${input.title || "(none)"}`,
    `Current description: ${input.description || "(none)"}`,
    "Rules:",
    "- Title max 70 characters",
    "- Description 1-2 sentences, practical and clear",
    "- Keep language natural and professional",
  ].join("\n");

  const response = await fetchWithRetry("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.7,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("No completion content");
  }

  const parsed = parseJsonFromModel(content);
  if (!parsed.title && !parsed.description) {
    throw new Error("Invalid completion format");
  }

  return {
    title: parsed.title,
    description: parsed.description,
    source: "openai" as const,
  };
}

async function generateWithGroq(input: Required<SuggestRequest>) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return null;
  }

  const model = process.env.GROQ_MODEL || "llama-3.1-8b-instant";
  const systemPrompt =
    "You write concise, engaging YouTube-style metadata. Return strict JSON only: {\"title\":\"...\",\"description\":\"...\"}. No markdown.";
  const userPrompt = [
    `Mode: ${input.mode}`,
    `Brief: ${input.brief || "(none)"}`,
    `Current title: ${input.title || "(none)"}`,
    `Current description: ${input.description || "(none)"}`,
    "Rules:",
    "- Title max 70 characters",
    "- Description 1-2 sentences, practical and clear",
    "- Keep language natural and professional",
  ].join("\n");

  const response = await fetchWithRetry("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.7,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("No completion content");
  }

  const parsed = parseJsonFromModel(content);
  if (!parsed.title && !parsed.description) {
    throw new Error("Invalid completion format");
  }

  return {
    title: parsed.title,
    description: parsed.description,
    source: "groq" as const,
  };
}

async function generateWithOpenRouter(input: Required<SuggestRequest>) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return null;
  }

  const model = process.env.OPENROUTER_MODEL || "meta-llama/llama-3.1-8b-instruct:free";
  const systemPrompt =
    "You write concise, engaging YouTube-style metadata. Return strict JSON only: {\"title\":\"...\",\"description\":\"...\"}. No markdown.";
  const userPrompt = [
    `Mode: ${input.mode}`,
    `Brief: ${input.brief || "(none)"}`,
    `Current title: ${input.title || "(none)"}`,
    `Current description: ${input.description || "(none)"}`,
    "Rules:",
    "- Title max 70 characters",
    "- Description 1-2 sentences, practical and clear",
    "- Keep language natural and professional",
  ].join("\n");

  const response = await fetchWithRetry("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.7,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("No completion content");
  }

  const parsed = parseJsonFromModel(content);
  if (!parsed.title && !parsed.description) {
    throw new Error("Invalid completion format");
  }

  return {
    title: parsed.title,
    description: parsed.description,
    source: "openrouter" as const,
  };
}

async function generateWithGemini(input: Required<SuggestRequest>) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }

  const model = process.env.GEMINI_MODEL || "gemini-1.5-flash";
  const prompt = [
    "You write concise, engaging YouTube-style metadata.",
    'Return strict JSON only: {"title":"...","description":"..."}.',
    "No markdown.",
    `Mode: ${input.mode}`,
    `Brief: ${input.brief || "(none)"}`,
    `Current title: ${input.title || "(none)"}`,
    `Current description: ${input.description || "(none)"}`,
    "Rules:",
    "- Title max 70 characters",
    "- Description 1-2 sentences, practical and clear",
    "- Keep language natural and professional",
  ].join("\n");

  const response = await fetchWithRetry(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      }),
    }
  );

  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };

  const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!content) {
    throw new Error("No completion content");
  }

  const parsed = parseJsonFromModel(content);
  if (!parsed.title && !parsed.description) {
    throw new Error("Invalid completion format");
  }

  return {
    title: parsed.title,
    description: parsed.description,
    source: "gemini" as const,
  };
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimitKey =
      session.user?.email || session.user?.id || request.headers.get("x-forwarded-for") || "anonymous";
    if (isRateLimited(rateLimitKey)) {
      return NextResponse.json(
        { error: "Too many AI requests. Please wait a moment and try again." },
        { status: 429 }
      );
    }

    const body = (await request.json()) as SuggestRequest;
    const mode: SuggestMode = body.mode === "improve" ? "improve" : "draft";

    const input: Required<SuggestRequest> = {
      mode,
      brief: cleanText(body.brief ?? ""),
      title: cleanText(body.title ?? ""),
      description: cleanText(body.description ?? ""),
    };

    const validationError = validateInputLengths(input);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    let generated:
      | {
          title: string;
          description: string;
          source: SuggestResponseSource;
        }
      | null = null;

    try {
      generated =
        (await generateWithGemini(input)) ??
        (await generateWithGroq(input)) ??
        (await generateWithOpenRouter(input)) ??
        (await generateWithOpenAI(input));
    } catch {
      generated = null;
    }

    if (!generated) {
      generated =
        mode === "improve"
          ? buildFallbackImprovedDescription(input.brief, input.title, input.description)
          : buildFallbackDraft(input.brief, input.title, input.description);
    }

    return NextResponse.json(generated);
  } catch {
    return NextResponse.json({ error: "Failed to generate AI suggestion" }, { status: 500 });
  }
}
