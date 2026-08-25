# PRA-016 — Design Patterns Review

## Резюме

Проект уже использует несколько осознанных patterns: Strategy-like `AIProvider`, adapter-like storage/OAuth wrappers, composition through tRPC routers, and tree validation for page blocks. По проверенному коду нет evidence, что отсутствие нового классического pattern уже вызывает functional problem; также нет доказанного over-engineering blocker.

## Patterns identified

| Pattern | Evidence | Assessment |
|---|---|---|
| Strategy/Provider abstraction | `server/ai-provider.ts` and manual/provider paths | Реально позволяет работать без внешнего AI и тестировать deterministic path. |
| Adapter | `server/storage.ts`, OAuth/runtime wrappers | Изолирует Manus-specific integration from product services. |
| Composition/root registration | `server/routers.ts` | Domain procedures composed in one typed boundary. |
| Tree/Composite-like model | `parentBlockId`, shared hierarchy validator | Page → Section → Content Block rules are centralized. |

## Сильные стороны

Patterns используются там, где есть реальная замена провайдера, внешнего storage или tree structure. No broad inheritance or global mutable singleton was found in inspected product paths.

## Opportunities and deviations

### Critical/High

Не выявлены.

### Средние

#### M-016-1. Future Workspace decomposition may benefit from explicit command/controller split

**Evidence:** `Workspace.tsx` combines editor, AI, publish, builder and preview flows. This is a recurring responsibility cluster, but current MVP has one primary workspace consumer.

**Impact:** further feature growth may increase coupling.

**Recommendation:** if the component continues growing, use domain hooks/commands as a small composition boundary. Do not introduce a framework-wide mediator/event bus now.

### Низкие

No over-engineering case demonstrated. No new Factory/Builder/Observer/State pattern recommended without a repeated symptom.

## Риски

The only evidence-supported risk is future coupling in the large Workspace component. Existing Strategy/Adapter choices reduce integration coupling rather than add unnecessary abstraction.

## Итоговое заключение

**Project has real need for new design patterns: Частично.** A future local decomposition may help, but no immediate new classic pattern is required.

**Relevant over-engineering exists: Нет.**

**This module identified a production blocker: Нет.**
