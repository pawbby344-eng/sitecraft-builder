# PRA-006 — Frontend Review

## Резюме

Frontend организован вокруг `DashboardLayout`, `Workspace`, shared UI components и tRPC client. Основные loading/error/empty states присутствуют, а client/server boundary по проверенному импорту соблюдается. Главные gaps — крупный `Workspace.tsx` с большим числом API mutations/state responsibilities и запись user info в localStorage.

## Frontend identified

React 19 + wouter route shell в `client/src/App.tsx`; страницы `Workspace`, `Home`, `NotFound`, UI components и tRPC hooks. `DashboardLayout` обеспечивает authenticated shell и navigation. Backend API communication централизована через `client/src/lib/trpc.ts`, но hooks используются непосредственно в `Workspace`.

## Сильные стороны

- `Workspace.tsx:266-269` имеет loading, query error и empty workspace states.
- `App.tsx:20-28` имеет основной route, redirect `/home` и fallback `NotFound`.
- `client/src` не импортирует server/Drizzle по boundary grep.
- Product calls используют typed tRPC hooks вместо ad-hoc fetch wrappers.

## Проблемы

### Критические/Высокие

Не выявлены.

### Средние

#### M-006-1. Workspace концентрирует presentation, API orchestration и editor state

**Evidence:** `Workspace.tsx:101-259` содержит project/page/block selection, draft state, save mutations, AI proposal flow, locks, publish/unpublish и preview.

**Impact:** изменения UI затрагивают большой компонент и повышают риск регрессий при расширении.

**Recommendation:** при следующем feature split выделять editor state/API controllers по доменам, не переписывая текущий MVP без необходимости.

#### M-006-2. Пользовательские данные дублируются в localStorage

**Evidence:** `useAuth.ts:53-70` записывает `meQuery.data` в `localStorage` под `manus-runtime-user-info`.

**Impact:** browser storage остаётся доступным JavaScript и может содержать персональные profile fields; это не session secret, но лишняя копия данных.

**Recommendation:** хранить только необходимый публичный display state или полностью убрать persistence user profile.

### Низкие

Не выявлены другие подтверждённые frontend blockers.

## Риски

Основные риски — сложность дальнейшей поддержки `Workspace` и избыточная client-side persistence profile data. Визуальная route gating не рассматривается как backend authorization; backend protected procedures остаются источником контроля.

## План улучшений

**Epic: modularize Workspace on next feature.** Выделить editor, AI, publish and builder sections with stable typed props.

**Epic: minimize browser storage.** Убрать или минимизировать cached user object.

## Итоговое заключение

**Frontend adequate for production: Да, с оговорками.** Critical flows and states exist; maintainability and storage minimization remain improvements.

**Frontend ready within scope: Да, с оговорками.**
