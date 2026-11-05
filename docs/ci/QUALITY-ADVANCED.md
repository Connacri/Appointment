# Advanced quality reference (optional, not enabled)

Reference implementation for the extra CI jobs described in `AGENTS.md` §25.
It is **not** wired into the repository yet: enabling it requires
`playwright.config.ts` with `phone` / `tablet` / `desktop` projects, the `e2e/`
suite, `lighthouserc.json` budgets, and the `npm run screenshots` script.
Enable the jobs one by one, behind a pull request, only when the prerequisites exist.

# APPENDIX E — `.github/workflows/quality-advanced.yml`

```yaml
name: Advanced Quality

# E2E device x language matrix (incl. RTL), Lighthouse budgets, CodeQL, store screenshots.
# Assumes: playwright.config.ts with projects phone / tablet / desktop, tests in e2e/,
# env E2E_LOCALE (fr|en|ar) read by the app/tests, lighthouserc.json with budgets,
# npm scripts: build, screenshots.

on:
  pull_request:
  push:
    branches: [main]
    tags: ['v*.*.*']
  schedule:
    - cron: '0 4 * * 1'      # weekly deep scan (CodeQL)
  workflow_dispatch:

permissions:
  contents: read

concurrency:
  group: adv-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: ${{ github.event_name == 'pull_request' }}

env:
  NODE_VERSION: ${{ vars.NODE_VERSION || '22' }}

jobs:
  e2e:
    name: E2E ${{ matrix.device }} · ${{ matrix.locale }}
    runs-on: ubuntu-latest
    timeout-minutes: 25
    strategy:
      fail-fast: false
      matrix:
        device: [phone, tablet, desktop]
        locale: [fr, en, ar]          # ar runs in RTL
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: npm
      - run: npm ci
      - run: npx playwright install --with-deps
      - name: Run E2E (light + dark, visual + accessibility checks inside the tests)
        env:
          E2E_LOCALE: ${{ matrix.locale }}
        run: npx playwright test --project=${{ matrix.device }}
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: e2e-report-${{ matrix.device }}-${{ matrix.locale }}
          path: |
            playwright-report/
            test-results/
          retention-days: 14

  lighthouse:
    name: Lighthouse budgets
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: npm
      - run: npm ci
      - run: npm run build
      - uses: treosh/lighthouse-ci-action@v12
        with:
          configPath: ./lighthouserc.json
          uploadArtifacts: true

  codeql:
    name: CodeQL
    runs-on: ubuntu-latest
    timeout-minutes: 30
    permissions:
      contents: read
      security-events: write
    steps:
      - uses: actions/checkout@v4
      - uses: github/codeql-action/init@v3
        with:
          languages: javascript-typescript
      - uses: github/codeql-action/analyze@v3

  store-screenshots:
    name: Localized store screenshots
    if: startsWith(github.ref, 'refs/tags/v')
    runs-on: ubuntu-latest
    timeout-minutes: 25
    strategy:
      matrix:
        locale: [fr, en, ar]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: npm
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - name: Capture phone + tablet screenshots
        env:
          E2E_LOCALE: ${{ matrix.locale }}
        run: npm run screenshots        # writes store/screenshots/${E2E_LOCALE}/{phone,tablet}/*.png
      - uses: actions/upload-artifact@v4
        with:
          name: store-screenshots-${{ matrix.locale }}
          path: store/screenshots/${{ matrix.locale }}/
          retention-days: 90
```

---


---

# APPENDIX F — `.github/dependabot.yml`

```yaml
version: 2
updates:
  - package-ecosystem: npm
    directory: /
    schedule: { interval: weekly }
    groups:
      minor-and-patch:
        update-types: [minor, patch]
    open-pull-requests-limit: 10
  - package-ecosystem: gradle
    directory: /android
    schedule: { interval: weekly }
  - package-ecosystem: github-actions
    directory: /
    schedule: { interval: weekly }
```
---

