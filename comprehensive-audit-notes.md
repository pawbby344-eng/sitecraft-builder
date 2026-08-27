# Comprehensive Audit Notes

## Scope
Проверка выполняется без изменения application architecture и без External Runtime Migration.

## Static/dependency evidence
- `git diff --check` выполнен в рамках audit command; результат нужно подтвердить финальным clean run.
- `pnpm audit --prod` обнаружил production dependency advisories, включая `drizzle-orm@0.44.6` (patched >=0.45.2), `axios@1.12.2` (несколько advisories, patched ranges >=1.13.5/1.15.1/1.15.2/1.16.0), `express@4.21.2 -> path-to-regexp@0.1.12` (patched >=0.1.13), `recharts@2.15.4 -> lodash@4.17.21`, `streamdown@1.4.0 -> mermaid@11.12.0 -> lodash-es@4.17.23`. Upgrade impact is not applied during this audit.
- Source scan found only intentional test fixtures/comments and expected OAuth token handling; no tracked private key or obvious API key pattern was found. `test-results/.last-run.json` is tracked and should be reviewed as repository hygiene.
- Built output contains no source maps; Vite reports a non-blocking main JS chunk warning around 883 kB minified.

## GitHub gems checked
- `microsoft/playwright`: 95,228 stars, active, not archived — existing E2E foundation is appropriate.
- `dequelabs/axe-core`: 7,447 stars, active, not archived — suitable for future automated accessibility checks.
- `eslint-community/eslint-plugin-security`: 2,372 stars, active, not archived — suitable for Node security linting.
- `aquasecurity/trivy`: 37,652 stars, active, not archived — suitable for broader dependency/SBOM/secrets scanning.
- `renovatebot/renovate`: 22,353 stars, active, not archived — suitable for dependency update automation.
- These tools were evaluated only; no dependencies or project configuration were changed during the audit.
