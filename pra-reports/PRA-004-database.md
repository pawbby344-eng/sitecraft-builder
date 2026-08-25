# PRA-004 — Database Review

## Резюме

Persistence layer использует Drizzle ORM для MySQL-family database с versioned SQL migrations и явными foreign keys/indexes. Основные product transactions и revision guards присутствуют; populated recovery proof подтвердил сохранение counts, IDs и ключевых relations. Критических и высоких database проблем по evidence не выявлено. Остались средние ограничения вокруг некоторых application-level invariants и отсутствия прямой FK для published pointer.

## Выявленная persistence layer

`drizzle/schema.ts` определяет `users`, `projects`, IDEA/Brief/SiteSpec, pages, pageBlocks, publishedRevisions, aiProposals и scopeLocks. `server/db.ts` создаёт Drizzle MySQL connection из `DATABASE_URL`. Migrations `0000`–`0004` создают schema, parentBlock FK/index и canonical generated lock identity.

## Сильные стороны

| Evidence | Вывод |
|---|---|
| `drizzle/schema.ts:47-149` | Product relations имеют foreign keys, indexes и уникальные constraints. |
| `pages_project_slug_unique` и `projectSlug.unique()` | URL identity constraints реализованы на DB level. |
| `pageBlocks.parentBlockId` + migration `0002` | Parent reference реально enforced DB foreign key. |
| migration `0004` + `scopeIdentity` unique index | Canonical lock identity защищена DB constraint. |
| `server/site-engine.ts`, `server/site-architect.ts`, `server/publish.ts` | Multi-row operations и publish/build используют transactions и revision guards. |
| Recovery proof | Fresh DB migrations + JSON restore сохранили 17/17/17/17/17/114/15/1/31 rows и zero relation violations. |
| Drizzle query usage | Проверенные application queries используют ORM predicates/parameters; evidence SQL injection не найден. |

## Проблемы

### Критические

Не выявлены.

### Высокие

Не выявлены.

### Средние

#### M-004-1. `projects.publishedRevisionId` не имеет прямого foreign key

**Evidence:** `drizzle/schema.ts:29-37` объявляет `publishedRevisionId: int("publishedRevisionId")` без `.references(() => publishedRevisions.id)`; pointer consistency проверяется в `publish.ts` atomic update и recovery proof.

**Impact:** DB сама по себе не запрещает dangling published pointer при прямом SQL/manual mutation.

**Recommendation:** рассмотреть additive FK после проверки циклической dependency order; либо сохранить invariant в migration/runbook и регулярно проверять consistency.

#### M-004-2. Same-page parent invariant остаётся application-level

**Evidence:** `pageBlocks.parentBlockId` FK в `0002` гарантирует существование parent, но не composite same-page relationship; same-page/type/depth rules выполняются shared validator/server handlers.

**Impact:** direct SQL import/manual writes могут создать cross-page parent relationship, если обходят handlers.

**Recommendation:** сохранять canonical validator для всех writes и добавить periodic integrity check/restore validation; DB composite constraint — только если dialect поддерживает её безопасно.

### Низкие

Не выявлены отдельные доказанные проблемы.

## Риски

Остаточный риск связан с тем, что два важных invariants — published pointer target и same-page hierarchy — не полностью выражены прямыми relational constraints. Runtime handlers и recovery proof их защищают, но arbitrary direct SQL path может обойти эти проверки.

## План улучшений

**Epic: усилить DB-level invariants.** Оценить additive FK для published pointer с безопасным migration order.

**Epic: защитить restore/manual SQL paths.** Сохранить integrity checker в recovery/runbook и запускать его после import.

## Критерии приёмки

Текущие migrations, counts, IDs, ownership relations, parent references, revision, lock и published checks прошли recovery proof. Полный DB-level sign-off требует отдельного решения по двум application-level invariants.

## Итоговое заключение

**Persistence layer adequate for production: Да, с оговорками.** Drizzle/migrations/transactions и основные constraints подтверждены; два pointer/hierarchy invariant остаются handler-enforced.

**Database prepared for production within this scope: Да, с оговорками.**
