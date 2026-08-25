# PRA-014 — Code Quality Review

## Резюме

Code quality достаточен для MVP и поддерживается строгими schemas/tests, но несколько production modules заметно крупные: `Workspace.tsx` около 45 KB, `site-architect.ts` около 16 KB, `site-engine.ts` около 11 KB, `publish.ts` около 8.5 KB. Критической duplication/dead-code проблемы не подтверждено; средний risk — multi-responsibility functions/modules.

## Сильные стороны

- Domain names (`site-engine`, `site-architect`, `ai-edit`, `publish`) описывают назначение.
- Shared validators/schemas уменьшают semantic duplication.
- Existing comments document non-obvious auth/storage behavior.
- Prettier/check scripts exist.

## Проблемы

### Критические/Высокие

Не выявлены.

### Средние

#### M-014-1. Крупные multi-responsibility modules

**Evidence:** file inventory: `Workspace.tsx` 45,730 bytes; `site-architect.ts` 16,241; `site-engine.ts` 11,422; `ai-edit.ts` 12,924. `Workspace` concurrently owns UI state, API orchestration, builder, AI, publish and preview.

**Impact:** changes require navigating large files and increase maintenance/regression risk.

**Recommendation:** split only along real domain boundaries during future feature work; avoid mechanical fragmentation now.

#### M-014-2. Dense one-line async handlers reduce readability

**Evidence:** `Workspace.tsx:199-228` contains several one-line try/catch handlers with mutation, state reset and refetch operations.

**Impact:** error/side-effect order is harder to review and modify safely.

**Recommendation:** format into named command functions with explicit phases when next touched.

### Низкие

Some template UI files are large, but no behavior risk was established; no refactor recommended solely on size.

## Риски

Future changes to large modules can accidentally affect unrelated flows. Current tests mitigate, but complexity remains a maintenance cost.

## Итоговое заключение

**Internal code quality adequate: Да, с оговорками.** No critical quality blocker; modular decomposition is a medium-priority maintainability improvement.

**Ready from code-quality perspective: Да, с оговорками.**
