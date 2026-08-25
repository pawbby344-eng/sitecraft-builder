import type { NextFunction, Request, RequestHandler, Response } from "express";
import { randomUUID } from "node:crypto";

const REQUEST_ID_HEADER = "x-request-id";
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

function getOrCreateRequestId(value: unknown): string {
  return typeof value === "string" && REQUEST_ID_PATTERN.test(value)
    ? value
    : randomUUID();
}

export const requestContextMiddleware: RequestHandler = (
  request: Request,
  response: Response,
  next: NextFunction,
) => {
  const requestId = getOrCreateRequestId(request.get(REQUEST_ID_HEADER));
  request.requestId = requestId;
  response.setHeader(REQUEST_ID_HEADER, requestId);
  next();
};

function getSafeProjectId(input: unknown): number | undefined {
  if (!input || typeof input !== "object" || !("projectId" in input)) return undefined;
  const projectId = (input as { projectId?: unknown }).projectId;
  return typeof projectId === "number" && Number.isSafeInteger(projectId) ? projectId : undefined;
}

export type StructuredErrorMeta = {
  requestId: string;
  route: string;
  projectId?: number;
  userId?: number;
  errorType: string;
  timestamp: string;
};

export function logStructuredServerError(
  meta: Omit<StructuredErrorMeta, "timestamp"> & { error?: unknown },
): void {
  const errorType =
    meta.errorType ||
    (meta.error instanceof Error ? meta.error.name : "UnknownError");
  const entry: StructuredErrorMeta = {
    requestId: meta.requestId,
    route: meta.route,
    ...(meta.projectId === undefined ? {} : { projectId: meta.projectId }),
    ...(meta.userId === undefined ? {} : { userId: meta.userId }),
    errorType,
    timestamp: new Date().toISOString(),
  };
  console.error(JSON.stringify(entry));
}

export function getProjectIdForLog(input: unknown): number | undefined {
  return getSafeProjectId(input);
}

export { REQUEST_ID_HEADER };
