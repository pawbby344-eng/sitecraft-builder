# PRA-009 — Observability Review

## Резюме

Observability в repository минимальная: есть health procedure и runtime console logging, но не обнаружены structured logging, request/trace correlation, application metrics, readiness checks, tracing, alerts или error-tracking integration. Для MVP это ограничивает production diagnosis; критических доказательств нефиксируем, но есть высокий operational gap.

## Выявленная observability

`server/_core/systemRouter.ts` содержит public `health` procedure. `server/_core/index.ts:63-68` логирует startup/error через `console`; application-wide logging package/metrics/tracing integration в inspected source не найден. Error tracking provider и versioned alerts не обнаружены.

## Сильные стороны

- Health endpoint существует.
- Runtime startup failure не остаётся полностью silent: `startServer().catch(console.error)`.
- Hardening/recovery evidence содержит ручные release logs, но это не заменяет runtime observability.

## Проблемы

### Критические

Не выявлены.

### Высокие

#### H-009-1. Нет request correlation и structured logs

**Evidence:** source search обнаружил `console.*`, но не request ID/trace ID middleware или structured logger.

**Impact:** связать publish/apply/save failure с конкретным request и пользователем в production будет трудно.

**Recommendation:** добавить request correlation ID и JSON event logs для critical mutations, не логируя secrets/payloads целиком.

#### H-009-2. Нет error tracking integration

**Evidence:** source search не обнаружил Sentry/Datadog/OpenTelemetry/error tracker.

**Impact:** browser/server exceptions могут быть видны только в runtime logs и потеряться без централизованного aggregation.

**Recommendation:** подключить error tracker на deployment boundary или задокументировать внешнюю систему и проверку ingestion.

### Средние

#### M-009-1. Health check не проверяет критические dependencies

**Evidence:** `systemRouter.health` возвращает `{ ok: true }` после numeric timestamp input; evidence DB/AI/storage readiness check отсутствует.

**Impact:** liveness может оставаться green при недоступной database/AI/storage dependency.

**Recommendation:** разделить liveness и readiness; readiness проверяет необходимые runtime dependencies.

### Низкие

Метрики и alerts не найдены в repository; для текущего scope это unverified rather than доказанный functional bug.

## Риски

Системные сбои могут обнаруживаться поздно, а расследование будет зависеть от разрозненных text logs. Нельзя доказать latency/error-rate monitoring из repository.

## План улучшений

**Epic: correlation and logs.** Добавить request ID, structured event levels и redaction policy.

**Epic: production error visibility.** Подключить/зафиксировать error tracking.

**Epic: readiness.** Добавить dependency-aware readiness check.

## Итоговое заключение

**Observability adequate for production: Нет, с точки зрения evidence coverage.** Health exists, но production diagnosis/alerting не подтверждены.

**Application ready from observability perspective: Нет.**
