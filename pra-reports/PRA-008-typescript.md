# PRA-008 — TypeScript Review

## Резюме

Compiler config включает `strict: true`, `noEmit` и `skipLibCheck`; основная типизация backend/shared paths сильная благодаря Zod/Drizzle inference. В frontend обнаружены локальные `any`/широкие assertions, прежде всего в `Workspace.tsx`, а `noUncheckedIndexedAccess` не включён. Критических проблем нет, но type safety в UI не полностью однородна.

## Конфигурация

`tsconfig.json:4-20` включает `strict: true`, `esModuleInterop`, `moduleResolution: bundler`, `noEmit`; `noUncheckedIndexedAccess` явно отсутствует, `skipLibCheck: true`. Tests исключены из compiler include via `**/*.test.ts`.

## Сильные стороны

- Strict mode включён.
- Shared schemas и Drizzle `$inferSelect/$inferInsert` дают типы для domain/data layer.
- `useAuth.ts` использует `unknown` в catch и `TRPCClientError` narrowing.
- Проверенный `pnpm check` ранее проходил без TypeScript errors.

## Проблемы

### Критические

Не выявлены.

### Высокие

Не выявлены.

### Средние

#### M-008-1. Explicit `any` в production frontend

**Evidence:** `Workspace.tsx` использует `brief`/`siteSpec` state и `page: any` в builder/render summary по inspected source overview.

**Impact:** compiler не проверяет форму architect payload в этих участках; изменения SiteSpec/Brief могут проявиться только runtime.

**Recommendation:** использовать exported `Brief`, `SiteSpec` и `Page` types/shared schemas вместо `any`.

#### M-008-2. Широкие assertions на API state

**Evidence:** `Workspace.tsx:119,129` приводит query data через `as WorkspaceProject[]` и `as ArchitectState | undefined`.

**Impact:** assertion принимает несоответствующий runtime shape без проверки.

**Recommendation:** сохранять tRPC inferred types или parse boundary для внешнего payload; не использовать assertion как validation.

#### M-008-3. `noUncheckedIndexedAccess` не включён

**Evidence:** `tsconfig.json:4-20` не содержит flag.

**Impact:** индексирование массивов/словарей может быть оптимистично typed, особенно в editor code.

**Recommendation:** оценить включение flag после локальной стабилизации ошибок, отдельно от текущего release.

### Низкие

Не выявлены `@ts-ignore`/`@ts-expect-error` по быстрому source inventory.

## Риски

Главный остаточный риск — runtime shape mismatch в builder/editor UI, скрытый explicit any/assertions. Strict compiler существенно снижает общий риск, но не заменяет runtime schema validation.

## План улучшений

**Epic: remove UI any.** Заменить builder state types на shared architect types.

**Epic: tighten compiler flags.** Включить `noUncheckedIndexedAccess` в отдельной проверяемой change set.

## Итоговое заключение

**TypeScript usage adequate for production: Частично.** Strict baseline хороший, но UI weak spots подтверждены.

**Typing ready within scope: Да, с оговорками.**
