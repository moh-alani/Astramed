import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { readdirSync, writeFileSync } from "node:fs";
export default defineConfig({
  build: {
    rollupOptions: { output: { manualChunks: { charts: ["recharts"] } } },
  },
  plugins: [
    react(),
    tailwindcss(),
    {
      name: "offline-shell",
      apply: "build",
      closeBundle() {
        const assets = [
          ...readdirSync("dist/assets").map((f) => `./assets/${f}`),
          // Bundled NASA training video, captions, exercise clips and thumbnails, so they play without a connection.
          ...readdirSync("dist/media", { recursive: true, encoding: "utf8" }).filter((f) => /\.(mp4|vtt|svg)$/.test(f)).map((f) => `./media/${f.replaceAll("\\", "/")}`),
        ];
        writeFileSync(
          "dist/sw.js",
          `const CACHE='astramed-v1-${Date.now()}';const ASSETS=${JSON.stringify(["./", "./index.html", "./icon.svg", "./manifest.webmanifest", ...assets])};self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()))});self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('astramed-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||new URL(e.request.url).origin!==self.location.origin)return;e.respondWith(caches.match(e.request,{ignoreVary:true}).then(r=>r||fetch(e.request).catch(()=>e.request.mode==='navigate'?caches.match('./index.html'):Response.error())))});`,
        );
      },
    },
  ],
  test: { include: ["tests/**/*.test.ts"] },
} as Parameters<typeof defineConfig>[0]);
