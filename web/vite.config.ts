import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import type { IncomingMessage, ServerResponse } from "node:http";

const root = fileURLToPath(new URL(".", import.meta.url));
const repo = fileURLToPath(new URL("..", import.meta.url));

// Laat /api/* ook lokaal werken (npm run dev / preview). Op Vercel zijn dit gewone functies.
async function handleApi(req: IncomingMessage, res: ServerResponse, next: (err?: unknown) => void) {
  const match = req.url?.match(/^\/api\/([a-z]+)(?:\?|$)/);
  if (!match) return next();
  try {
    const mod = await import(/* @vite-ignore */ new URL(`../api/${match[1]}.js`, import.meta.url).href);
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const method = req.method ?? "GET";
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) if (typeof v === "string") headers.set(k, v);
    const request = new Request(`http://localhost${req.url}`, {
      method,
      headers,
      body: method === "GET" || method === "HEAD" ? undefined : Buffer.concat(chunks),
    });
    const response: Response = await mod.default.fetch(request);
    res.statusCode = response.status;
    response.headers.forEach((value, key) => res.setHeader(key, value));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (err) {
    next(err);
  }
}

function localApi(): Plugin {
  return {
    name: "lokale-api",
    configureServer(server) {
      server.middlewares.use((req, res, next) => void handleApi(req, res, next));
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => void handleApi(req, res, next));
    },
  };
}

export default defineConfig({
  root,
  plugins: [react(), localApi()],
  server: { fs: { allow: [repo] } },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    chunkSizeWarningLimit: 1500,
  },
});
