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
- [ ] Запустить pnpm check, pnpm test и pnpm build; FAIL на production build: процесс завершён exit 143 во время rendering chunks при memory pressure sandbox

## Stage 4 production build gate recovery

- [ ] Сохранить WIP checkpoint текущего Stage 4 без изменения функциональности
- [ ] Остановить dev server/watch и тяжёлые Vitest/Vite процессы перед build
- [ ] Удалить только dist и зафиксировать доступную память до build
- [ ] Проверить только новые Stage 4 imports и accidental bundle growth
- [ ] Выполнить обычный pnpm build без специальных production-флагов
- [ ] При повторном exit 143 зафиксировать последнюю строку, exit code, память, процессы и этап Vite
- [ ] Повторно подтвердить pnpm check, pnpm test и Stage 4 integration acceptance
