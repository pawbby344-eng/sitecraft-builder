# PRA-002 — Security Review

## Резюме

По локально проверенной поверхности критических уязвимостей не выявлено. Сильные стороны — отсутствие найденных credential literals, `.env` в `.gitignore`, уже реализованные image URL и CSS/theme hardening из release evidence. Production security posture оценивается как **частично подтверждённая**, потому что HTTP security headers не обнаружены, Express body limits составляют 50 MB, а dependency CVE audit не завершился: `pnpm audit --prod --json` завис на сетевом вызове и был остановлен.

## Поверхность атаки

Приложение имеет tRPC API под `/api/trpc`, OAuth callback, public published-site routes, storage proxy и server-side storage integration. `server/_core/index.ts:35-47` принимает JSON/urlencoded payloads до 50 MB и регистрирует эти поверхности. `server/public.ts` обслуживает публичные `/site/:projectSlug` маршруты.

## Сильные стороны

| Evidence | Вывод |
|---|---|
| `.gitignore` содержит `.env`, локальные env-файлы, ключевые runtime/backup extensions | Базовые локальные secrets и временные артефакты не должны попадать в version control. |
| Локальный поиск по source не обнаружил private-key/API-key literal patterns | В проверенных файлах не найдено очевидных credentials. Это не заменяет secret scanner в CI. |
| `shared/site-engine/schemas.ts` и hardening evidence | Image URL allowlist и CSS/theme-context validation уже покрыты regression tests. |
| `server/storage.ts:36-71` | Storage upload идёт через presigned URL и hashed key suffix; прямого user-controlled filesystem write в public directory не обнаружено. |

## Уязвимости и ограничения

### Критические

Не выявлены по доступным локальным evidence.

### Высокие

Не выявлены по доступным локальным evidence.

### Средние

#### M-002-1. Security headers не обнаружены

**Evidence:** локальный поиск `server/` и `client/` не нашёл CSP, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` или HSTS; `server/_core/index.ts:32-54` регистрирует Express middleware без видимой header middleware.

**Impact:** защита от clickjacking, MIME sniffing, небезопасных referrer и части browser-side injection risks не подтверждена на application layer.

**Recommendation:** добавить production-appropriate security headers на deployment boundary или в Express, затем проверить фактический HTTP response.

#### M-002-2. Большой общий body limit

**Evidence:** `server/_core/index.ts:35-37` устанавливает `50mb` для JSON и urlencoded body, хотя отдельного application upload endpoint в текущем product surface не обнаружено.

**Impact:** неоправданно большая поверхность для resource exhaustion на API requests.

**Recommendation:** уменьшить лимит до фактически необходимого для SiteCraft payloads либо ограничить крупные payloads отдельным endpoint.

#### M-002-3. Storage key normalisation не является полноценной filename policy

**Evidence:** `server/storage.ts:20-28` удаляет только ведущие `/` и добавляет hash suffix; `..`, control characters и path-like segments явно не валидируются.

**Impact:** безопасность зависит от поведения upstream storage service. Внутри приложения нет явного invariant на canonical relative key.

**Recommendation:** валидировать relative key allowlist-ом сегментов и запрещать traversal/control characters до запроса presign.

### Низкие

#### L-002-1. Dependency CVE status не подтверждён

**Evidence:** `pnpm audit --prod --json` не завершился из-за сетевого ожидания и был остановлен; therefore installed dependency vulnerability status остаётся UNVERIFIED.

**Impact:** нельзя доказать отсутствие известных CVE только по локальному source inspection.

**Recommendation:** повторить audit в CI или окружении с доступом к registry advisory database и сохранить результат в release evidence.

## Риски

Подтверждённые риски относятся к отсутствию application-level security headers и широкому body limit. Дополнительный риск — неполная доказанность dependency posture из-за незавершённого audit. Доказательств exposed secrets, executable uploads или image-source bypass в текущем source inspection не найдено.

## План коррекции

**Epic: усилить production HTTP boundary.** Добавить и проверить security headers на реальном response.

**Epic: ограничить входные payloads.** Уменьшить общий parser limit и оставить большие значения только для доказанно нужных потоков.

**Epic: закрыть dependency evidence gap.** Запустить `pnpm audit --prod` в CI с доступом к advisory registry.

## Критерии приёмки

Критерии будут выполнены после фактической проверки всех требуемых headers, подтверждения limits, canonical storage key validation и успешного dependency audit.

## Итоговое заключение

**Текущая security posture adequate for production: Частично.** Важные hardening меры приложения уже есть, но headers и dependency audit не подтверждены.

**Проект безопасен для production в рамках этого scope: Да, с оговорками.** Это не security sign-off без повторного dependency audit и проверки deployment headers.
