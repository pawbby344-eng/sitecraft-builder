# PRA-005 — API Review

## Резюме

API surface состоит из tRPC procedures, сгруппированных по доменам. Входные данные product procedures проходят Zod schemas на router boundary, а critical mutations используют revision/ownership guards. Основной выявленный gap — `workspace.projects` возвращает всю коллекцию workspace без видимой пагинации/limit, а публичные HTML routes скрывают все ошибки под 404.

## APIs identified

| Domain | Procedures |
|---|---|
| `system` | `health`, admin-only `notifyOwner` |
| `auth` | public `me`, `logout` |
| `workspace` | protected `projects` |
| `publish` | protected `status`, `publish`, `unpublish` |
| `aiEdit` | protected `state`, `createProposal`, `applyProposal`, `rejectProposal`, `setLock` |
| `siteBlocks` | protected `create`, `update`, `reorder`, `replaceAll` |
| `architect` | protected IDEA/Brief/SiteSpec state and mutations |

## Сильные стороны

`server/routers.ts:26-60` применяет input schemas к mutations/queries; shared Zod contracts валидируют block, theme, architect и publish inputs. tRPC обеспечивает typed request/response contract между client/server. Revision conflicts возвращаются как typed TRPC errors через domain handlers.

## Проблемы

### Критические/Высокие

Не выявлены.

### Средние

#### M-005-1. Workspace collection без явного pagination/limit

**Evidence:** `server/routers.ts:27` вызывает `listWorkspaceProjects(ctx.user.id)` без pagination input; `server/workspace.ts` возвращает список проектов целиком.

**Impact:** при росте числа проектов один запрос и initial UI payload будут расти линейно.

**Recommendation:** добавить cursor/limit только когда workspace collection станет реально большой; до этого зафиксировать допустимый maximum.

#### M-005-2. Public route collapses all failures to 404

**Evidence:** `server/public.ts` регистрирует public routes и превращает любой failure при loading/rendering snapshot в `404 Not found`.

**Impact:** consumer получает одинаковый response для missing site и internal rendering/dependency failure; диагностика и client semantics теряются.

**Recommendation:** разделять expected not-found от internal failure, сохраняя public-safe body.

### Низкие

Formal API versioning не используется, но для текущего внутреннего tRPC/API scope отдельная versioning scheme не обязательна.

## Риски

Рост workspace collection и скрытие внутренних ошибок в public adapter могут ухудшить предсказуемость API. Input validation, idempotency guards for publish/unpublish and stale conflicts are covered.

## План улучшений

**Epic: bounded collections.** Зафиксировать limit/cursor policy для workspace listing.

**Epic: public response semantics.** Различать 404 missing snapshot от 500 internal rendering failure без утечки деталей.

## Критерии приёмки

Все существующие product procedures mapped; inputs validated at backend; protected mutations carry typed schemas; no unbounded public collection besides workspace listing found.

## Итоговое заключение

**APIs adequate for production: Частично.** Основной contract boundary зрелый, но collection bound и public error semantics требуют улучшения.

**APIs ready within scope: Да, с оговорками.**
