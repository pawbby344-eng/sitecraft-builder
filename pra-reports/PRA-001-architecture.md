# PRA-001 — Architecture Review

## Резюме

Архитектура SiteCraft — серверный модульный монолит с React-клиентом, tRPC boundary, shared domain schemas и Drizzle persistence layer. Для текущего MVP структура в целом пригодна для эксплуатации, но отдельные server-модули концентрируют несколько связанных потоков, а `routers.ts` выступает центральным composition root. Критических и высоких архитектурных проблем по проверенным evidence не выявлено.

## Выявленная архитектура

Проект разделён на `client/`, `server/`, `shared/` и `drizzle/`. Frontend содержит страницы и UI-компоненты; backend — tRPC routers, domain services (`site-engine.ts`, `site-architect.ts`, `ai-edit.ts`, `publish.ts`), auth/runtime adapters; shared-слой содержит schemas, validators, renderer и domain types. Основной паттерн — модульный монолит с типизированным RPC boundary.

## Сильные стороны

| Evidence | Вывод |
|---|---|
| `server/routers.ts:15-62` группирует `workspace`, `publish`, `aiEdit`, `siteBlocks`, `architect` | API composition организован по доменам, а не одной плоской таблицей процедур. |
| `shared/site-engine/*` содержит schemas, hierarchy validator, renderer и editor helpers | Общие контракты вынесены из UI и backend, что уменьшает расхождение правил. |
| `client/src` не импортирует `server/` или `drizzle/` по проверенному cross-boundary grep | Серверные зависимости не затягиваются напрямую в клиентский слой. |
| `server/site-architect.ts` и `server/site-engine.ts` отделены от tRPC registration | Процедуры роутера не содержат основную бизнес-логику. |

## Проблемы

### Критические

Не выявлены.

### Высокие

Не выявлены.

### Средние

#### M-001. Растущая концентрация нескольких use-case потоков в отдельных server-модулях

**Evidence:** `server/site-architect.ts` одновременно содержит IDEA/Brief/SiteSpec lifecycle, persistence и build orchestration; `server/site-engine.ts` содержит ownership checks, validation, hierarchy operations и mutations. Для MVP это ещё читаемо, но дальнейшее расширение увеличит размер change surface.

**Impact:** изменения в одном домене могут затрагивать крупный модуль и усложнять локальное тестирование.

**Recommendation:** при следующем функциональном расширении выделять use-case modules по lifecycle/command, не переписывая текущий flow заранее.

#### M-002. Центральный router composition root требует дисциплины границ

**Evidence:** `server/routers.ts:15-62` импортирует и соединяет все основные домены в одном файле.

**Impact:** файл остаётся удобным composition root, но может стать точкой конфликтов при росте команды.

**Recommendation:** сохранить его только как registration layer; новые domain handlers не помещать туда напрямую.

### Низкие

Не выявлены отдельные доказанные нарушения архитектурных границ.

## Риски

Основной подтверждённый риск — рост server domain modules и router composition root вместе с расширением продукта. На текущем объёме это не блокирует production, но требует контроля при добавлении новых функций.

## План улучшений

**Epic: удержать модульность при росте.** Текущая структура уже достаточна для MVP.

**Задача:** при добавлении нового домена создавать отдельный service/router module.

**Подзадачи:** держать регистрацию в `routers.ts`, shared schemas в `shared/`, а persistence и use cases в server domain modules; добавлять integration test на новую границу.

## Критерии приёмки

Для текущего scope критерии выполнены: слои различимы, client/server boundary соблюдается по проверенному grep, domain procedures вынесены из router registration, критических циклов или нарушений слоёв не обнаружено.

## Итоговое заключение

**Архитектура пригодна для эволюции: Да, с оговорками.** Для текущего MVP структура модульного монолита достаточна. Оговорка относится к будущему росту `site-architect.ts`, `site-engine.ts` и `routers.ts`, а не к текущему release blocker.

**Архитектурно готово к production в рамках этого scope: Да, с оговорками.**
