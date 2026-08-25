# Stage 7 QA Evidence

## Browser

Authenticated Manus session успешно открылась в SiteCraft Workspace. На `/` отображается EmptyWorkspace: проектов нет, предлагается создать проект через IDEA → Brief → SiteSpec → Build, но в текущем UI нет формы или кнопки Create Project/IDEA. Маршрут `/home` содержит только шаблон Example Page / Example Button и не является architect flow. App.tsx регистрирует только `/`, `/home`, `/404` и fallback.

## Baseline command attempt

Команда `pnpm check && pnpm test && pnpm build` на 2026-08-25 завершилась с FAIL на `server/publish.integration.test.ts`: тест `publishes Preview-compatible Draft and serves home and additional page from snapshot` превысил 5000 ms, а `afterAll` hook — 10000 ms. Остальные 7 test files и 32 tests прошли в этой попытке. Это отличается от предыдущего Stage 6 PASS и требует отдельной проверки как возможный timing/resource regression; код пока не менялся.

## Scope

Stage 7 не добавляет функций. До устранения/классификации этих blockers полный E2E release verdict нельзя объявлять PASS.

## Responsive UI

Authenticated desktop Workspace открывается без видимого horizontal overflow; empty state и user menu отображаются. Mobile viewport 390x844 также не разваливается: navigation header и empty workspace остаются в пределах экрана, горизонтального overflow визуально не обнаружено. Поля редактора, Save, AI, locks и Publish проверить невозможно, потому что authenticated workspace содержит 0 проектов и production UI не предоставляет Create Project/IDEA.

## Isolated publish retry

Повторный `pnpm vitest run server/publish.integration.test.ts --reporter=verbose` прошёл: 1 file, 5 tests, exit code 0. Предыдущий timeout при полном suite не воспроизведён в изолированном запуске.

## Renderer parity

Добавлена QA-проверка, которая строит canonical Draft snapshot через production read path, рендерит его shared renderer и сравнивает результат с HTML, возвращённым public Express route. Проверка прошла exact equality. Исправлена только ошибка теста с повторным чтением уже consumed Response body; runtime-код не менялся.

## Regression gates

Полный `pnpm test` после isolated publish retry прошёл: 8 файлов, 33 теста. Он покрывает Stage 3 ownership/conflict/persistence, Stage 4 editor save/reload/conflict, Stage 5 proposal/locks/atomicity и Stage 6 publish/isolation/routes/schemaVersion.

## Session recovery check

В текущей authenticated session повторный переход на `/` стабильно возвращает Workspace и owner identity. Визуальная попытка открыть user menu через annotated control не раскрыла меню в capture; Sign out/Login recovery therefore remains unverified in this browser run. Это не меняет основной blocker: пустой Workspace не содержит production Create Project/IDEA entry point.

## Browser logs

После authenticated desktop/mobile QA в `.manus-logs/browserConsole.log` не найдено строк с error/exception/failed/uncaught, а в `networkRequests.log` нет записей со статусами 4xx/5xx. Это подтверждает отсутствие зафиксированных blocking client/network ошибок на проверенном empty Workspace path, но не заменяет проверку controls внутри non-empty editor.

## Production UI entry point E2E

После авторизации production `/` показал Create Project form. Через браузер без прямых DB/router вызовов заполнены project name, globally unique slug и IDEA; Create project успешно создал проект и автоматически вызвал создание Brief. На экране открылась Review the Brief с editable audience/value proposition/tone/primary goal и Confirm Brief control.

## Blocker fix E2E continuation

Через production UI Brief был вручную изменён и подтверждён. Существующие handlers после подтверждения сгенерировали валидный SiteSpec; UI показал `1 page(s) · 2 section(s)` и кнопку `Confirm SiteSpec & Build Draft`. Прямых DB/router вызовов в browser flow не использовалось.

## New blocker after entry-point Build

Через production UI Create Project → Brief edit → Confirm Brief → SiteSpec → Confirm SiteSpec & Build Draft прошёл. После успешного Build при переходе к Workspace React ErrorBoundary показывает `ZodError at renderSiteHtml`, вызванный `Workspace` при построении `previewSnapshot`. Полный UI E2E остановлен на этом конкретном runtime regression; прямых DB/router вызовов не использовалось.

## Renderer regression fix verification

После нормализации strict Preview snapshot повторная загрузка authenticated Workspace прошла без ZodError. Production UI открыл текущий Visual Editor с `Stage 7 Atelier`, Draft revision 2, двумя sections и content blocks. Это подтверждает, что blocker был точечно устранён в client-side snapshot mapping.

Visual Editor is functional after the fix. The first selection click targeted the surrounding section rather than the headline, so no AI mutation was triggered; Draft remained unchanged.

## Production UI entry point and AI proposal E2E

The minimal production entry point created `Stage 7 Atelier`, accepted a manually edited Brief, confirmed SiteSpec, and built Draft. After the renderer fix, the Visual Editor loaded successfully. Through UI-only interaction, a block-scoped manual AI Proposal was generated with one validated change, remained pending before Apply, and was then applied. Draft revision advanced from 2 to 3 and the headline changed; pending proposal count returned to 0.

## Publish and public route E2E

Publish completed through the production UI. The UI switched to Published mode and exposed `/site/stage7-atelier`. Opening that public URL showed the updated headline and all generated page content, confirming the public route reads the published snapshot.

## Draft change after Publish

The Draft headline was changed and saved through the Visual Editor, advancing Draft revision 3 → 4. Without Re-publish, the public URL continued to show the previously published headline from revision 3. Snapshot isolation PASS.

## Re-publish E2E

Re-publish completed through the production UI. The public URL then changed from the revision 3 headline to `A private draft change after publishing`, confirming the new immutable published snapshot became live only after explicit Re-publish.

## Unpublish E2E

Unpublish completed through the production UI. The Workspace switched back to Draft-only mode while the public URL returned `Not found`. The Draft content remained present in the authenticated editor.

## Reload/new authenticated session and lock

After the clean build and dev-server restart, a new browser load remained authenticated and restored `Stage 7 Atelier`, page `Главная`, Draft revision 4, and the saved headline. The selected headline block was then locked through the UI; the control changed to `Unlock` and the UI displayed `Scope locked`.

## Reload, lock and responsive Preview

After the clean build and server restart, the authenticated browser reload restored the project and Draft revision 4. The headline block was locked through the UI and displayed `Scope locked`. Draft Preview opened in read-only mode, and switching to mobile viewport rendered the Draft content without changing revision or save state.

## Final release gates

Full UI-only flow completed: authenticated session → Create Project → IDEA → manual Brief edit → Confirm Brief → Confirm SiteSpec & Build Draft → Visual Editor → block-scoped AI Proposal → Apply → lock → Draft Preview desktop/mobile → Publish → Draft edit → public unchanged → Re-publish → public updated → Unpublish → public `Not found`.

After closing the browser and restarting the dev server, a fresh browser load restored the authenticated project, page, saved Draft revision 4 and headline. `pnpm test` passed with 8 files and 33 tests; `pnpm check` passed. The first build attempt exited 143 while computing gzip under high memory pressure; after closing the browser and stopping watch processes, the ordinary `pnpm build` passed: Vite built in 8.91s and esbuild completed in 14ms. No build configuration was changed.

## Pre-Migration Hardening browser audit

2026-08-25: authenticated Workspace loaded at `/`; existing project `Stage 7 Atelier` visible; `Create new project` control visible; Draft revision 4 loaded; AI Local Edit, Preview and Publish controls visible. No browser operation was used to call DB or router directly.

Pre-Migration Hardening browser E2E continuation: in a non-empty authenticated Workspace, `Create new project` opened the production ProjectBuilder. A new project name, unique slug and IDEA were entered through visible UI controls successfully.

Pre-Migration Hardening browser E2E: Create Project succeeded through the production UI; the existing architect handler opened `Review the Brief` with editable audience/value proposition/tone/primary goal and `Confirm Brief`. No direct DB/router call was used.

Pre-Migration Hardening browser E2E: Brief was edited manually in the production UI and `Confirm Brief` submitted successfully; the existing architect flow proceeded to SiteSpec generation.

Pre-Migration Hardening browser E2E: Brief was edited manually in the production UI and Confirm Brief submitted successfully; the existing architect flow proceeded to SiteSpec generation.

Pre-Migration Hardening browser blocker closure: after the renderer guard and editor-state reset, selecting Hardening Atelier 2026 no longer throws ZodError. The UI shows Select a page and Draft revision 1, an empty canvas message, and no blocks from Stage 7 Atelier.
