# SiteCraft — полностью обновлённый план MVP

## 1. Цель и границы работ

Создать полированный веб-конструктор сайтов, в котором пользователь после OAuth-входа работает в приватном workspace, создаёт проекты и страницы, редактирует Draft через визуальный блочный редактор, просматривает адаптивный Preview и публикует отдельную неизменяемую публичную версию.

Scope сохраняется без расширения: приватные workspace, CRUD проектов и страниц, starter templates, блоки Section/Text/Image/Button, упорядоченный canvas, desktop/tablet/mobile preview, сохранение Draft и публичная публикация. Совместное редактирование, CRDT, произвольное дерево блоков, история версий для пользователя, кастомные домены и новые типы блоков в MVP не добавляются.

Проект уже инициализирован как React + Tailwind + Express + tRPC + Drizzle-приложение с Manus OAuth и базой данных. План использует существующую архитектуру и не вводит отдельный REST-слой.

## 2. Новая data model

### 2.1 Workspace и проекты

| Сущность | Ключевые поля | Назначение и ограничения |
|---|---|---|
| `users` | `id`, OAuth identity | Существующая таблица владельцев workspace |
| `projects` | `id`, `ownerId`, `name`, `projectSlug`, `draftRevision`, `publishedRevisionId`, `theme`, `createdAt`, `updatedAt` | Приватный проект пользователя; `projectSlug` глобально уникален; `draftRevision` монотонно увеличивается при изменении Draft; `theme` содержит project-level design tokens |
| `pages` | `id`, `projectId`, `name`, `pageSlug`, `isHome`, `draftRevision`, `createdAt`, `updatedAt` | Draft-страница проекта; `pageSlug` уникален внутри проекта; ровно одна home page в валидном опубликованном проекте |
| `pageBlocks` | `id`, `pageId`, `parentBlockId  null`, `type`, `sortOrder`, `props`, `createdAt`, `updatedAt` | Только два уровня вложенности: `Page → Section → Content Block`; произвольная глубина запрещена |
| `publishedRevisions` | `id`, `projectId`, `revisionNumber`, `snapshot`, `publishedAt` | Immutable snapshot опубликованного состояния проекта, страниц, блоков и theme; публичные маршруты читают только эту сущность |

В реальной схеме для `parentBlockId` используется nullable foreign key на `pageBlocks.id`. Но серверная валидация запрещает более двух уровней. Корневые блоки имеют `parentBlockId = null` и обязаны быть `section`. Дочерние блоки имеют `parentBlockId`, указывающий на Section той же страницы, и могут быть только `text`, `image` или `button`. Content Block не может иметь детей.

`props` не является произвольным JSON на уровне приложения: поле может физически храниться в JSON-совместимом столбце для удобства, но каждая запись проходит строгую type-specific Zod-валидацию до записи и после чтения. Неизвестные поля блоков отклоняются.

### 2.2 Project-level theme / design tokens

`projects.theme` содержит единую тему проекта:

| Группа токенов | Примеры |
|---|---|
| `typography` | семейство шрифта, размеры заголовка/текста, веса, line-height |
| `colors` | background, surface, text, muted, primary, button text |
| `spacing` | базовая единица, section gap, block gap |
| `radius` | small, medium, large |
| `contentWidth` | narrow, standard, wide или числовое значение |

Блоки используют токены темы по умолчанию и хранят только необходимые overrides: например, `text.align` или `section.backgroundOverride`. Базовые цвета, spacing и радиусы не дублируются внутри каждого блока.

### 2.3 Строгие block schemas

Для каждого типа создаётся отдельная схема:

| Тип | Минимальные поля props |
|---|---|
| `section` | `layout`, `backgroundToken` или безопасный `backgroundOverride`, `spacingToken`, `contentWidthToken`, `align` |
| `text` | `content`, `variant` (`heading`/`body`/`eyebrow`), `align`, разрешённые typography overrides |
| `image` | `src`, `alt`, `fit`, `radiusToken` или безопасный override |
| `button` | `label`, `href`, `variant`, `align`; `href` допускает только безопасные схемы `https`, `http`, `mailto`, `tel` и внутренние относительные пути |

Схемы используют strict object validation и не используют `z.any()`. HTML/JS execution, `javascript:`, `data:` для ссылок, `vbscript:` и другие executable schemes запрещены. Для внешних изображений отдельно проверяется формат URL и обязательность `alt`.

## 3. Draft → Preview → Publish lifecycle

### 3.1 Draft

Редактор работает только с Draft-данными из `projects`, `pages` и `pageBlocks`. Каждое редактируемое состояние имеет монотонную версию. Для простого проекта это `projects.draftRevision`; при page/block mutation сервер также проверяет актуальность связанной page/project revision.

Каждая mutation, меняющая Draft, передаёт `expectedRevision`. Сервер атомарно обновляет данные только если текущая revision совпадает с `expectedRevision`, затем увеличивает revision. Если другая вкладка или autosave уже изменила состояние, сервер возвращает tRPC error с кодом `CONFLICT` и не выполняет запись. Клиент прекращает silent overwrite, перечитывает Draft и показывает пользователю уведомление о конфликте.

`Save` означает только сохранение Draft. Он не создаёт публичную revision и не меняет публичный сайт.

### 3.2 Preview

Preview читает текущий Draft и показывает его в изолированном canvas с viewport-переключателем desktop/tablet/mobile. Preview не создаёт revision и не изменяет данные. Он нужен для проверки того, что будет опубликовано, но публичным URL не является.

### 3.3 Publish

Publish выполняется транзакционно:

1. сервер проверяет OAuth ownership проекта;
2. сервер повторно читает актуальный Draft и проверяет `expectedRevision`;
3. сервер валидирует все страницы, иерархию Section → Content Blocks, порядок `sortOrder`, slug, theme и обязательную home page;
4. сервер создаёт глубокую immutable копию всего валидного Draft в `publishedRevisions.snapshot` с новым `revisionNumber`;
5. сервер обновляет указатель `projects.publishedRevisionId` и статус публикации в той же транзакции;
6. сервер возвращает номер опубликованной revision и public URLs.

После Publish любое редактирование Draft меняет только Draft. Уже опубликованный snapshot остаётся неизменным до следующего успешного Publish. Unpublish очищает указатель опубликованной revision в транзакции; публичные маршруты после этого возвращают 404/Not Found.

## 4. Модель публичных URL

Используется строго две формы маршрутов:

| URL | Что отображает | Правило |
|---|---|---|
| `/site/:projectSlug` | Home page проекта | Ищет глобально уникальный `projectSlug`, затем читает только `publishedRevisions.snapshot` и home page |
| `/site/:projectSlug/:pageSlug` | Дополнительная опубликованная страница | Ищет `pageSlug` внутри snapshot конкретного проекта, а не среди текущих Draft-страниц |

`projectSlug` глобально уникален среди проектов, предназначенных для публикации. `pageSlug` уникален внутри проекта. Публичный resolver не обращается к Draft-таблицам для отрисовки содержимого. Для несуществующего slug, снятой с публикации страницы или отсутствующей revision возвращается публичная 404-страница.

## 5. Полностью обновлённые этапы реализации

### Этап 1. Схема и миграция

Обновить Drizzle-модель с nullable `parentBlockId`, project/page revisions, `publishedRevisions`, project theme и уникальными индексами. Добавить foreign keys и каскадные правила. Проверить, что глобальная уникальность `projectSlug` и уникальность `pageSlug` внутри проекта реализуются ограничениями базы. Сгенерировать и применить миграцию.

### Этап 2. Серверные инварианты и доступ к данным

Вынести функции ownership-проверок для projectId, pageId и blockId. Проверять каждый вложенный ID напрямую: проверка только через переданный `projectId` недостаточна. Добавить функции чтения и изменения Draft, нормализации последовательного `sortOrder`, проверки допустимой иерархии и глубокого snapshot-копирования.

Реализовать атомарные операции для reorder, replaceAll, создания проекта из template и Publish. После reorder значения `sortOrder` должны быть последовательными и детерминированными в пределах одного parentBlockId.

### Этап 3. tRPC API

Добавить защищённые процедуры для списка и CRUD проектов, CRUD страниц, добавления/обновления/удаления блоков, reorder, replaceAll, списка templates, создания проекта из template, preview Draft, Publish, Unpublish и чтения public snapshot.

Каждая Draft mutation принимает `expectedRevision`. Процедуры возвращают новую revision. На mismatch возвращается `CONFLICT`. Для сложных мутаций Zod-схема проверяет одновременно идентификаторы, ownership-контекст и block props.

### Этап 4. Workspace и CRUD

Собрать приватный workspace с OAuth guard, списком проектов и страниц, созданием пустого проекта или проекта из шаблона, rename, duplicate и delete. Создание из template выполняется транзакционно и создаёт независимую глубокую копию pages, pageBlocks и theme; preset не сохраняется как живая ссылка.

### Этап 5. Редактор

Собрать редактор с левой панелью страниц/добавления Section, центральным canvas и правой панелью свойств. Canvas отражает только допустимую двухуровневую иерархию. Добавление, редактирование, удаление, duplicate и reorder работают через защищённые tRPC mutations с revision guard.

Autosave использует debounce, но не обходит `expectedRevision`. При `CONFLICT` интерфейс не перезаписывает данные, а предлагает загрузить свежий Draft. В верхней панели отдельно видны состояния `Saved`, `Saving`, `Conflict` и `Error`.

### Этап 6. Preview и публикация

Добавить Preview Draft с реальными viewport-контейнерами для desktop/tablet/mobile. Добавить Publish с серверной валидацией и транзакционным созданием immutable snapshot. Создать публичные маршруты `/site/:projectSlug` и `/site/:projectSlug/:pageSlug`, использующие только опубликованную revision.

### Этап 7. Тесты и проверка

Покрыть unit-тестами block schemas, href security, иерархию, theme defaults, slug rules, sortOrder normalization и deep-copy templates. Интеграционно проверить ownership каждого project/page/block ID, `expectedRevision` conflict, транзакционный reorder/replaceAll, Publish snapshot isolation и Unpublish.

Добавить E2E-сценарий: OAuth → workspace → создание из template → изменение Draft → Preview → Publish → открытие public URL → изменение Draft → проверка, что public URL не изменился → повторный Publish → проверка новой версии. Запустить TypeScript check, тесты и production build.

## 6. Что изменилось относительно исходного плана

| Пункт исходного плана | Новое решение |
|---|---|
| Плоская коллекция блоков на странице | Заменена на `Page → Section → Content Blocks`; `parentBlockId` обязателен в модели, но глубина строго ограничена двумя уровнями |
| Публикация через статус проекта и текущие данные | Заменена на immutable `publishedRevisions` snapshot; Draft и Published полностью разделены |
| Public slug без окончательной схемы | Зафиксированы `/site/:projectSlug` и `/site/:projectSlug/:pageSlug`; глобальная и внутренняя уникальность явно определены |
| Обычное сохранение/autosave | Добавлен `expectedRevision` для каждой mutation и `CONFLICT` вместо silent overwrite |
| Общая JSON-конфигурация блока | Добавлены строгие отдельные Zod-схемы для Section, Text, Image и Button без `z.any()` |
| Тема как необязательная идея | Добавлен обязательный project-level theme с typography, colors, spacing, radius и content width |
| Reorder/replaceAll как обычные операции | Сделаны транзакционными с последовательным детерминированным `sortOrder` |
| Template как источник UI-данных | Template используется только для начального состояния; создание делает глубокую независимую копию |
| Ownership через общий project context | Каждая операция дополнительно проверяет конкретные pageId и blockId на принадлежность owner/project |
| Preview и Published не разделялись достаточно строго | Preview явно читает Draft, public view — только Published Revision |

## 7. Совместимость с существующей Drizzle/tRPC архитектурой

Конфликта с текущей архитектурой нет. Drizzle уже используется для схемы и запросов, поэтому новые таблицы, nullable foreign key, индексы и транзакции добавляются в существующий `drizzle/schema.ts` и слой `server/db.ts`. tRPC уже является основным API-контрактом, поэтому защищённые процедуры и `CONFLICT` реализуются в существующем `server/routers.ts` или вынесенных feature-router файлах.

Единственное практическое ограничение — текущий шаблон использует MySQL/TiDB через `drizzle-orm/mysql2`, поэтому точный синтаксис уникальных индексов, JSON-колонки и транзакций должен соответствовать этому dialect, а не PostgreSQL/Supabase. OAuth-механизм менять не требуется: используется существующий Manus OAuth и `protectedProcedure`. Отдельный REST API, CRDT и realtime collaboration для реализации не нужны.

## 8. Критерии приёмки

MVP считается готовым, если пользователь может войти, создать приватный проект, выбрать template, редактировать только Draft в разрешённой иерархии, сохранять изменения с revision guard, открыть Preview в трёх viewport-режимах и опубликовать snapshot. Public URL должен читать только последнюю опубликованную revision; изменения Draft после Publish не должны менять публичную страницу. Любая операция с чужим или вложенным ресурсом должна быть отклонена сервером, а reorder, replaceAll, template creation и Publish должны быть атомарными.

## 9. Риски и допущения

Основной технический риск — корректно выразить глобальную уникальность `projectSlug` для всех публикуемых проектов в текущем MySQL/TiDB dialect; это будет решено database constraint плюс серверной проверкой перед Publish. Второй риск — гонка autosave; она закрывается условным update/transaction и `expectedRevision`, а не клиентским флагом. Третий риск — сложность drag-and-drop; MVP допускает drag-and-drop-style reorder с кнопками вверх/вниз как резервным управлением, но всегда сохраняет детерминированный порядок. Внешние AI API, изображения из Unsplash/Pexels и новые пользовательские функции не являются обязательной частью этого MVP.
