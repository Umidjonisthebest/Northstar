// The whole backend as one Netlify Function: see backend/netlify.js.
//
// The backend is loaded by address, not with a plain `import "../../backend/netlify.js"`. Netlify
// merges every file a function imports that way into this one file, which moved the backend's code
// away from its own node_modules and data files: nothing could be found and every call answered
// 502. Loaded like this, the backend folder is shipped as it is (`included_files` in netlify.toml)
// and runs from where it sits.
const backend = import(new URL("../../backend/netlify.js", import.meta.url).href);

export default async (req, context) => (await backend).default(req, context);

// Pictures of bank questions are published as plain files under /api/bank-media (see
// tools/netlify/static.mjs), so that address is left to the CDN. (Not `preferStatic`: with it the
// "/* -> /index.html" page rule counted as a file and took every API call: sign-in answered 404.)
export const config = {
  path: ["/api/*", "/uploads/*"],
  excludedPath: ["/api/bank-media/*"]
};
