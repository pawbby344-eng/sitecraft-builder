import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ErrorBoundary from "../client/src/components/ErrorBoundary";
import { SAFE_ERROR_MESSAGE, getSafeErrorMessage } from "../shared/safe-error";

describe("production ErrorBoundary safety", () => {
  it("returns only a generic message for internal errors", () => {
    const internalError = new Error("/srv/app/server-secret.ts: database password=should-not-render");
    const state = ErrorBoundary.getDerivedStateFromError(internalError);
    const boundary = new ErrorBoundary({ children: null });
    boundary.state = state;

    const html = renderToStaticMarkup(boundary.render() as React.ReactElement);

    expect(getSafeErrorMessage(internalError)).toBe(SAFE_ERROR_MESSAGE);
    expect(html).toContain(SAFE_ERROR_MESSAGE);
    expect(html).not.toContain("server-secret.ts");
    expect(html).not.toContain("database password");
    expect(html).not.toContain("Error:");
    expect(html).not.toContain("<pre");
  });
});
