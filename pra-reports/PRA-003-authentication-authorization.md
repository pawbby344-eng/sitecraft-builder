# PRA-003 — Authentication & Authorization

## Резюме

Authentication/authorization реализованы через Manus OAuth, server-side context и централизованные tRPC procedures. Product mutations в router защищены `protectedProcedure`, а domain handlers дополнительно проверяют owner/project/page/block scope и revision. Критических и высоких bypass evidence не найдено. Есть две оговорки: rate limiting/brute-force control не найден в приложении, а cookie policy использует `SameSite=None` и динамический `Secure`.

## Выявленный поток

`server/_core/oauth.ts` обрабатывает OAuth callback, проверяет `code` и state/nonce cookie, обменивает authorization code, upsert-ит пользователя, создаёт session cookie и redirect-ит на `/`. `server/_core/context.ts` получает user через SDK authentication; `server/_core/trpc.ts` определяет `protectedProcedure` с `UNAUTHORIZED` и `adminProcedure` с `FORBIDDEN`. `server/routers.ts:26-60` оборачивает workspace, publish, AI edit, block и architect operations в protected procedures.

## Сильные стороны

| Evidence | Вывод |
|---|---|
| `server/_core/trpc.ts:13-45` | Auth middleware централизован; protected/admin semantics единообразны. |
| `server/routers.ts:26-60` | Product mutations не опубликованы как public procedures. |
| `server/site-engine.ts:43-107` | Ownership проверяется на project/page/block levels перед mutation. |
| `server/ai-edit.ts:62-134` | AI context, scope, locks и stale revision проверяются на сервере. |
| `server/site-architect.ts:54-245` | IDEA/Brief/SiteSpec operations проверяют owner и stale fingerprints/revisions. |
| `server/_core/oauth.ts` | OAuth callback содержит state/nonce consistency check перед token exchange. |

## Проблемы

### Критические

Не выявлены.

### Высокие

Не выявлены.

### Средние

#### M-003-1. Rate limiting для auth flow не подтверждён

**Evidence:** локальная проверка auth/runtime surface не нашла rate limiter, attempt counter или temporary lock logic; OAuth callback в `server/_core/oauth.ts` не содержит application-level throttling.

**Impact:** защита от злоупотребления auth callback и repeated requests зависит от внешнего OAuth provider/infrastructure.

**Recommendation:** подтвердить rate limiting на deployment edge или добавить узкий limiter для callback и auth-sensitive endpoints.

#### M-003-2. Cookie `SameSite=None` расширяет cross-site отправку

**Evidence:** `server/_core/cookies.ts:42-47` возвращает `sameSite: "none"`; `secure` вычисляется из request protocol/forwarded proto.

**Impact:** cookie допускает cross-site context шире, чем `lax`; безопасность зависит от корректной trusted proxy configuration.

**Recommendation:** если продуктовый flow не требует cross-site cookie, использовать `lax`; отдельно зафиксировать trusted proxy policy для `x-forwarded-proto`.

### Низкие

Не выявлены отдельные подтверждённые проблемы.

## Риски

Реальный остаточный риск — отсутствие доказанного application-level brute-force protection и более широкая cookie cross-site policy. Ownership и protected route gaps по проверенным product paths не обнаружены.

## План коррекции

**Epic: auth abuse controls.** Подтвердить или добавить rate limiting на auth-sensitive entry points.

**Epic: session cookie tightening.** Проверить необходимость `SameSite=None`, зафиксировать proxy trust и оставить `Secure` только для HTTPS production.

## Критерии приёмки

Критерии будут полностью подтверждены после evidence rate limiting, проверки cookie policy в production deployment и сохранения auth regression tests.

## Итоговое заключение

**Система authentication/authorization adequate for production: Да, с оговорками.** Центральная защита маршрутов и ownership guards подтверждены, но rate limiting и cookie deployment policy требуют отдельного подтверждения.

**Проект безопасен в рамках этого scope: Да, с оговорками.**
