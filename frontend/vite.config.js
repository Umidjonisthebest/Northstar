import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

// BACKEND_URL and VITE_PORT let a second pair of dev servers run beside the usual one (for example
// a backend started on a copy of the database: see "northstar-*-copy" in ../../.claude/launch.json).
const backend = { target: process.env.BACKEND_URL || "http://localhost:4000", changeOrigin: true };

// Production build only (the dev server needs inline scripts for hot reload):
//  - a content security policy for the pages: scripts only from this site, fonts self-hosted, no
//    plugins, no outside forms. `frame-ancestors` can't be set from a <meta> tag; set it as a header
//    (Content-Security-Policy: frame-ancestors 'none') on the host that serves these files.
//  - absolute address for the social preview image when APP_URL is set (link scrapers ignore relative ones).
//  - the one outside site is Desmos, for the graphing calculator on Math questions
//    (src/components/calculator). Without a key it is Desmos's own page in a frame. With
//    VITE_DESMOS_API_KEY set, Desmos's script runs in our pages instead, so scripts, its
//    workers (blob:), its fonts (data:) and its requests are allowed from desmos.com too.
function productionHtml(desmosKey) {
  const desmos = "https://www.desmos.com";
  const csp = [
    "default-src 'self'",
    `script-src 'self'${desmosKey ? ` ${desmos}` : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    `font-src 'self'${desmosKey ? " data:" : ""}`,
    "media-src 'self' blob:",
    `connect-src 'self'${desmosKey ? " https://*.desmos.com" : ""}`,
    ...(desmosKey ? ["worker-src 'self' blob:"] : []),
    `frame-src ${desmos}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join("; ");
  const appUrl = (process.env.APP_URL || "").trim().replace(/\/+$/, "");
  return {
    name: "northstar-production-html",
    apply: "build",
    transformIndexHtml(html) {
      let out = html.replace("<head>", `<head>\n    <meta http-equiv="Content-Security-Policy" content="${csp}" />`);
      if (appUrl) out = out.replaceAll('content="/social-preview.png"', `content="${appUrl}/social-preview.png"`);
      return out;
    }
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), productionHtml((loadEnv(mode, process.cwd(), "VITE_").VITE_DESMOS_API_KEY || "").trim())],
  server: {
    port: Number(process.env.VITE_PORT) || 5173,
    proxy: {
      "/api": backend,
      // IELTS audio/image uploads and the bundled starter-test assets
      "/uploads": backend,
      "/ielts-assets": backend
    }
  }
}));
