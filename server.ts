import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";

dotenv.config();

const app = express();
const PORT = 3000;

// Initialize Google GenAI on the server
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "",
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

app.use(express.json());

// API health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    apiKeyConfigured: !!process.env.GEMINI_API_KEY
  });
});

// Chat Stream Endpoint (Server-Sent Events)
app.post("/api/chat/stream", async (req, res) => {
  const { message, history = [], model = "Jarwo Flash" } = req.body;

  if (!message) {
    return res.status(400).json({ error: "Pesan tidak boleh kosong." });
  }

  // Set SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const systemInstruction = "Anda adalah Nexxura AI, asisten virtual cerdas yang dikembangkan oleh Risa Umroh. Anda berkarakter ramah, profesional, cerdas, mampu membantu tugas-tugas kompleks, pemrograman, penulisan, dan analisis. Selalu berikan jawaban terbaik dalam format Markdown yang sangat rapi.";

  // Detect whether to use Groq API or Gemini API
  if (model.includes("(Groq)")) {
    let groqModel = "llama-3.3-70b-versatile";
    if (model === "Llama 3.1 (Groq)") {
      groqModel = "llama-3.1-8b-instant";
    } else if (model === "Qwen 32B (Groq)") {
      groqModel = "qwen-2.5-32b";
    }

    try {
      // Gather all configured Groq key candidates
      const keys = [
        process.env.GROQ_API_KEY_1,
        process.env.GROQ_API_KEY_2,
        process.env.GROQ_API_KEY_3
      ].map(k => k?.trim()).filter(Boolean);

      if (keys.length === 0) {
        throw new Error("Kunci API Groq belum dikonfigurasi di panel Secrets. Silakan tambahkan GROQ_API_KEY_1, GROQ_API_KEY_2, atau GROQ_API_KEY_3.");
      }

      const messages = [
        { role: "system", content: systemInstruction },
        ...history.map((h: any) => ({
          role: h.role === "user" ? "user" : "assistant",
          content: h.content
        })),
        { role: "user", content: message }
      ];

      let response: Response | null = null;
      let lastError: any = null;

      // Smart Failover Engine: Cycle through up to 3 Groq API keys
      for (let i = 0; i < keys.length; i++) {
        const currentKey = keys[i];
        try {
          console.log(`Mencoba Groq API Key ke-${i + 1}...`);
          response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${currentKey}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              model: groqModel,
              messages,
              stream: true
            })
          });

          if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Respons Groq API salah (${response.status}): ${errText}`);
          }
          
          break; // Key worked, exit loop!
        } catch (err: any) {
          console.error(`Gagal menghubungkan dengan Groq API Key #${i + 1}:`, err.message);
          lastError = err;
        }
      }

      if (!response || !response.ok) {
        throw new Error(`Seluruh kunci API Groq (${keys.length}) gagal digunakan. Kesalahan terakhir: ${lastError?.message || "Koneksi salah"}`);
      }

      // Process OpenAI-compatible SSE Event Stream natively
      let buffer = "";
      for await (const chunk of response.body as any) {
        buffer += chunk.toString("utf-8");
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          const cleanLine = line.trim();
          if (!cleanLine) continue;
          if (cleanLine.startsWith("data: ")) {
            const dataText = cleanLine.slice(6);
            if (dataText === "[DONE]") continue;
            try {
              const parsed = JSON.parse(dataText);
              const text = parsed.choices?.[0]?.delta?.content;
              if (text) {
                res.write(`data: ${JSON.stringify({ text })}\n\n`);
              }
            } catch (_) {}
          }
        }
      }

      res.write("data: [DONE]\n\n");
      res.end();
    } catch (err: any) {
      console.error("Groq Processing Error:", err);
      res.write(`data: ${JSON.stringify({ error: err.message || "Gagal menghubungi AI" })}\n\n`);
      res.end();
    }
  } else {
    // Standard Gemini stream
    const apiModel = model === "Jarwo Thinking" ? "gemini-3.1-pro-preview" : "gemini-3.5-flash";

    try {
      const contents = [];

      for (const h of history) {
        contents.push({
          role: h.role === "user" ? "user" : "model",
          parts: [{ text: h.content }]
        });
      }

      contents.push({
        role: "user",
        parts: [{ text: message }]
      });

      const responseStream = await ai.models.generateContentStream({
        model: apiModel,
        contents: contents,
        config: {
          systemInstruction: systemInstruction
        }
      });

      for await (const chunk of responseStream) {
        if (chunk.text) {
          res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
        }
      }

      res.write("data: [DONE]\n\n");
      res.end();
    } catch (err: any) {
      console.error("Gemini API Error:", err);
      res.write(`data: ${JSON.stringify({ error: err.message || "Gagal menghubungi AI" })}\n\n`);
      res.end();
    }
  }
});

// Serve frontend assets
async function setupServer() {
  if (process.env.NODE_ENV !== "production") {
    // Vite middleware for development
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

setupServer();
