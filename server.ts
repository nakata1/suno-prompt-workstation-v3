import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

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
    res.json({ status: "ok" });
  });

  // Optimize prompt
  app.post("/api/gemini/optimize-prompt", async (req, res) => {
    try {
      const { input } = req.body;
      const ai = getGeminiClient();
      if (!ai) {
        return res.status(503).json({ error: "GEMINI_API_KEY not configured" });
      }
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `You are a music creative director preparing an idea for Suno Custom Mode.\n\nUser idea (may be Vietnamese): ${input}\n\nRewrite it into ONE concise English creative direction of 1-2 sentences. Preserve the user's story and emotion. Describe musical mood, energy, arrangement direction and vocal character only when reasonably inferable. Do not invent a named artist, copyrighted song, or celebrity voice. Do not add headings, markdown, brackets, or explanations.`,
      });
      res.json({ result: response.text?.trim() || "" });
    } catch (err: any) {
      console.warn("Optimize prompt error:", err);
      res.status(500).json({ error: err.message || "Failed to optimize prompt" });
    }
  });

  // Fast prompt generation
  app.post("/api/gemini/generate-prompt", async (req, res) => {
    try {
      const { input } = req.body;
      const ai = getGeminiClient();
      if (!ai) {
        return res.status(503).json({ error: "GEMINI_API_KEY not configured" });
      }
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `Turn the following song idea into a compact creative direction for a modern Suno-style music generator.\n\nIDEA: ${input}\n\nReturn only 2-3 concise English sentences. Cover: core mood, genre direction, vocal character if appropriate, key instrumentation, rhythmic feel, arrangement arc, and production texture. Avoid contradictory tags and keyword stuffing. Do not mention a real artist or a copyrighted song. Do not use headings, markdown or meta commentary.`,
      });
      res.json({ result: response.text?.trim() || "" });
    } catch (err: any) {
      console.warn("Generate prompt error:", err);
      res.status(500).json({ error: err.message || "Failed to generate prompt" });
    }
  });

  // Lyrics generation
  app.post("/api/gemini/generate-lyrics", async (req, res) => {
    try {
      const { topic, style, lang } = req.body;
      const ai = getGeminiClient();
      if (!ai) {
        return res.status(503).json({ error: "GEMINI_API_KEY not configured" });
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
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `Write original song lyrics for use in Suno Custom Mode.\n\nTOPIC: ${topic}\nSTYLE DIRECTION: ${style}\nLANGUAGE: ${language}\n\nRequirements:\n- Return lyrics only, no explanation.\n- Use useful structural cues such as [Intro], [Verse 1], [Pre-Chorus], [Chorus], [Verse 2], [Bridge], [Final Chorus], [Outro] when musically appropriate.\n- Make the chorus memorable but do not over-repeat.\n- Use natural, singable phrasing and coherent imagery.\n- Preserve the requested emotional tone.\n- Do not imitate or mention a specific living artist, copyrighted lyric, or existing song.\n- Avoid stuffing production instructions into every lyric line; structural/performance cues may appear sparingly in brackets.`,
      });
      res.json({ lyrics: response.text?.trim() || "" });
    } catch (err: any) {
      console.warn("Generate lyrics error:", err);
      res.status(500).json({ error: err.message || "Failed to generate lyrics" });
    }
  });

  // AI Music Director
  app.post("/api/gemini/music-director", async (req, res) => {
    try {
      const { input, catalog } = req.body;
      const ai = getGeminiClient();
      if (!ai) {
        return res.status(503).json({ error: "GEMINI_API_KEY not configured" });
      }
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `You are an expert AI Music Director preparing inputs for Suno Custom Mode.\n\nUSER IDEA (may be Vietnamese): ${input}\n\nChoose a SMALL, COHERENT set of tags ONLY from the supplied catalog. Avoid contradictory genre, mood, vocal, instrument, production and performance choices. Prefer 1-2 genres, 1-3 moods, 2-5 instruments, 0-2 vocals, 1-2 structure tags, and only a few production/performance tags that materially help.\n\nTAG CATALOG JSON:\n${JSON.stringify(
          catalog
        )}\n\nReturn STRICT JSON only with this shape:\n{\n  "creativeDirection": "1-2 concise English sentences for Suno describing the musical concept naturally",\n  "selections": {\n    "genres": [], "production": [], "instruments": [], "moods": [], "vocals": [], "structure": [], "effects": [], "v5Advanced": [], "mixingPresets": [], "animeDrama": [], "v5Performance": []\n  },\n  "rationale": "One short Vietnamese sentence explaining the musical direction"\n}\n\nDo not name a real artist, copyrighted song, or celebrity voice. Do not invent tags outside the catalog.`,
        config: { responseMimeType: "application/json" },
      });
      const text = response.text?.trim();
      if (!text) {
        return res.status(500).json({ error: "Empty response from Gemini" });
      }
      const parsed = JSON.parse(text);
      res.json(parsed);
    } catch (err: any) {
      console.warn("Music Director error:", err);
      res.status(500).json({ error: err.message || "Failed to run Music Director" });
    }
  });

  // Image analysis
  app.post("/api/gemini/analyze-image", async (req, res) => {
    try {
      const { base64Data, mimeType } = req.body;
      const ai = getGeminiClient();
      if (!ai) {
        return res.status(503).json({ error: "GEMINI_API_KEY not configured" });
      }
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
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
      });
      const text = response.text?.trim();
      if (!text) {
        return res.status(500).json({ error: "Empty response from Gemini" });
      }
      const json = JSON.parse(text);
      res.json(json);
    } catch (err: any) {
      console.warn("Analyze image error:", err);
      res.status(500).json({ error: err.message || "Failed to analyze image" });
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
