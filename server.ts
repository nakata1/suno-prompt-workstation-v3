import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function extractHttpStatus(err: any): number | undefined {
  if (typeof err?.status === "number") return err.status;
  if (typeof err?.statusCode === "number") return err.statusCode;
  if (typeof err?.code === "number") return err.code;
  if (typeof err?.error?.code === "number") return err.error.code;

  const statusStr = String(err?.error?.status || err?.status || err?.code || "");
  if (statusStr === "RESOURCE_EXHAUSTED") return 429;
  if (statusStr === "UNAVAILABLE") return 503;
  if (statusStr === "INVALID_ARGUMENT") return 400;
  if (statusStr === "UNAUTHENTICATED") return 401;
  if (statusStr === "PERMISSION_DENIED") return 403;
  if (statusStr === "NOT_FOUND") return 404;

  const msg = String(err?.message || "");
  const match = msg.match(/\b(400|401|403|404|429|500|502|503|504)\b/);
  if (match) {
    return parseInt(match[1], 10);
  }
  if (/RESOURCE_EXHAUSTED|rate limit|quota/i.test(msg)) return 429;
  if (/UNAVAILABLE|overloaded/i.test(msg)) return 503;

  return undefined;
}

function isTransient(code: number | undefined): boolean {
  return code === 429 || code === 503;
}

async function callWithRetry<T>(fn: () => Promise<T>): Promise<T> {
  const maxRetries = 2;
  const backoffDelays = [800, 1600];
  let attempt = 0;

  while (true) {
    try {
      return await fn();
    } catch (err: any) {
      const code = extractHttpStatus(err);
      if (attempt < maxRetries && isTransient(code)) {
        const waitMs = backoffDelays[attempt] ?? 1600;
        console.warn(`[Gemini API] Transient ${code} error (attempt ${attempt + 1}/${maxRetries + 1}). Retrying in ${waitMs}ms...`);
        await delay(waitMs);
        attempt++;
        continue;
      }
      throw err;
    }
  }
}

function sendServerError(res: express.Response, err: any, fallbackMessage: string) {
  const code = extractHttpStatus(err);
  const transient = isTransient(code);
  const statusCode = transient ? (code === 429 ? 429 : 503) : (code && code >= 400 && code < 600 ? code : 500);
  const errorMessage = err?.message || fallbackMessage;

  return res.status(statusCode).json({
    error: errorMessage,
    code: statusCode,
    transient,
  });
}

let geminiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey) return null;
  if (!geminiClient) {
    geminiClient = new GoogleGenAI({ apiKey });
  }
  return geminiClient;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "15mb" }));

  // API health
  app.get("/api/health", (_req, res) => {
    const configured = Boolean(process.env.GEMINI_API_KEY || process.env.API_KEY);
    res.json({ status: "ok", aiConfigured: configured, model: GEMINI_MODEL });
  });

  // Optimize prompt
  app.post("/api/gemini/optimize-prompt", async (req, res) => {
    try {
      const { input } = req.body;
      const ai = getGeminiClient();
      if (!ai) {
        return res.status(503).json({ error: "GEMINI_API_KEY not configured", code: 503, transient: false });
      }
      const response = await callWithRetry(() =>
        ai.models.generateContent({
          model: GEMINI_MODEL,
          contents: `You are a music creative director preparing an idea for Suno Custom Mode.\n\nUser idea (may be Vietnamese): ${input}\n\nRewrite it into ONE concise English creative direction of 1-2 sentences. Preserve the user's story and emotion. Describe musical mood, energy, arrangement direction and vocal character only when reasonably inferable. Do not invent a named artist, copyrighted song, or celebrity voice. Do not add headings, markdown, brackets, or explanations.`,
        })
      );
      res.json({ result: response.text?.trim() || "" });
    } catch (err: any) {
      console.warn("Optimize prompt error:", err);
      sendServerError(res, err, "Failed to optimize prompt");
    }
  });

  // Fast prompt generation
  app.post("/api/gemini/generate-prompt", async (req, res) => {
    try {
      const { input } = req.body;
      const ai = getGeminiClient();
      if (!ai) {
        return res.status(503).json({ error: "GEMINI_API_KEY not configured", code: 503, transient: false });
      }
      const response = await callWithRetry(() =>
        ai.models.generateContent({
          model: GEMINI_MODEL,
          contents: `Turn the following song idea into a compact creative direction for a modern Suno-style music generator.\n\nIDEA: ${input}\n\nReturn only 2-3 concise English sentences. Cover: core mood, genre direction, vocal character if appropriate, key instrumentation, rhythmic feel, arrangement arc, and production texture. Avoid contradictory tags and keyword stuffing. Do not mention a real artist or a copyrighted song. Do not use headings, markdown or meta commentary.`,
        })
      );
      res.json({ result: response.text?.trim() || "" });
    } catch (err: any) {
      console.warn("Generate prompt error:", err);
      sendServerError(res, err, "Failed to generate prompt");
    }
  });

  // Lyrics generation
  app.post("/api/gemini/generate-lyrics", async (req, res) => {
    try {
      const { topic, style, lang } = req.body;
      const ai = getGeminiClient();
      if (!ai) {
        return res.status(503).json({ error: "GEMINI_API_KEY not configured", code: 503, transient: false });
      }
      const language =
        lang === "vi"
          ? "Vietnamese"
          : lang === "en"
          ? "English"
          : lang === "ja"
          ? "Japanese"
          : lang === "ko"
          ? "Korean"
          : lang;
      const response = await callWithRetry(() =>
        ai.models.generateContent({
          model: GEMINI_MODEL,
          contents: `Write original song lyrics for use in Suno Custom Mode.\n\nTOPIC: ${topic}\nSTYLE DIRECTION: ${style}\nLANGUAGE: ${language}\n\nRequirements:\n- Return lyrics only, no explanation.\n- Use useful structural cues such as [Intro], [Verse 1], [Pre-Chorus], [Chorus], [Verse 2], [Bridge], [Final Chorus], [Outro] when musically appropriate.\n- Make the chorus memorable but do not over-repeat.\n- Use natural, singable phrasing and coherent imagery.\n- Preserve the requested emotional tone.\n- Do not imitate or mention a specific living artist, copyrighted lyric, or existing song.\n- Avoid stuffing production instructions into every lyric line; structural/performance cues may appear sparingly in brackets.`,
        })
      );
      res.json({ lyrics: response.text?.trim() || "" });
    } catch (err: any) {
      console.warn("Generate lyrics error:", err);
      sendServerError(res, err, "Failed to generate lyrics");
    }
  });

  // AI Music Director
  app.post("/api/gemini/music-director", async (req, res) => {
    try {
      const { input, catalog } = req.body;
      const ai = getGeminiClient();
      if (!ai) {
        return res.status(503).json({ error: "GEMINI_API_KEY not configured", code: 503, transient: false });
      }
      const response = await callWithRetry(() =>
        ai.models.generateContent({
          model: GEMINI_MODEL,
          contents: `You are an expert semantic AI Music Director preparing inputs for Suno Custom Mode.

USER IDEA (may be Vietnamese): ${input}

FIRST understand the full musical intent before selecting any tags. Infer only when supported by the idea: genre family, cultural/era flavor, emotional polarity, energy, vocal role, instrumentation, rhythm, arrangement arc, and production character.

THEN rank catalog tags by semantic fit. Select only tags that materially reinforce the SAME concept. Never choose a tag merely because one adjective or keyword overlaps. Avoid contradictory genre, mood, vocal, instrument, production and performance choices.

SELECTION RULES:
- CRITICAL EXCLUSION RULE: If the user explicitly excludes or negates any genre, style, instrument, vocal, or production element (e.g., using "không", "tránh", "loại bỏ", "no", "without", "avoid", "exclude", e.g., "không EDM, không metal, không Lo-Fi"), you MUST STRICTLY EXCLUDE those tags and any related subgenres/elements from selections!
- Prefer 1-2 genres, 1-3 moods, 2-5 instruments, 0-2 vocals, 1-2 structure tags.
- Keep production/performance/effects sparse and useful.
- If the catalog lacks an accurate tag, leave that category sparse or empty rather than choosing a misleading substitute.
- For mythic war / Viking / Nordic / dragon / thunder / heroic battle concepts, when available and NOT excluded, strongly prefer semantically related epic, folk, metal, symphonic, cinematic, martial, dark/powerful, choir, war-drum, distorted-guitar, orchestral-percussion or Nordic-folk tags over unrelated sad/romantic tags.
- For intimate grief / rain / longing concepts, prefer restrained, melancholic, warm, acoustic, expressive choices over unnecessarily epic or aggressive ones.
- Never force a vocal choice if the idea does not imply one.

TAG CATALOG JSON:
${JSON.stringify(catalog)}

Return STRICT JSON only with this shape:
{
  "creativeDirection": "1-2 concise English sentences for Suno describing the musical concept naturally",
  "confidence": 0.0,
  "selections": {
    "genres": [], "production": [], "instruments": [], "moods": [], "vocals": [], "structure": [], "effects": [], "v5Advanced": [], "mixingPresets": [], "animeDrama": [], "v5Performance": []
  },
  "rationale": "One short Vietnamese sentence explaining the musical direction"
}

Confidence must be a number from 0 to 1 representing confidence that the supplied catalog contains a good fit. If confidence would be below 0.65, prefer fewer selections rather than weak substitutions. Do not name a real artist, copyrighted song, or celebrity voice. Do not invent tags outside the catalog.`,
          config: { responseMimeType: "application/json" },
        })
      );
      const text = response.text?.trim();
      if (!text) {
        return res.status(500).json({ error: "Empty response from Gemini", code: 500, transient: false });
      }
      const parsed = JSON.parse(text);
      const confidence = Math.max(0, Math.min(1, Number(parsed?.confidence ?? 0.8)));
      res.json({ ...parsed, confidence, engine: "gemini", model: GEMINI_MODEL });
    } catch (err: any) {
      console.warn("Music Director error:", err);
      sendServerError(res, err, "Failed to run Music Director");
    }
  });

  // Image analysis
  app.post("/api/gemini/analyze-image", async (req, res) => {
    try {
      const { base64Data, mimeType } = req.body;
      const ai = getGeminiClient();
      if (!ai) {
        return res.status(503).json({ error: "GEMINI_API_KEY not configured", code: 503, transient: false });
      }
      const response = await callWithRetry(() =>
        ai.models.generateContent({
          model: GEMINI_MODEL,
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType: mimeType || "image/jpeg",
                  data: base64Data,
                },
              },
              {
                text: `Analyze this image for music inspiration. 
                Return a STRICT JSON object (no markdown) with two keys:
                1. 'topic': A short, creative song description in Vietnamese based on the visual mood.
                2. 'tags': An array of 5-8 English musical style tags that fit the image (genres, instruments, moods).`,
              },
            ],
          },
          config: {
            responseMimeType: "application/json",
          },
        })
      );
      const text = response.text?.trim();
      if (!text) {
        return res.status(500).json({ error: "Empty response from Gemini", code: 500, transient: false });
      }
      const json = JSON.parse(text);
      res.json(json);
    } catch (err: any) {
      console.warn("Analyze image error:", err);
      sendServerError(res, err, "Failed to analyze image");
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
