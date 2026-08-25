# PRA-011 — Performance Review

## Резюме

По source evidence критических algorithmic/performance blockers не найдено. Build previously completed and produced a client bundle, but route-level lazy loading/code splitting is not visible: `App.tsx` statically imports `Workspace` and all route components. `Workspace` also rebuilds all page block arrays in preview memo and maintains a large editor component. These are medium optimization opportunities, not measured production incidents.

## Критические потоки

Initial frontend route loads `Workspace` directly from `App.tsx`. Workspace preview builds a snapshot by mapping all pages and filtering all blocks per page (`Workspace.tsx:180`). AI/publish/save flows refetch multiple queries after mutation.

## Сильные стороны

- Server operations are async; no obvious synchronous filesystem/database loop in inspected core paths.
- Preview uses `useMemo`, avoiding rebuild on unrelated renders.
- Build and E2E gates previously passed; no runtime memory leak evidence in the checked flows.

## Проблемы

### Критические/Высокие

Не выявлены измеренные проблемы.

### Средние

#### M-011-1. No visible route-level lazy loading

**Evidence:** `App.tsx:3-8` statically imports pages and `Workspace`; no `lazy()`/dynamic import in route shell.

**Impact:** initial client payload includes the main workspace and its imported UI dependencies even when route is simple.

**Recommendation:** measure production bundle first; if initial load is material, lazy-load workspace/rare routes.

#### M-011-2. Preview snapshot performs repeated page-wide filtering

**Evidence:** `Workspace.tsx:180` maps every page and calls `state.blocks.filter` per page.

**Impact:** render cost grows with pages × blocks; for MVP-sized documents likely acceptable, but large projects will amplify it.

**Recommendation:** index blocks by page once inside memo (`Map<pageId, blocks[]>`) before mapping pages.

### Низкие

No evidence of timers/listener leaks in inspected critical components; no recommendation made without measurement.

## Риски

Larger projects may increase initial bundle and preview computation. Current evidence does not show a production outage or unacceptable latency.

## План оптимизации

**Epic: measure before optimize.** Capture bundle size and preview render timings on representative project sizes.

**Task:** introduce route lazy loading or indexed block grouping only if measurements cross agreed thresholds.

## Итоговое заключение

**Performance adequate for production: Да, с оговорками.** No measured blocker found; two scale-related opportunities remain.

**Ready within scope: Да, с оговорками.**
