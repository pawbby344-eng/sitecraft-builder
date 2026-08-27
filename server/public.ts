import type { Express, Request, Response } from "express";
import { getPublicSnapshot } from "./publish";
import { renderSiteHtml } from "../shared/site-engine/renderer";
import { logStructuredServerError } from "./_core/request-context";

function renderPublicNotFound() {
  return `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Сайт недоступен · SiteCraft</title>
    <style>
      :root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      * { box-sizing: border-box; }
      body { min-height: 100vh; margin: 0; display: grid; place-items: center; padding: 24px; color: #0f172a; background: #f7f8fa; }
      main { width: min(100%, 560px); padding: clamp(32px, 7vw, 64px); text-align: center; background: #fff; border: 1px solid #e2e8f0; border-radius: 24px; box-shadow: 0 18px 60px rgba(15, 23, 42, 0.08); }
      .mark { width: 48px; height: 48px; margin: 0 auto 24px; display: grid; place-items: center; color: #fff; background: #020617; border-radius: 16px; font-weight: 700; letter-spacing: -.04em; }
      .eyebrow { margin: 0 0 12px; color: #94a3b8; font-size: 11px; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; }
      h1 { margin: 0; font-size: clamp(28px, 5vw, 42px); line-height: 1.08; letter-spacing: -.04em; }
      p { margin: 16px auto 0; max-width: 34rem; color: #64748b; font-size: 16px; line-height: 1.6; }
      a { display: inline-flex; min-height: 44px; align-items: center; justify-content: center; margin-top: 28px; padding: 0 20px; color: #fff; background: #020617; border-radius: 12px; font-size: 14px; font-weight: 600; text-decoration: none; }
      a:hover { background: #1e293b; }
      a:focus-visible { outline: 3px solid #fbbf24; outline-offset: 3px; }
    </style>
  </head>
  <body>
    <main aria-labelledby="public-not-found-title">
      <div class="mark" aria-hidden="true">SC</div>
      <p class="eyebrow">Публичный сайт SiteCraft</p>
      <h1 id="public-not-found-title">Этот сайт недоступен</h1>
      <p>Страница могла быть снята с публикации, перемещена или больше не существует.</p>
      <a href="/">Вернуться в SiteCraft</a>
    </main>
  </body>
</html>`;
}

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
      response.status(404).type("html").send(renderPublicNotFound());
    });
}

export function registerPublicRoutes(app: Express) {
  app.get("/site/:projectSlug", sendPublicPage);
  app.get("/site/:projectSlug/:pageSlug", sendPublicPage);
}
