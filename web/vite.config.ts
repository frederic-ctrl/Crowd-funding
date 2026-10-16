import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
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

// Eigen linkkaart voor de steunpagina: X en andere netwerken lezen de metatags van de HTML die ze
// krijgen. Na het bouwen maken we steun.html (een kopie van index.html met andere titel, tekst en
// afbeelding); vercel.json stuurt /steun daarheen. De app zelf is dezelfde.
const STEUN_META: [RegExp, string][] = [
  [/<title>[^<]*<\/title>/, "<title>Back the build · Marketing Scan</title>"],
  [/(<meta name="description" content=")[^"]*/, "$1Send SOL, ETH, USDC, USDT or BTC straight to the founder of Marketing Scan. A gift, nothing in return. Not an investment."],
  [/(<link rel="canonical" href=")[^"]*/, "$1https://funding.marketingscan.be/steun"],
  [/(<meta property="og:url" content=")[^"]*/, "$1https://funding.marketingscan.be/steun"],
  [/(<meta (?:property="og:title"|name="twitter:title") content=")[^"]*/g, "$1Back the build: support Marketing Scan directly"],
  [/(<meta (?:property="og:description"|name="twitter:description") content=")[^"]*/g, "$1Send crypto straight to the founder. A gift, nothing in return. Not an investment."],
  [/(<meta (?:property="og:image"|name="twitter:image") content=")[^"]*/g, "$1https://funding.marketingscan.be/og-steun.png"],
  [/(<meta property="og:image:alt" content=")[^"]*/, "$1Back the build: send crypto straight to the founder of Marketing Scan"],
];

function steunCard(): Plugin {
  return {
    name: "steun-kaart",
    apply: "build",
    closeBundle() {
      const dist = join(root, "dist");
      let html = readFileSync(join(dist, "index.html"), "utf8");
      for (const [re, value] of STEUN_META) {
        if (!re.test(html)) throw new Error(`steun-kaart: ${re} niet gevonden in index.html`);
        re.lastIndex = 0;
        html = html.replace(re, value);
      }
      writeFileSync(join(dist, "steun.html"), html);
    },
  };
}

export default defineConfig({
  root,
  plugins: [react(), localApi(), steunCard()],
  server: { fs: { allow: [repo] } },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    chunkSizeWarningLimit: 1500,
  },
});
