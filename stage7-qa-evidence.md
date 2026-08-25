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
