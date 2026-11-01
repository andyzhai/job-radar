import type { IncomingMessage, ServerResponse } from "node:http";
import {
  openReadonlyDatabase,
  DatabaseUnavailable,
} from "../database/open-readonly-database.js";
import { searchJobs, type JobQuery } from "../database/search-jobs.js";
import { getJobDetails } from "../database/get-job-details.js";

class InvalidQuery extends Error {}

export function parseJobQuery(params: URLSearchParams): JobQuery {
  for (const key of params.keys()) {
    if (!["keywords", "source", "limit", "offset"].includes(key))
      throw new InvalidQuery(`Unknown filter: ${key}`);
    if (key !== "source" && params.getAll(key).length > 1)
      throw new InvalidQuery(`Repeated filter: ${key}`);
  }
  const keywords = (params.get("keywords") || "").trim();
  if (keywords.length > 200)
    throw new InvalidQuery("Keywords must be at most 200 characters.");
  const integer = (
    name: string,
    fallback: number,
    min: number,
    max: number,
  ) => {
    const value = params.get(name);
    if (value === null) return fallback;
    if (!/^\d+$/.test(value) || Number(value) < min || Number(value) > max)
      throw new InvalidQuery(`Invalid ${name}.`);
    return Number(value);
  };
  const sources = [...new Set(params.getAll("source"))];
  if (sources.some((s) => !/^(indeed|linkedin|company:[a-z0-9-]+)$/.test(s)))
    throw new InvalidQuery("Invalid source.");
  return {
    keywords,
    sources,
    limit: integer("limit", 25, 1, 100),
    offset: integer("offset", 0, 0, 1_000_000),
  };
}

export function sendJson(
  response: ServerResponse,
  status: number,
  value: unknown,
) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(value));
}

export function handleJobRoutes(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  databasePath: string,
) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    sendJson(response, 405, {
      code: "method_not_allowed",
      message: "This API is read-only.",
    });
    return;
  }
  if (
    !["/api/jobs", "/api/health"].includes(url.pathname) &&
    !/^\/api\/jobs\/[1-9]\d*$/.test(url.pathname)
  ) {
    sendJson(response, 404, {
      code: "not_found",
      message: "Endpoint not found.",
    });
    return;
  }
  try {
    const query =
      url.pathname === "/api/jobs" ? parseJobQuery(url.searchParams) : null;
    if (!query && url.search)
      throw new InvalidQuery("This endpoint does not accept filters.");
    const db = openReadonlyDatabase(databasePath);
    try {
      if (query) sendJson(response, 200, searchJobs(db, query));
      else if (url.pathname === "/api/health")
        sendJson(response, 200, { status: "ready", schemaVersion: 1 });
      else {
        const id = Number(url.pathname.split("/").at(-1));
        const job = Number.isSafeInteger(id) ? getJobDetails(db, id) : null;
        sendJson(
          response,
          job ? 200 : 404,
          job || { code: "not_found", message: "Job not found." },
        );
      }
    } finally {
      db.close();
    }
  } catch (error) {
    if (error instanceof InvalidQuery)
      sendJson(response, 400, {
        code: "invalid_query",
        message: error.message,
      });
    else if (error instanceof DatabaseUnavailable)
      sendJson(response, 503, {
        code: "database_unavailable",
        message: error.message,
      });
    else
      sendJson(response, 500, {
        code: "server_error",
        message: "Could not read saved jobs.",
      });
  }
}
