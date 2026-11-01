import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { resolve, extname, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { projectRoot, readSettings } from "../read-settings.js";
import { handleJobRoutes, sendJson } from "./routes/job-routes.js";

export function createJobServer(
  databasePath: string,
  uiRoot = resolve(projectRoot, "dist/ui"),
) {
  return createServer((request, response) => {
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Referrer-Policy", "no-referrer");
    response.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'",
    );
    let url: URL;
    try {
      url = new URL(request.url || "/", "http://127.0.0.1");
    } catch {
      sendJson(response, 400, { code: "invalid_url", message: "Invalid URL." });
      return;
    }
    if (url.pathname.startsWith("/api/")) {
      handleJobRoutes(request, response, url, databasePath);
      return;
    }
    if (!["GET", "HEAD"].includes(request.method || "")) {
      response.writeHead(405).end();
      return;
    }
    // Only the built index and its assets are public, never the repository or runtime directory.
    if (
      url.pathname !== "/" &&
      url.pathname !== "/index.html" &&
      !url.pathname.startsWith("/assets/")
    ) {
      response.writeHead(404).end("Not found");
      return;
    }
    try {
      const file = resolve(
        uiRoot,
        `.${decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname)}`,
      );
      if (!file.startsWith(resolve(uiRoot) + sep)) {
        response.writeHead(404).end("Not found");
        return;
      }
      const mime: Record<string, string> = {
        ".html": "text/html",
        ".js": "text/javascript",
        ".css": "text/css",
        ".svg": "image/svg+xml",
      };
      const body = readFileSync(file);
      response.writeHead(200, {
        "Content-Type": `${mime[extname(file)] || "application/octet-stream"}; charset=utf-8`,
      });
      response.end(request.method === "HEAD" ? undefined : body);
    } catch {
      response.writeHead(404).end("UI not built. Run npm run build.");
    }
  });
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const settings = readSettings();
  const server = createJobServer(settings.databasePath);
  server.listen(settings.port, "127.0.0.1", () =>
    console.log(`Job Radar: http://127.0.0.1:${settings.port}`),
  );
  server.on("error", () => {
    console.error(
      "Cannot start server. Check whether the configured port is already in use.",
    );
    process.exitCode = 1;
  });
  for (const signal of ["SIGINT", "SIGTERM"] as const)
    process.on(signal, () => server.close());
}
