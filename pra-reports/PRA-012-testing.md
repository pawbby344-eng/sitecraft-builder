# PRA-012 — Testing Review

## Резюме

Test strategy зрелая для MVP: Vitest unit/integration suite покрывает architect, editor, publish, AI/locks, security/hardening и workspace; Playwright покрывает production browser flow. Recovery/populated migration scripts также дали real-DB evidence. Ограничение — в repository не обнаружен versioned CI pipeline, а authenticated E2E зависит от storageState setup.

## Стратегия тестов

Frameworks: Vitest (`pnpm test`) и Playwright (`pnpm test:e2e`). Test files включают `site-architect`, `site-engine`, `workspace`, `publish`, `ai-edit`, `security.hardening`, `auth.logout` и hierarchy validator; E2E spec — `e2e/stage7-hardening.spec.ts`. Ранее подтверждены 53 Vitest tests и authenticated Playwright flow.

## Сильные стороны

- Реальные DB integration tests для Stage 3/Workspace/Publish/AI.
- Regression coverage для image URL, CSS/theme validation, concurrency, locks и stale revision.
- Browser E2E проверяет Create → Build → Editor → AI → Preview → Publish/Re-publish/Unpublish → reload/session/stale tab.
- Recovery proof отдельно проверяет migration/import integrity.

## Проблемы

### Критические

Не выявлены.

### Высокие

#### H-012-1. CI execution не evidentiated in repository

**Evidence:** file inventory нашёл package scripts и tests, но `.github`, Docker CI или other versioned pipeline files не найдены.

**Impact:** локальные gates могут не запускаться автоматически перед release; quality depends on operator discipline.

**Recommendation:** добавить minimal CI workflow with check/test/build and authenticated E2E strategy, либо явно document external pipeline.

### Средние

#### M-012-1. Authenticated E2E требует отдельного storageState setup

**Evidence:** `playwright.config.ts` и `e2e/stage7-hardening.spec.ts` используют authenticated state; release run required export script.

**Impact:** fresh contributor/CI environment может получить skip/launch failure без documented setup.

**Recommendation:** сохранить setup/restore procedure и fail-fast when auth state is missing, не превращая critical E2E в silent skip.

### Низкие

No evidence of excessive mocking in the core real-DB suites; manual AI provider path exists for deterministic tests.

## Риски

Без CI automation tests can be omitted from release. E2E setup operational friction can reduce repeatability.

## План улучшений

**Epic: reproducible test gate.** Version CI workflow and authenticated E2E setup.

**Task:** make missing storageState explicit failure in release job and preserve test reports/artifacts.

## Итоговое заключение

**Testing strategy adequate for production: Да, с оговорками.** Coverage is strong, but CI/reproducibility evidence is incomplete.

**Ready from testing perspective: Да, с оговорками.**
