# SiteCraft MVP — единый интегрированный план

## Цель и границы

SiteCraft должен превратить обычное описание пользователя в первый рабочий сайт на базе надёжной библиотеки блоков, а затем дать пользователю безопасно доработать его в визуальном редакторе или через локальные AI-команды, проверить Draft в адаптивном Preview и опубликовать независимую immutable revision.

В MVP входят приватные OAuth-workspace, проекты и страницы, Brief, AI Site Architect, строгий SiteSpec, детерминированная сборка Draft, визуальный редактор, локальные AI Proposals, locks, undo последнего AI-изменения, Preview desktop/tablet/mobile, Publish и публичные URL. Не входят произвольная генерация React-кода, collaborative editing, CRDT, multi-agent orchestration, сложное branching, marketplace компонентов, custom domains, десятки providers и autonomous publishing.

Проект использует существующую React + Tailwind + Express + tRPC + Drizzle-архитектуру. AI и Auth подключаются через абстракции, чтобы бизнес-логика не зависела от конкретного провайдера или Manus-specific API.

## 1. Итоговый пользовательский flow

```text
IDEA
  ↓
BRIEF
  ↓
пользователь проверяет и редактирует Brief
  ↓
AI SITE ARCHITECT
  ↓
SITEMAP + PAGE ARCHITECTURE
  ↓
DESIGN DIRECTION + начальные Theme Tokens
  ↓
SITE SPEC
  ↓
строгая валидация и подтверждение SiteSpec
  ↓
BUILD: SiteSpec → validated transformation → Project Draft
  ↓
VISUAL EDITOR
  ↓
AI LOCAL EDIT: Proposal → Validation → Diff/Preview → Apply
  ↓
RESPONSIVE PREVIEW
  ↓
QA
  ↓
PUBLISH: immutable Published Revision
```

На этапе IDEA пользователь вводит обычное описание, например: «Премиальный сайт детейлинг-центра. Главная цель — заявки. Нужны услуги, работы, преимущества и контакты». Страница сразу не создаётся. Сначала создаётся структурированный Brief.

Brief содержит тип проекта/бизнеса, цель сайта, аудиторию, основное действие пользователя, необходимые страницы, контентные требования, визуальные пожелания, обязательные элементы и ограничения. Brief отображается пользователю для правки и подтверждения.

## 2. Итоговая data model

| Сущность | Основные поля | Роль |
|---|---|---|
| `users` | `id`, OAuth identity | Текущий владелец workspace; существующая auth-таблица |
| `projects` | `id`, `ownerId`, `name`, глобально уникальный `projectSlug`, `projectDraftRevision`, `publishedRevisionId`, `theme`, `createdAt`, `updatedAt` | Приватный проект и единый canonical revision-clock Draft |
| `projectBriefs` | `id`, `projectId`, `inputText`, структурированный `brief`, `status`, `createdAt`, `updatedAt` | Подтверждённый или редактируемый Brief до SiteSpec |
| `siteSpecs` | `id`, `projectId`, `briefId`, `spec`, `schemaVersion`, `status`, `createdAt`, `updatedAt` | AI-спроектированная, строго валидируемая спецификация; не production pages |
| `pages` | `id`, `projectId`, `name`, уникальный внутри проекта `pageSlug`, `purpose`, `isHome`, `createdAt`, `updatedAt` | Текущие Draft-страницы |
| `pageBlocks` | `id`, `pageId`, nullable `parentBlockId`, `type`, последовательный `sortOrder`, строгий `props` | Draft-блоки с иерархией только `Page → Section → Content Block` |
| `publishedRevisions` | `id`, `projectId`, `revisionNumber`, `schemaVersion`, immutable `snapshot`, `publishedAt` | Полная опубликованная копия pages, blocks и theme |
| `aiProposals` | `id`, `projectId`, `baseDraftRevision`, `scopeType`, `scopeId`, `proposal`, `status`, `createdAt` | Предложение локального AI-изменения до Apply |
| `scopeLocks` | `id`, `projectId`, `scopeType`, `scopeId`, `locked` | Минимальные lock-механизмы для block, section и theme |

### 2.1 Иерархия блоков

`parentBlockId` обязателен в модели как nullable поле. Корневые записи имеют `parentBlockId = null` и могут быть только `section`. Дочерние записи должны указывать на Section той же страницы и могут быть только `text`, `image` или `button`. Content Block не может иметь детей. Произвольная глубина дерева и вложенные Section в MVP запрещены.

`pageBlocks.props` может храниться в JSON-совместимом столбце текущего MySQL/TiDB dialect, но до записи и после чтения проходит строгую type-specific Zod-валидацию. Произвольный `z.any()` не используется.

### 2.2 Block schemas

| Тип | Строгая схема props |
|---|---|
| `section` | layout, background token/безопасный override, spacing token, content width token, alignment |
| `text` | content, variant `heading/body/eyebrow`, alignment, разрешённые typography overrides |
| `image` | src, alt, fit, radius token/безопасный override |
| `button` | label, href, variant, alignment; только относительные пути, `http`, `https`, `mailto`, `tel` |

`javascript:`, `vbscript:`, executable `data:` и прочие небезопасные URL-схемы отклоняются сервером и клиентом.

### 2.3 Theme / Design Tokens

`projects.theme` является общей project-level системой и включает `typography`, `colors`, `spacing`, `radius`, `contentWidth`. Блоки по умолчанию ссылаются на эти tokens и хранят только необходимые overrides. Одинаковые базовые значения не копируются вручную в каждый блок.

## 3. Место Brief и SiteSpec

Brief — пользовательская, редактируемая постановка задачи между IDEA и AI Site Architect. Он не создаёт страницы и не изменяет production tables.

SiteSpec — структурированный результат AI-проектирования между AI Site Architect и BUILD. Он содержит sitemap, назначение каждой страницы, секции, purpose секций, content intent, выбранные block types, CTA, Theme/Design Tokens и responsive intent. SiteSpec проходит строгую Zod-схему и должен быть подтверждён пользователем.

AI Site Architect не пишет напрямую в `projects`, `pages` или `pageBlocks`. Только валидный подтверждённый SiteSpec передаётся детерминированному серверному трансформеру. Трансформер создаёт Project Draft из существующей библиотеки Section/Text/Image/Button. AI не генерирует произвольный React-код для каждого сайта.

## 4. AI Site Architect и Core Engine

AI Site Architect проектирует структуру, а Core Engine остаётся единственным владельцем runtime-модели сайта. Поток выглядит так:

```text
Brief
→ AI Site Architect
→ validated SiteSpec
→ deterministic builder
→ project + pages + pageBlocks + theme Draft
```

Сборка первой версии выполняется транзакционно, создаёт независимые записи страниц и блоков, назначает глобально уникальный `projectSlug` уже при создании проекта и выставляет единый `projectDraftRevision`. Никаких живых ссылок на preset или SiteSpec в runtime-блоках нет.

## 5. AI Local Edit и Locks

В Visual Editor пользователь выбирает scope: конкретный Text, Button, Section, Page или Theme. Он вводит команду вроде «Сделай только этот Hero выразительнее. Остальной сайт не менять».

Поток строго разделён:

```text
Selected Scope
→ AIProvider.proposeEdit()
→ scope/lock/schema validation
→ Proposal
→ Diff/Preview
→ user confirmation
→ transactional Apply
→ new projectDraftRevision
```

AI Proposal не изменяет Draft напрямую. Сервер проверяет, что proposal касается только выбранного scope, не затрагивает locked scope, соответствует строгим block/theme schemas и основан на актуальном `baseDraftRevision`. Только после подтверждения пользователя proposal применяется транзакционно. После Apply создаётся новая Draft revision. Undo последнего AI-изменения применяет обратную валидированную операцию при совпадении текущей revision; полноценный Git/branching UI не строится.

Locks минимальны: `block lock`, `section lock`, `theme lock`. Locked scope нельзя менять через AI Proposal до явного unlock. Сложная permission-система вокруг locks не добавляется.

## 6. Draft, Preview, Publish и Revision Guard

Редактор, обычное Save и Preview работают только с Draft. Для всех Draft mutations, включая autosave, reorder, replaceAll и Apply Proposal, передаётся `expectedRevision`, равный единому canonical `projects.projectDraftRevision`.

Сервер выполняет условную атомарную запись: если revision совпадает, операция применяется и clock увеличивается; если уже произошла другая запись, возвращается tRPC error `CONFLICT`, а новые данные не перезаписываются. Клиент перечитывает Draft и показывает конфликт вместо silent overwrite. Несколько конкурирующих revision-clock не вводятся.

Preview показывает текущий Draft в desktop/tablet/mobile viewport и не создаёт Published Revision. Save означает только сохранение Draft.

Publish транзакционно проверяет ownership, `expectedRevision`, Brief/SiteSpec не требуются после BUILD, все page/block schemas, иерархию, slug, Theme и наличие home page. Затем создаётся глубокий immutable `publishedRevisions.snapshot` с `schemaVersion`, после чего `projects.publishedRevisionId` указывает на него. После публикации изменения Draft не влияют на public site. Новый public результат появляется только после следующего Publish.

Published renderer должен понимать `schemaVersion`, чтобы будущие изменения компонентов не ломали старые snapshots. Unpublish очищает опубликованный указатель транзакционно.

## 7. Public URL model

| Маршрут | Источник данных |
|---|---|
| `/site/:projectSlug` | Только `publishedRevisions.snapshot` home page |
| `/site/:projectSlug/:pageSlug` | Только страница с `pageSlug` внутри опубликованного snapshot проекта |

`projectSlug` глобально уникален с момента создания проекта, а `pageSlug` уникален внутри проекта. Public resolver не читает Draft для отрисовки. Если published revision отсутствует, slug не найден или страница снята с публикации, возвращается публичная 404.

## 8. AIProvider abstraction

Сервер вводит простой интерфейс:

```text
AIProvider
├── generateBrief(inputText)
├── generateSiteSpec(confirmedBrief)
└── proposeEdit(selectedScope, instruction, currentSnapshot)
```

Provider-specific код находится в адаптере. Текущий provider может использовать доступную AI-инфраструктуру, но `Brief`, `SiteSpec`, builder, editor, revision guard и publish architecture не должны зависеть от конкретного Manus API. Замена provider не должна требовать переписывания pages, pageBlocks, editor или renderer. Для MVP подключается один provider, без архитектуры на десятки providers.

## 9. Auth abstraction

Manus OAuth остаётся провайдером текущей среды. Feature handlers работают через Auth Adapter/current-user слой, который предоставляет внутренний `ownerId`. Бизнес-логика не должна требовать Manus-specific API в каждом обработчике. Любая операция по projectId, pageId, blockId, Brief, SiteSpec, Proposal или lock серверно проверяет, что объект принадлежит текущему OAuth-пользователю; одной проверки переданного parent projectId недостаточно.

## 10. Этапы реализации

### Этап 1. Foundation и схема

Расширить Drizzle-схему сущностями Brief, SiteSpec, projects, pages, pageBlocks, publishedRevisions, aiProposals и scopeLocks. Добавить nullable parentBlockId, уникальные индексы, `projectDraftRevision`, `schemaVersion`, theme и ownership foreign keys. Сгенерировать и применить миграцию с учётом MySQL/TiDB dialect.

### Этап 2. Core Engine invariants

Реализовать строгие Zod-схемы Brief, SiteSpec, block props и Theme. Добавить ownership helpers, иерархическую валидацию, URL security, slug rules, последовательный sortOrder, canonical revision guard и транзакционные helpers для reorder, replaceAll, template/SiteSpec build, Apply Proposal и Publish.

### Этап 3. IDEA, Brief, AI Site Architect и BUILD

Собрать экран IDEA, генерацию Brief, его редактирование и подтверждение. Добавить SiteSpec preview/edit/confirm. Реализовать AIProvider adapters и детерминированную трансформацию валидного SiteSpec в независимый Project Draft. Использовать существующие надёжные блоки, без генерации React-кода.

### Этап 4. Workspace и visual editor

Собрать приватный workspace с CRUD проектов и страниц, глобально уникальным projectSlug при создании, template/SiteSpec build, rename, duplicate и delete. Реализовать двухуровневый canvas Section → Content Blocks, свойства Section/Text/Image/Button, autosave с expectedRevision, статус конфликтов и обычный Save.

### Этап 5. AI Local Edit

Добавить выбор scope, AI Proposal, строгую проверку proposal, locks, Diff/Preview, подтверждение и transactional Apply. Добавить undo последнего AI-изменения через revision-safe обратную операцию. AI не получает прямого доступа к production Draft mutation без пользовательского Apply.

### Этап 6. Preview, Publish и Public renderer

Добавить реальные desktop/tablet/mobile viewport-контейнеры для Draft Preview. Реализовать Publish в immutable publishedRevisions с schemaVersion, public routes `/site/:projectSlug` и `/site/:projectSlug/:pageSlug`, Unpublish и public 404.

### Этап 7. QA

Unit-тесты покрывают Zod-схемы, SiteSpec transformation, URL security, hierarchy, theme defaults, slug, sortOrder, deep copy, locks и undo. Integration-тесты проверяют ownership, expectedRevision/CONFLICT, транзакции, Proposal scope validation, Publish snapshot isolation, schemaVersion и public resolver. E2E проверяет полный flow IDEA → Brief → SiteSpec → Build → editor → AI Proposal → Preview → Publish → изменение Draft без изменения public site → повторный Publish.

Перед передачей запускаются TypeScript check, тесты и production build; дополнительно проверяются консоль браузера, мобильная раскладка, focus states, empty/loading/error states и public 404.

## 11. Изменения относительно предыдущего Core Engine плана

| Предыдущий пункт | Итоговое изменение |
|---|---|
| Конструктор начинался с пустого проекта/template | Добавлен IDEA → Brief → SiteSpec → deterministic BUILD перед редактором |
| Template был основным источником начального состояния | Template и SiteSpec являются только источниками начального состояния; runtime получает независимую глубокую копию |
| AI не был частью основного flow | Добавлены AI Site Architect и AI Local Edit через Proposal |
| Не было промежуточной AI-сущности | Добавлены projectBriefs и siteSpecs со строгой валидацией |
| Блоки могли рассматриваться как плоская коллекция | Сохранена только двухуровневая иерархия `Page → Section → Content Blocks` с parentBlockId |
| Draft/Published разделялись на уровне snapshot | Уточнены immutable snapshot, public-only read, schemaVersion и Save ≠ Publish |
| Revision guard применялся к Draft mutation | Единый canonical projectDraftRevision теперь используется также для AI Apply и undo |
| Theme был частью Core Engine | Theme tokens стали входом/выходом AI Architect и обязательной project-level системой |
| Auth был привязан к существующей OAuth-среде | Добавлен Auth Adapter и внутренний ownerId abstraction при сохранении Manus OAuth |
| Не было блокировок | Добавлены минимальные block/section/theme locks только для AI Proposal |
| Публичный Publish был основным последним этапом | Publish остался последним этапом, но теперь принимает Draft, созданный Core Engine или AI Proposal |

## 12. MVP и отложенные функции

В MVP остаются IDEA, редактируемый Brief, AI Site Architect, строгий SiteSpec, детерминированный builder, приватный workspace, pages/pageBlocks Core Engine, Theme tokens, visual editor, AI local proposals, locks, undo последнего AI-изменения, responsive Preview, revision-safe Save, immutable Publish и фиксированные public routes.

Сознательно откладываются произвольный React-код для каждого сайта, collaborative editing, CRDT, multi-agent orchestration, сложное branching и полноценная история версий, marketplace компонентов, custom domains, десятки AI providers, autonomous publishing и новые block types сверх Section/Text/Image/Button.

## 13. Совместимость и риски

Существующая Drizzle/tRPC архитектура совместима с планом: таблицы и транзакции добавляются через Drizzle, API остаётся tRPC, OAuth остаётся Manus OAuth за Auth Adapter. Практическое ограничение — нужно использовать синтаксис и возможности текущего MySQL/TiDB dialect для JSON-совместимых props, уникальных индексов и транзакций.

Главные риски — корректная атомарная проверка canonical revision при debounce/autosave, сохранение immutable snapshot без ссылок на Draft, строгая трансформация SiteSpec без произвольного кода и корректная ownership-проверка каждого вложенного ID. Они закрываются серверными инвариантами, Zod, транзакциями и интеграционными тестами. Реализация не начинается до подтверждения этого плана.
