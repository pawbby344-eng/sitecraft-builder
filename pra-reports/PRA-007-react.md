# PRA-007 — React Review

## Резюме

React implementation в основном соблюдает Rules of Hooks и использует cleanup для resize listener. Главный подтверждённый React issue — side effect в `useMemo` auth hook; дополнительно `Workspace` содержит много связанных local states/effects, что повышает сложность, но не доказывает runtime bug.

## Компоненты и Hooks

`App.tsx` — route/composition shell; `DashboardLayout` — layout and resize behavior; `Workspace` — editor/builder/publish/AI UI; `useAuth` — auth query/logout/redirect; `ThemeContext` — theme context. `Workspace` использует несколько `useEffect`, `useMemo`, mutation hooks и local state variables.

## Сильные стороны

- `App.tsx:11-14` navigation side effect выполняется в `useEffect`, не во время render.
- `DashboardLayout` resize listener имеет cleanup по inspected overview.
- `Workspace.tsx:125-128` stabilizes query input через `useMemo`.
- Условные hooks calls в inspected components не обнаружены.

## Проблемы

### Критические/Высокие

Не выявлены нарушения Rules of Hooks.

### Средние

#### M-007-1. Side effect внутри `useMemo`

**Evidence:** `useAuth.ts:53-70` вызывает `localStorage.setItem(...)` внутри `useMemo`.

**Impact:** `useMemo` предназначен для вычисления значения, но здесь выполняется внешняя запись; React может переиспользовать/пропустить memoization, и поведение становится менее очевидным.

**Recommendation:** перенести persistence в отдельный `useEffect` с явными dependencies, а `state` оставить pure derivation.

#### M-007-2. Большой компонент с несколькими независимыми state transitions

**Evidence:** `Workspace.tsx:101-259` объединяет editor, AI, publish и builder state/effects.

**Impact:** сложнее отслеживать effect dependencies и reset semantics при смене project/page.

**Recommendation:** при следующем изменении выделять domain hooks/components; текущий code не требует срочного rewrite.

### Низкие

Не выявлены отдельные проблемы cleanup или render-time side effects.

## Риски

Side effect in memo может дать непредсказуемую persistence semantics в будущих React changes; большой component surface увеличивает риск state synchronization regression.

## План улучшений

**Epic: pure React derivation.** Перенести localStorage write из memo в effect и покрыть behavior test.

**Epic: controlled state decomposition.** Выделить editor/AI/publish hooks только при следующем feature work.

## Итоговое заключение

**React implementation adequate for production: Частично.** Rules of Hooks и critical cleanup выглядят корректно, но `useAuth` memo side effect следует исправить.

**React layer ready within scope: Да, с оговорками.**
