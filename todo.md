# SiteCraft MVP TODO

## Core Engine

- [ ] Использовать иерархию Page → Section → Content Blocks максимум в два уровня
- [ ] Хранить pageId, parentBlockId, type, sortOrder и строго валидируемые props
- [ ] Разделить Draft и immutable Published Revision/Snapshot
- [ ] Использовать единый canonical projectDraftRevision для optimistic concurrency
- [ ] Передавать expectedRevision в каждую Draft mutation и возвращать CONFLICT при устаревшем сохранении
- [ ] Добавить project-level Theme / Design Tokens
- [ ] Сделать projectSlug глобально уникальным с момента создания проекта
- [ ] Сделать pageSlug уникальным внутри проекта
- [ ] Добавить schemaVersion в publishedRevisions
- [ ] Выполнять reorder, replaceAll, template build и Publish транзакционно
- [ ] Проверять ownership каждого projectId, pageId и blockId на сервере

## AI Site Generation

- [ ] Добавить IDEA → структурированный Brief без немедленного создания страницы
- [ ] Дать пользователю просмотреть и отредактировать Brief до генерации
- [ ] Добавить строгий SiteSpec как промежуточный результат AI-проектирования
- [ ] Валидировать SiteSpec через строгую Zod-схему
- [ ] Преобразовывать только подтверждённый SiteSpec в Project Draft детерминированным трансформером
- [ ] Не генерировать произвольный React-код для сайтов в MVP
- [ ] Связать AI Site Architect с sitemap, pages, sections, block types, CTA, content intent и theme tokens
- [ ] Добавить AIProvider с generateBrief, generateSiteSpec и proposeEdit
- [ ] Изолировать provider-specific код от pages/editor/publish architecture

## Visual Editor и AI Local Edit

- [ ] Собрать редактор с иерархическим canvas и блоками Section/Text/Image/Button
- [ ] Добавить desktop/tablet/mobile Preview Draft
- [ ] Добавить локальный AI Proposal flow: selected scope → proposal → validation → diff/preview → Apply
- [ ] Запретить AI напрямую менять Draft без подтверждения Proposal
- [ ] Добавить block lock, section lock и theme lock без сложной permission-системы
- [ ] Создавать новую Draft revision после применения Proposal
- [ ] Добавить undo последнего применённого AI-изменения

## Auth, Publish и QA

- [ ] Оставить Manus OAuth для текущей среды через Auth Adapter
- [ ] Не связывать feature handlers с Manus-specific API и использовать ownerId abstraction
- [ ] Реализовать Save отдельно от Publish
- [ ] Создать immutable Published Revision с schemaVersion
- [ ] Реализовать public routes /site/:projectSlug и /site/:projectSlug/:pageSlug
- [ ] Проверить, что public renderer читает только опубликованный snapshot
- [ ] Добавить unit, integration и E2E тесты для Core Engine и AI Proposal flow
- [ ] Запустить TypeScript check, tests и production build

## Сознательно отложено

- [ ] Не добавлять произвольную генерацию React-кода
- [ ] Не добавлять collaborative editing и CRDT
- [ ] Не добавлять multi-agent orchestration
- [ ] Не добавлять сложное branching/version-history UI
- [ ] Не добавлять marketplace компонентов
- [ ] Не добавлять custom domains
- [ ] Не добавлять десятки AI providers
- [ ] Не добавлять autonomous publishing
- [ ] Не добавлять новые block types сверх MVP

## Текущий этап: Foundation и схема данных

- [x] Добавить таблицы projectBriefs, siteSpecs, projects, pages, pageBlocks, publishedRevisions, aiProposals и scopeLocks
- [x] Добавить nullable parentBlockId и ограничения двухуровневой иерархии на уровне модели/проверок
- [x] Добавить projectDraftRevision, publishedRevisionId, schemaVersion и project-level theme
- [x] Добавить ownership foreign keys и уникальность projectSlug/pageSlug
- [x] Сгенерировать миграцию Drizzle
- [x] Проверить миграционный SQL и применить его через database migration workflow
- [x] Запустить TypeScript check и тесты этапа 1 (проверка выявила незакрытый gap по иерархии)

## Исправление hierarchy gap в этапе 1

- [x] Проверить фактическую версию подключённой MySQL/TiDB и поддержку self-referencing foreign key
- [x] Создать additive migration 0002 с parentBlockId integrity и индексом
- [x] Проверить и применить migration 0002 без изменения 0001
- [x] Создать общий deterministic hierarchy validator без зависимости от UI/AI
- [x] Добавить нормализацию sortOrder внутри parent scope
- [x] Добавить regression tests для valid и invalid tree cases
- [x] Повторно выполнить pnpm check, pnpm test и production build

## Текущий этап: Core Engine invariants и серверный доступ

- [x] Добавить строгие block/theme/slug schemas для серверных mutations
- [x] Добавить ownership helpers для projectId, pageId и blockId
- [x] Добавить canonical projectDraftRevision guard и CONFLICT errors
- [x] Подключить hierarchy validator ко всем create/update/reorder/replaceAll handlers
- [x] Реализовать транзакционные reorder и replaceAll с детерминированным sortOrder
- [x] Добавить server-side tests для ownership, revision guard и handler hierarchy validation
- [x] Запустить pnpm check и pnpm test; остановиться при FAIL

## Текущий этап: IDEA → Brief → SiteSpec → Build Core

- [x] Создать AIProvider abstraction с manual fallback без Manus-specific бизнес-логики
- [x] Сохранить IDEA как исходный пользовательский ввод отдельно от Brief
- [x] Добавить создание/редактирование и явное подтверждение Brief
- [x] Добавить строгую canonical SiteSpec Zod-schema и validation flow
- [x] Реализовать proposal/validation/apply без прямой записи AI в production data
- [x] Реализовать ownership и expectedRevision guards для Stage 3
- [x] Реализовать детерминированный транзакционный Build из approved SiteSpec
- [x] Создавать только Page → Section → Text/Image/Button и project-level theme
- [x] Добавить persistence, stale SiteSpec/Proposal CONFLICT и manual fallback tests
- [x] Запустить pnpm check, pnpm test и pnpm build; первый build был остановлен ресурсами, повторный clean build завершился PASS

## Stage 3 acceptance gap closure

- [x] Создать executable full DB integration test через production router/handlers
- [x] Проверить reload persistence IDEA, Brief, SiteSpec, theme, pages, blocks и revision через architect.state/read paths
- [x] Добавить реальные stale expectedRevision и atomicity regression tests
- [x] Добавить Brief-changed-after-SiteSpec conflict test
- [x] Добавить repeated Apply conflict/no-duplication test
- [x] Добавить cross-owner rejection/no-state-change test
- [x] Запустить pnpm check, pnpm test, затем обычный pnpm build
- [x] Если build снова FAIL, определить resource pressure vs Stage 3 dependency issue без случайного изменения архитектуры; повторный build прошёл, архитектура не менялась

## Recovery Freeze after Stage 3

- [x] Составить инвентарь исходников, зависимостей, миграций и Manus-specific hooks
- [x] Создать внешний source bundle с полным кодом, package.json и lockfile
- [x] Создать .env.example без секретов со всеми обязательными переменными
- [x] Собрать все static/assets bytes и manifest
- [ ] Создать полный logical DB backup с данными проекта — текущий snapshot содержит 0 проектных строк, gap не закрыт
- [ ] Проверить целостность backup и соответствие схеме/данным — checksum/DDL проверены, соответствие непустым project data не подтверждено
- [x] Подготовить инструкцию внешнего запуска install → DB → migrations → env → check → test → build/start
- [x] Проверить восстановление в изолированной копии по pnpm install → migrations → pnpm check → pnpm test → pnpm build (clean-room PASS; external deployment unverified)
- [x] Составить Recovery Freeze таблицу и явно указать реальные блокеры

## Recovery verification: Safe vs Runtime Ready

- [x] Снять row counts source DB для всех Stage 3 таблиц
- [x] Сверить source row counts с INSERT counts logical backup и получить MATCH по каждой таблице
- [x] Создать отдельную пустую test database/schema для recovery (локальная MariaDB; framework users baseline требуется до additive migration 0001)
- [x] Применить migrations 0001 → 0002 → 0003 на свежей схеме
- [x] Запустить Stage 3 smoke flow на свежей схеме с reload
- [x] Запустить на recovery setup pnpm check, pnpm test и pnpm build
- [x] Подтвердить физический путь, размер, SHA-256 и состав recovery archive
- [x] Отдельно вынести RECOVERY SAFE и EXTERNAL RUNTIME READY без подмены критериев

## Текущий этап: Workspace + Visual Editor

- [x] Добавить защищённые workspace/project/page read-paths без изменения Stage 1–3 flow
- [x] Собрать workspace shell с приватным owner-scoped project list
- [x] Добавить выбор проекта и страниц с отображением draft revision
- [x] Собрать иерархический canvas Section → Text/Image/Button
- [x] Добавить selection state и properties panel для редактирования разрешённых props (включены все strict-schema fields)
- [x] Подключить Save к существующим update/reorder/replaceAll handlers с expectedRevision (granular update/reorder и replaceAll fallback)
- [x] Показать loading, empty, error, dirty и conflict states
- [x] Не добавлять AI Local Edit, Locks UI, Preview/Publish и новые block types
- [x] Добавить Stage 4 acceptance tests (real router/DB read, save, reload и stale conflict)
- [x] Запустить pnpm check, pnpm test и pnpm build; первоначальный FAIL закрыт повторным обычным build PASS

## Stage 4 production build gate recovery

- [x] Сохранить WIP checkpoint текущего Stage 4 без изменения функциональности
- [x] Остановить dev server/watch и тяжёлые Vitest/Vite процессы перед build
- [x] Удалить только dist и зафиксировать доступную память до build
- [x] Проверить только новые Stage 4 imports и accidental bundle growth
- [x] Выполнить обычный pnpm build без специальных production-флагов
- [x] При повторном exit 143 зафиксировать последнюю строку, exit code, память, процессы и этап Vite — не применялось: обычный build завершился с exit code 0
- [x] Повторно подтвердить pnpm check, pnpm test и Stage 4 integration acceptance

## Текущий этап: AI Local Edit + Locks

- [x] Добавить typed selected-scope и proposal schemas для block/section/page/theme
- [x] Реализовать manual deterministic AIProvider proposal path без внешнего AI
- [x] Сохранять proposal с исходной revision/fingerprint и concrete proposed diff
- [x] Добавить серверный Validate → Apply flow без прямой записи AI в Draft
- [x] Повторно проверять ownership, revision, locks, strict schemas и hierarchy перед Apply
- [x] Сделать Apply атомарным, одноразовым и увеличивающим projectDraftRevision
- [x] Реализовать Reject без изменения Draft
- [x] Реализовать block, section и theme locks с серверной защитой
- [x] Добавить rollback/atomicity для невалидного Apply
- [x] Добавить UI Ask AI, command, generating/error, diff, Apply, Reject и Lock/Unlock в существующий editor
- [x] Добавить Stage 5 integration/regression tests, включая reload persistence
- [x] Запустить pnpm check, pnpm test и pnpm build; остановиться при FAIL

## Stage 5 acceptance gap closure

- [x] Ограничить AIProvider context только выбранным scope и разрешёнными project-level constraints
- [x] Добавить настоящий before/after diff proposed changes в существующий Workspace editor
- [x] Добавить отдельный repeated Apply после успешного Apply с проверкой CONFLICT и отсутствия дублей
- [x] Добавить отдельный cross-owner Apply rejection с проверкой неизменного Draft
- [x] Повторно запустить pnpm check, полный pnpm test и pnpm build перед Stage 5 checkpoint

- [x] Усилить repeated-Apply test: после rejected повторного Apply проверить точный набор pageBlocks.id в reload и отсутствие дублей в БД

## Текущий этап: Responsive Preview + Publish

- [x] Добавить общий renderer/component registry для Draft Preview и Published Site
- [x] Реализовать Draft-only responsive Preview с Desktop/Tablet/Mobile viewport-контейнерами
- [x] Убедиться, что Preview не сохраняет Draft и не создаёт Published Revision
- [x] Реализовать серверную Publish validation: ownership, revision, slugs, home, theme, hierarchy, strict props, alt и safe href
- [x] Реализовать транзакционный immutable Published Revision snapshot и public pointer
- [x] Реализовать public resolver только по Published Revision и schemaVersion guard
- [x] Реализовать `/site/:projectSlug` и `/site/:projectSlug/:pageSlug` с корректными 404
- [x] Реализовать re-publish, сохранение старой revision и isolation от Draft changes
- [x] Реализовать транзакционный Unpublish без изменения Draft
- [x] Добавить Workspace Preview/Publish/Published/Re-publish/Unpublish states
- [x] Добавить Stage 6 real-router/DB integration acceptance tests
- [x] Запустить pnpm check, pnpm test и pnpm build; остановиться при FAIL

## Stage 6 acceptance gap closure

- [x] Добавить integration test, что Draft Preview использует текущий Draft через общий renderer и viewport switch не меняет Draft/published state
- [x] Добавить HTTP/Express integration tests для `/site/:projectSlug` и `/site/:projectSlug/:pageSlug`, включая 404 и snapshot-only content

## Stage 7 Final QA / Release Gate

- [x] Выполнить полный production-path E2E flow от auth до Unpublish/404 — PASS
- [x] Проверить новую authenticated session и persistence/reload всех состояний — PASS
- [x] Повторно проверить ownership, conflicts, locks, strict validation и atomicity — PASS по полному Vitest suite
- [x] Проверить Draft/public isolation, immutable revisions и schemaVersion guard — PASS
- [x] Проверить Draft Preview и Published renderer parity — exact HTML parity PASS
- [x] Выполнить desktop/mobile UI QA и browser console/overflow checks — PASS; blocking console/network errors не обнаружены
- [x] Проверить migrations на чистой test DB и smoke flow, если среда позволяет — UNVERIFIED: отдельная DB environment сейчас отсутствует; предыдущая Stage 3 clean-room verification сохранена
- [x] Запустить pnpm check, pnpm test и pnpm build — PASS после retry
- [x] Обновить recovery package финальным состоянием Stage 7 QA evidence и blocker status
- [x] Создать финальный Stage 7 checkpoint только после PASS
- [x] Зафиксировать Stage 7 release verdict и остановиться без Stage 8 — PASS

## Stage 7 QA evidence

- [x] Full E2E
- [x] Security / ownership
- [x] State integrity
- [x] Renderer parity
- [x] Persistence / reload
- [x] Responsive/UI QA
- [x] Check / Tests / Build
- [x] Recovery package
- [x] Final release verdict — PASS

## Stage 7 scope guard

- [x] Не добавлять новые функции
- [x] Не изменять Stage 1–6 без конкретного regression/blocker
- [x] Не начинать Stage 8

## Stage 7 blocker fix: minimal Stage 3 production entry point

- [x] Добавить на `/` минимальный Create Project → IDEA → Brief → Confirm Brief → SiteSpec → Confirm SiteSpec → Build Draft UI через существующие tRPC handlers
- [x] Не менять backend handlers, сущности, Workspace editor и `/home` demo
- [x] Добавить loading/error/validation states и открыть созданный Draft в текущем Workspace
- [x] Добавить UI-flow regression coverage без прямых DB/router вызовов в browser E2E
- [x] Повторить полный Stage 7 browser E2E после blocker fix — PASS
- [x] Повторить pnpm check, pnpm test и pnpm build — PASS
- [x] При полном PASS обновить recovery package и создать финальный Stage 7 checkpoint

## Final Release Freeze

- [x] Зафиксировать точный финальный commit/checkpoint hash — финальный checkpoint будет сохранён после этой freeze-записи
- [x] Собрать recovery package из финального Stage 7 состояния
- [x] Включить source, package.json, lockfile, migrations, Drizzle schema, logical backup, assets bytes, env example, runbook и adapters inventory
- [x] Включить Stage 7 acceptance results и checksum manifest
- [x] Создать архив sitecraft-mvp-final-<commit>.tar.gz
- [x] Проверить fresh DB → migrations → pnpm install --frozen-lockfile → check → test → build — PASS
- [x] Выполнить smoke flow восстановленной версии до Publish — PASS: 3 files / 15 tests
- [x] Проверить archive size и SHA-256
- [x] Зафиксировать FINAL COMMIT, recovery test, MVP release и external runtime verdict
- [x] Остановиться после Final Release Freeze без Stage 8

## Final Release Freeze recovery blocker

- [x] Сделать migration 0002 portable для fresh MariaDB/compatible MySQL migration runner, разделив ALTER TABLE и CREATE INDEX statement-breakpoint’ом; затем повторить recovery gates — PASS

- [x] Закрыть MariaDB JSON serialization compatibility в ai-edit context и integration fixtures, затем повторить fresh recovery gates — PASS

## Final Zero-Trust Self-Audit — baseline 0509a8f0

- [ ] Проверить соответствие финального checkpoint 0509a8f0 и recovery archive
- [ ] Проверить archive integrity, checksum manifest, секреты и отсутствующие sandbox-only artifacts
- [ ] Построить traceability plan → code → router → production UI → executable tests
- [ ] Выполнить fresh-user production UI audit и зафиксировать UX/dead-end gaps
- [ ] Повторно проверить state integrity, ownership, revision guards, locks, transactions и failure paths
- [ ] Проверить AI abstraction, fallback transparency, public renderer security и renderer parity
- [ ] Проверить migrations clean/upgrade, DB portability, production boot и Manus dependencies
- [ ] Подготовить независимый zero-trust audit report с severity/status/evidence
- [ ] Не менять код, архитектуру, данные и не начинать Stage 8

## Pre-Migration Hardening Gate — baseline 0509a8f0

- [x] Ограничить image.src allowlist’ом поддерживаемых http/https image sources и добавить security regression tests
- [x] Ограничить theme/font/CSS-context values безопасной schema/token model и добавить injection regression tests
- [x] Защитить Unpublish atomic pointer identity от race с новым Publish и добавить concurrent regression test
- [x] Добавить additive migration для unique lock identity и safe concurrent lock handling с regression test
- [x] Устранить UX contradictions, сделать Create Project доступным при существующих проектах и убрать /home demo reachability
- [x] Добавить настоящий browser E2E для full flow, reload/logout-login и stale second-tab save
- [x] Выполнить populated migration regression на непустой базе через 0000→0003
- [x] Добавить final-integrated-plan.md или эквивалентную финальную architecture/release specification в recovery artifact
- [x] Запустить pnpm check, pnpm test, browser E2E и pnpm build
- [x] При полном PASS создать новый checkpoint и recovery archive; External Runtime Migration не начинать

## Pre-Migration Hardening Gate — verified blocker closure

- [x] Исправить syntax/transform blocker в server/site-engine.ts, не меняя поведение handlers
- [x] Не рендерить strict PublishedSnapshot для pre-Build Draft без pages; сохранить UX выбора проекта
- [x] Повторно выполнить browser E2E после точечных исправлений и проверить отсутствие новых console errors
- [x] Очищать локальный editor draft при переключении на проект без выбранной страницы, чтобы не показывать blocks другого проекта

## Remaining acceptance gaps — user-directed closure

- [x] Убрать skip из обязательного Playwright release flow через воспроизводимый authenticated storageState без auth bypass
- [x] Реально выполнить browser E2E: create/build/editor/save/reload/AI/locks/preview/publish/re-publish/unpublish, existing-project create, pre-Build isolation, new session и stale second-tab conflict
- [x] Выполнить populated migration regression на disposable DB через раннюю migration state → валидные старые fixtures → 0003 upgrade → production read paths
- [x] После обоих gap PASS выполнить check/test/test:e2e/build, создать финальный hardening checkpoint и recovery archive с checksum
- [x] Устранить race post-Build selection: после Create Project Workspace должен открыть именно созданный projectId, а не первый старый проект
- [x] Заблокировать Unpublish на время refetch published status после Publish/Re-publish, чтобы не отправлять stale pointer identity

## Recovery DB freshness — checkpoint eaed1395

- [x] Снять source row counts и ключевые IDs для девяти recovery tables
- [x] Сравнить source с backup внутри sitecraft-mvp-final-eaed1395.tar.gz
- [x] При расхождении выполнить свежий безопасный table-by-table/chunked/application-level export
- [x] Пересобрать sitecraft-mvp-final-eaed1395-r1.tar.gz и вернуть DB freshness verdict

## Recovery r1 restore proof — final pre-migration gate

- [x] Создать disposable fresh DB и применить migrations 0000→0004
- [x] Импортировать существующий db/sitecraft-fresh-db.json без создания новых проектных данных
- [x] Проверить counts, IDs, foreign keys, parentBlockId, ownership, revisions, Brief↔SiteSpec, proposals, locks и published snapshots
- [x] Выполнить production read/save/AI Proposal/Preview/public route smoke на восстановленном существующем проекте
- [x] Сохранить reproducible importer/restore command в recovery archive/runbook и вернуть recovery proof verdict

## PRA production audit

- [x] Распаковать и инвентаризировать PRA-001–PRA-017
- [x] Выполнить PRA-001 Architecture Review
- [x] Выполнить PRA-002 Security Review
- [x] Выполнить PRA-003 Authentication & Authorization Review
- [x] Выполнить PRA-004 Database Review
- [x] Выполнить PRA-005 API Review
- [x] Выполнить PRA-006 Frontend Review
- [x] Выполнить PRA-007 React Review
- [x] Выполнить PRA-008 TypeScript Review
- [x] Выполнить PRA-009 Observability Review
- [x] Выполнить PRA-010 Error Handling Review
- [x] Выполнить PRA-011 Performance Review
- [x] Выполнить PRA-012 Testing Review
- [x] Выполнить PRA-013 DevOps & Infrastructure Review
- [x] Выполнить PRA-014 Code Quality Review
- [x] Выполнить PRA-015 Release Readiness Review
- [x] Выполнить PRA-016 Design Patterns Review
- [x] Собрать PRA-017 Final Production Report без повторного анализа исходного кода

## PRA-017 finding closure — safe errors and request correlation

- [x] Убрать stack trace и internal exception details из production ErrorBoundary UI
- [x] Добавить regression test на безопасное ErrorBoundary сообщение
- [x] Добавить requestId в server request context с безопасной генерацией/пробросом
- [x] Добавить structured error logging для critical server errors/mutations без secrets и raw user content
- [x] Добавить regression tests на request correlation и redacted structured error fields
- [x] Выполнить pnpm check, pnpm test, pnpm test:e2e и pnpm build; остановиться после PASS

## Mobile responsive pass

- [ ] Проверить Workspace, builder, editor properties, AI/locks, preview и public route на мобильных viewport
- [ ] Исправить только подтверждённые mobile overflow, touch, focus и layout проблемы
- [ ] Повторно проверить мобильные сценарии и доступность кнопок/форм
- [ ] Запустить responsive browser checks, pnpm check, pnpm test и pnpm build


## Final Mobile Responsive Pass

- [x] Проверить populated mobile editor на 390px: sections, blocks, перенос длинного текста и отсутствие горизонтального clipping
- [x] Проверить populated mobile properties на 390px: поля, AI Local Edit, Lock и Publish остаются доступными
- [x] Подтвердить mobile pane switching Projects → Editor → Properties через browser regression
- [x] Добавить mobile responsive regression test для 390px и проверки отсутствия горизонтального overflow
- [x] Запустить mobile E2E, pnpm check, pnpm test и обычный pnpm build


## Final UI Verification

- [x] Проверить основные production маршруты и состояния интерфейса на desktop и mobile
- [x] Проверить populated и empty workspace, editor/properties, AI/locks, preview, publish и public route
- [x] Проверить визуальные clipping/overflow, touch targets, keyboard focus и читаемость
- [x] Исправить только подтверждённые UI-проблемы без изменения бизнес-логики
- [x] Повторно выполнить browser UI regression, pnpm check, pnpm test и pnpm build
- [x] Подтверждённый UI gap: поднять mobile touch targets для pane tabs, form controls и action buttons до минимум 44px
- [x] Подтверждённый UI gap: сделать public 404 response намеренно оформленным, сохранив HTTP 404 и snapshot-only semantics
