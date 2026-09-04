const DEFAULTS = {
  WS_PATH: "/ws",
  COVER_MODE: "inline",
  SITE_NAME: "Software Mirror",
  ROBOTS: "disallow",
};

export default {
  async fetch(request, env) {
    const cfg = readConfig(env);
    const url = new URL(request.url);
    const host = url.hostname;
    const path = normalizePath(url.pathname);
    const upgrade = (request.headers.get("Upgrade") || "").toLowerCase();

    if (cfg.allowedHosts.length && !cfg.allowedHosts.includes(host)) {
      return text("Not Found", 404);
    }

    if (isWsPath(path, cfg.wsPath)) {
      if (upgrade !== "websocket") return text("Not Found", 404);
      if (!cfg.originHost) return text("ORIGIN_HOST is not set", 502);
      const originUrl = new URL(request.url);
      originUrl.protocol = "https:";
      originUrl.hostname = cfg.originHost;
      originUrl.port = "";
      originUrl.pathname = path;
      return fetch(new Request(originUrl.toString(), request));
    }

    if (cfg.coverMode === "origin") {
      if (!cfg.coverHost) return text("COVER_HOST is not set", 502);
      const coverUrl = new URL(request.url);
      coverUrl.protocol = "https:";
      coverUrl.hostname = cfg.coverHost;
      coverUrl.port = "";
      return fetch(new Request(coverUrl.toString(), request));
    }

    return serveInline(path, url.origin, cfg);
  },
};

function readConfig(env) {
  const wsPath = normalizePath(env.WS_PATH || DEFAULTS.WS_PATH);
  const coverMode = (env.COVER_MODE || DEFAULTS.COVER_MODE).toLowerCase();
  return {
    originHost: (env.ORIGIN_HOST || "").trim().replace(/^https?:\/\//, "").replace(/\/.*$/, ""),
    wsPath,
    coverMode: coverMode === "origin" ? "origin" : "inline",
    coverHost: (env.COVER_HOST || "").trim().replace(/^https?:\/\//, "").replace(/\/.*$/, ""),
    siteName: env.SITE_NAME || DEFAULTS.SITE_NAME,
    robots: (env.ROBOTS || DEFAULTS.ROBOTS).toLowerCase() === "allow" ? "allow" : "disallow",
    allowedHosts: splitHosts(env.ALLOWED_HOSTS),
  };
}

function splitHosts(raw) {
  if (!raw) return [];
  return raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
}

function normalizePath(p) {
  if (!p || p === "") return "/";
  let out = p.startsWith("/") ? p : `/${p}`;
  if (out.length > 1 && out.endsWith("/")) out = out.slice(0, -1);
  return out;
}

function isWsPath(path, wsPath) {
  return path === wsPath || path.startsWith(`${wsPath}/`);
}

function text(body, status = 200, type = "text/plain; charset=utf-8") {
  return new Response(body, { status, headers: { "content-type": type } });
}

function html(body, status = 200) {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });
}

function serveInline(path, origin, cfg) {
  const routes = {
    "/": () => pageHome(cfg),
    "/docs": () => pageDocs(cfg),
    "/releases": () => pageReleases(cfg),
    "/about": () => pageAbout(cfg),
    "/status": () => pageStatus(cfg),
    "/static/style.css": () =>
      text(css(), 200, "text/css; charset=utf-8"),
    "/favicon.svg": () =>
      text(logoSvg(cfg.siteName), 200, "image/svg+xml; charset=utf-8"),
    "/logo.svg": () =>
      text(logoSvg(cfg.siteName), 200, "image/svg+xml; charset=utf-8"),
    "/robots.txt": () => text(robotsTxt(origin, cfg), 200, "text/plain; charset=utf-8"),
    "/sitemap.xml": () => text(sitemapXml(origin), 200, "application/xml; charset=utf-8"),
  };

  const hit = routes[path];
  if (hit) return path.endsWith(".css") || path.endsWith(".svg") || path.endsWith(".txt") || path.endsWith(".xml")
    ? hit()
    : html(hit());
  return html(pageNotFound(cfg), 404);
}

function layout(cfg, title, content) {
  const name = escapeHtml(cfg.siteName);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} · ${name}</title>
  <meta name="description" content="${name} public software index and documentation.">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/static/style.css">
</head>
<body>
  <header class="top">
    <a class="brand" href="/">
      <img src="/logo.svg" width="36" height="36" alt="">
      <span>${name}</span>
    </a>
    <nav>
      <a href="/">Home</a>
      <a href="/docs">Docs</a>
      <a href="/releases">Releases</a>
      <a href="/status">Status</a>
      <a href="/about">About</a>
    </nav>
  </header>
  <main>${content}</main>
  <footer>
    <p>${name} · community mirror index · not affiliated with any university</p>
  </footer>
</body>
</html>`;
}

function pageHome(cfg) {
  return layout(cfg, "Home", `
    <section class="hero">
      <h1>${escapeHtml(cfg.siteName)}</h1>
      <p>Public index for commonly used open-source packages, checksums, and docs. HTTPS only.</p>
    </section>
    <section class="grid">
      <article><h2>Documentation</h2><p>Sync policy, path layout, and client usage.</p><a href="/docs">Open docs</a></article>
      <article><h2>Releases</h2><p>Recent snapshot list and SHA256 files.</p><a href="/releases">Browse releases</a></article>
      <article><h2>Status</h2><p>Node health and last successful sync.</p><a href="/status">View status</a></article>
    </section>
    <section>
      <h2>Popular prefixes</h2>
      <table>
        <thead><tr><th>Path</th><th>Project</th><th>Updated</th></tr></thead>
        <tbody>
          <tr><td>/debian/</td><td>Debian</td><td>daily</td></tr>
          <tr><td>/ubuntu/</td><td>Ubuntu</td><td>daily</td></tr>
          <tr><td>/alpine/</td><td>Alpine Linux</td><td>daily</td></tr>
          <tr><td>/github/</td><td>GitHub release cache</td><td>on demand</td></tr>
        </tbody>
      </table>
    </section>`);
}

function pageDocs(cfg) {
  return layout(cfg, "Docs", `
    <h1>Documentation</h1>
    <h2>Layout</h2>
    <p>Content is grouped by distribution name. Use HTTPS and verify checksums before install.</p>
    <pre>/${escapeHtml(cfg.siteName).toLowerCase().replace(/\s+/g, "-")}/
  debian/
  ubuntu/
  alpine/
  github/</pre>
    <h2>Clients</h2>
    <ul>
      <li>apt: set a signed mirror list, then <code>apt update</code></li>
      <li>apk: point <code>/etc/apk/repositories</code> at the alpine prefix</li>
      <li>curl: always download the matching <code>.sha256</code> file</li>
    </ul>`);
}

function pageReleases(cfg) {
  return layout(cfg, "Releases", `
    <h1>Releases</h1>
    <table>
      <thead><tr><th>Artifact</th><th>Size</th><th>SHA256</th></tr></thead>
      <tbody>
        <tr><td>debian-12.11.0-amd64-netinst.iso</td><td>760 MB</td><td>a3f1…c90e</td></tr>
        <tr><td>alpine-minirootfs-3.20.3-x86_64.tar.gz</td><td>3.2 MB</td><td>11c2…88ab</td></tr>
        <tr><td>go1.24.5.linux-amd64.tar.gz</td><td>69 MB</td><td>9e40…12dd</td></tr>
      </tbody>
    </table>
    <p class="note">Checksums are illustrative index data for this front page.</p>`);
}

function pageAbout(cfg) {
  return layout(cfg, "About", `
    <h1>About</h1>
    <p>${escapeHtml(cfg.siteName)} is a small public index used to publish mirror documentation and release notes.</p>
    <p>It is an independent project and does not represent any university, vendor, or CDN brand.</p>`);
}

function pageStatus(cfg) {
  const now = new Date().toISOString();
  return layout(cfg, "Status", `
    <h1>Status</h1>
    <ul class="ok">
      <li>Edge: up</li>
      <li>HTTPS: enabled</li>
      <li>Last rendered: ${escapeHtml(now)}</li>
    </ul>`);
}

function pageNotFound(cfg) {
  return layout(cfg, "Not found", `
    <h1>404</h1>
    <p>No such path. See <a href="/docs">docs</a> or <a href="/">home</a>.</p>`);
}

function css() {
  return `
:root { --bg:#0f1419; --card:#1a222c; --fg:#e8eef4; --muted:#9aa8b6; --acc:#3d9cf0; }
* { box-sizing:border-box; }
body { margin:0; font:16px/1.55 system-ui,sans-serif; background:var(--bg); color:var(--fg); }
.top { display:flex; justify-content:space-between; align-items:center; padding:1rem 1.5rem; background:#0b1015; }
.brand { display:flex; gap:.6rem; align-items:center; color:var(--fg); text-decoration:none; font-weight:650; }
nav a { color:var(--muted); margin-left:1rem; text-decoration:none; }
nav a:hover { color:var(--fg); }
main { max-width:960px; margin:0 auto; padding:2rem 1.5rem 4rem; }
.hero { margin-bottom:2rem; }
.grid { display:grid; gap:1rem; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); }
article { background:var(--card); padding:1rem 1.1rem; border-radius:12px; }
a { color:var(--acc); }
table { width:100%; border-collapse:collapse; }
th,td { text-align:left; padding:.55rem .4rem; border-bottom:1px solid #2a3542; }
pre,code { background:#0b1015; padding:.15rem .35rem; border-radius:6px; }
pre { padding:1rem; overflow:auto; }
footer { color:var(--muted); text-align:center; padding:2rem; }
.note,.ok { color:var(--muted); }
`;
}

function logoSvg(name) {
  const letter = escapeHtml((name || "S").trim().charAt(0).toUpperCase() || "S");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <rect width="64" height="64" rx="14" fill="#3d9cf0"/>
  <text x="32" y="42" text-anchor="middle" font-size="28" font-family="system-ui,sans-serif" fill="#0b1015" font-weight="700">${letter}</text>
</svg>`;
}

function robotsTxt(origin, cfg) {
  if (cfg.robots === "allow") {
    return `User-agent: *\nAllow: /\nDisallow: ${cfg.wsPath}\nSitemap: ${origin}/sitemap.xml\n`;
  }
  return `User-agent: *\nDisallow: /\n`;
}

function sitemapXml(origin) {
  const paths = ["/", "/docs", "/releases", "/about", "/status"];
  const urls = paths
    .map((p) => `  <url><loc>${origin}${p === "/" ? "/" : p}</loc></url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
