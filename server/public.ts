import type { Express, Request, Response } from "express";
import { getPublicSnapshot } from "./publish";
import { renderSiteHtml } from "../shared/site-engine/renderer";

function sendPublicPage(request: Request, response: Response) {
  getPublicSnapshot({ projectSlug: request.params.projectSlug, pageSlug: request.params.pageSlug })
    .then((snapshot) => response.type("html").send(renderSiteHtml(snapshot, request.params.pageSlug)))
    .catch(() => response.status(404).send("Not found"));
}

export function registerPublicRoutes(app: Express) {
  app.get("/site/:projectSlug", sendPublicPage);
  app.get("/site/:projectSlug/:pageSlug", sendPublicPage);
}
