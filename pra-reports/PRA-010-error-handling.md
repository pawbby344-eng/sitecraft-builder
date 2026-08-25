# PRA-010 — Error Handling Review

## Резюме

Backend domain handlers и frontend mutations обычно используют try/catch либо tRPC error propagation, а `ErrorBoundary` покрывает основной React tree. Но boundary выводит stack trace в UI, public adapter маскирует все ошибки под 404, а `useAuth` содержит пустой catch при очистке sessionStorage. Это даёт medium/high quality risks, хотя критического silent failure в core mutation flow не найдено.

## Стратегия обработки

Backend использует `TRPCError` для expected business conflicts/validation; frontend mutation handlers переводят exceptions в UI messages. `App.tsx:39-49` оборачивает UI в `ErrorBoundary`. Public route adapter (`server/public.ts`) возвращает `404 Not found` на любой failure.

## Сильные стороны

- Core mutation handlers имеют explicit conflict/validation error paths.
- `Workspace.tsx:189-259` обрабатывает AI/save/publish failures и показывает user-safe fallback messages.
- `App.tsx` имеет global React ErrorBoundary.
- Async startup failure имеет terminal catch в `server/_core/index.ts:68`.

## Проблемы

### Критические

Не выявлены.

### Высокие

#### H-010-1. Stack trace выводится пользователю

**Evidence:** `client/src/components/ErrorBoundary.tsx:36-39` рендерит `this.state.error?.stack` в `<pre>`.

**Impact:** внутренние файлы, runtime details и stack information раскрываются в browser UI production.

**Recommendation:** показывать user-safe error ID/message; stack отправлять только в internal error tracking/logging.

### Средние

#### M-010-1. Public adapter смешивает not-found и internal failure

**Evidence:** `server/public.ts` collapses loading/render errors into same 404 response.

**Impact:** client cannot distinguish absent route from service failure; diagnosis is harder.

**Recommendation:** preserve safe 404 for absent snapshot and return controlled 500 for internal failure.

#### M-010-2. Empty catch при sessionStorage cleanup

**Evidence:** `useAuth.ts:45-47` contains `try { sessionStorage.removeItem(...) } catch {}`.

**Impact:** cleanup failure is silently ignored; low impact, but no signal exists when storage is unavailable.

**Recommendation:** intentionally ignore only documented browser storage exceptions or use a no-op helper with comment/telemetry.

### Низкие

Некоторые frontend catch blocks compress error handling into one line, reducing readability but not proving incorrect behavior.

## Риски

Production UI может раскрыть stack traces. Public service failures могут выглядеть как missing site. Browser storage failures remain silent.

## План коррекции

**Epic: safe user-facing errors.** Replace stack rendering with error reference and internal reporting.

**Epic: response semantics.** Split public not-found from internal failure.

**Epic: explicit cleanup policy.** Document controlled ignore for storage exceptions.

## Итоговое заключение

**Error handling adequate for production: Частично.** Core flows have handling, but stack exposure is a real medium/high concern.

**Ready within scope: Да, с оговорками.**
