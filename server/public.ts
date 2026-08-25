import type { Express, Request, Response } from "express";
import { getPublicSnapshot } from "./publish";
import { renderSiteHtml } from "../shared/site-engine/renderer";
import { logStructuredServerError } from "./_core/request-context";

function sendPublicPage(request: Request, response: Response) {
  getPublicSnapshot({ projectSlug: request.params.projectSlug, pageSlug: request.params.pageSlug })
    .then((snapshot) => response.type("html").send(renderSiteHtml(snapshot, request.params.pageSlug)))
    .catch((error: unknown) => {
      logStructuredServerError({
        requestId: request.requestId ?? "missing-request-id",
        route: `${request.method} ${request.path}`,
        errorType: error instanceof Error ? error.name : "PublicRouteError",
        error,
      });
      response.status(404).send("Not found");
    });
}

export function registerPublicRoutes(app: Express) {
  app.get("/site/:projectSlug", sendPublicPage);
  app.get("/site/:projectSlug/:pageSlug", sendPublicPage);
}
