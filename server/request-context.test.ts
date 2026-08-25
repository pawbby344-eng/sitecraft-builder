import type { Request, Response } from "express";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getProjectIdForLog,
  logStructuredServerError,
  requestContextMiddleware,
} from "./_core/request-context";

describe("request correlation and structured errors", () => {
  afterEach(() => vi.restoreAllMocks());

  it("preserves a safe inbound request id and exposes it on the response", () => {
    const setHeader = vi.fn();
    const request = {
      get: vi.fn().mockReturnValue("browser-tab-42"),
    } as unknown as Request;
    const response = { setHeader } as unknown as Response;
    const next = vi.fn();

    requestContextMiddleware(request, response, next);

    expect(request.requestId).toBe("browser-tab-42");
    expect(setHeader).toHaveBeenCalledWith("x-request-id", "browser-tab-42");
    expect(next).toHaveBeenCalledOnce();
  });

  it("replaces malformed inbound ids with a generated correlation id", () => {
    const setHeader = vi.fn();
    const request = {
      get: vi.fn().mockReturnValue("request id with spaces\nsecret-token"),
    } as unknown as Request;
    const response = { setHeader } as unknown as Response;

    requestContextMiddleware(request, response, vi.fn());

    expect(request.requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(setHeader).toHaveBeenCalledWith("x-request-id", request.requestId);
  });

  it("logs only correlated safe metadata and never raw error content", () => {
    const error = new Error("raw customer content and token=do-not-log");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    logStructuredServerError({
      requestId: "req-123",
      route: "architect.applySiteSpec",
      projectId: 17,
      userId: 9,
      errorType: "TRPCError",
      error,
    });

    const line = String(errorSpy.mock.calls[0]?.[0]);
    const entry = JSON.parse(line) as Record<string, unknown>;
    expect(entry).toMatchObject({
      requestId: "req-123",
      route: "architect.applySiteSpec",
      projectId: 17,
      userId: 9,
      errorType: "TRPCError",
    });
    expect(entry.timestamp).toEqual(expect.any(String));
    expect(line).not.toContain("raw customer content");
    expect(line).not.toContain("do-not-log");
    expect(line).not.toContain("token");
  });

  it("extracts only a safe numeric projectId from procedure input", () => {
    expect(getProjectIdForLog({ projectId: 17, instruction: "private content" })).toBe(17);
    expect(getProjectIdForLog({ projectId: "17" })).toBeUndefined();
    expect(getProjectIdForLog({ instruction: "private content" })).toBeUndefined();
  });
});
