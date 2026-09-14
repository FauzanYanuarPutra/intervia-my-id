# Security History Hygiene Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore a trustworthy green Security workflow without disabling secret scanning or broadly allowlisting real credentials, while separating historical false positives from genuine credential-risk remediation.

**Architecture:** Keep Gitleaks enabled as a required security control, add a repository-owned configuration that documents narrowly scoped historical false-positive fingerprints/paths only after verification, and separately remove current-tree generated/browser artifacts from version control protection. Historical findings that could represent real credentials remain blocked until proven synthetic/revoked. The workflow must scan both the current tree and Git history so future regressions remain detectable.

**Tech Stack:** GitHub Actions, Gitleaks 8.x, Git, YAML/TOML, existing monorepo CI.

**Spec:** User instruction to maximize repository quality, with current failure evidence from Security run 34786846277 on `main` commit `eece946b30464604d30dcfc508cb99a5fa14b8a1`.

## Global Constraints

- Do not disable the `Secret scan` job.
- Do not switch Gitleaks to current-tree-only scanning as a way to hide historical findings.
- Do not allowlist broad rules such as `generic-api-key` globally.
- Do not expose or reproduce redacted secret values in repository changes.
- Treat any historical token/key-shaped finding as potentially real until its current-tree status and provenance are verified.
- Keep dependency/security audits that are currently passing unchanged unless evidence requires a targeted change.
- Prefer exact fingerprint/path/commit exceptions only for verified synthetic or non-secret findings.

---

### Task 1: Classify the failing Gitleaks findings

**Files:**
- Inspect: `.github/workflows/security.yml`
- Inspect: `.github/workflows/kyc-runtime-contract.yml`
- Inspect: `.env.example`
- Inspect: `.env.staging.example`
- Inspect: `.env.production.example`
- Inspect: `frontend/www/src/app/api/webhooks/whatsapp-meta/route.ts`
- Inspect historical removed browser-profile paths under `.codex-chrome-home-scroll*`

**Interfaces:**
- Consumes: Gitleaks job log from Security run `34786846277`.
- Produces: a classification of each finding family as `current real risk`, `historical real-risk candidate`, or `verified synthetic/false positive`.

- [ ] **Step 1: Verify current-tree presence for every finding family**

Use GitHub file reads/searches for the exact paths reported by Gitleaks. Record whether each file/value pattern still exists on `main`.

- [ ] **Step 2: Separate generated browser-profile artifacts from application configuration**

Confirm whether `.codex-chrome-home-scroll*` is absent from the current tree and whether `.gitignore` prevents reintroduction.

- [ ] **Step 3: Separate documented placeholders from credential-shaped values**

Inspect example env files and docs without copying sensitive values. Synthetic placeholders can be narrowly allowlisted; plausible live credentials cannot.

- [ ] **Step 4: Confirm why the scanner fails**

Reconcile the workflow (`fetch-depth: 0`) with Gitleaks' `--all` history scan and the reported commits. Expected conclusion: the job is failing on historical commits, not because the other audit jobs are broken.

- [ ] **Step 5: Commit the classification plan only after evidence is complete**

No production behavior change in this task.

### Task 2: Add narrow Gitleaks repository policy

**Files:**
- Create: `.gitleaks.toml`
- Modify only if necessary: `.github/workflows/security.yml`

**Interfaces:**
- Consumes: Task 1 classification.
- Produces: Gitleaks configuration that preserves full-history scanning while excluding only verified non-secret historical findings.

- [ ] **Step 1: Add exact allowlist entries for verified false positives**

Use exact `commits`, `paths`, or `regexTarget` constraints. Do not add a global rule allowlist for `generic-api-key`.

- [ ] **Step 2: Keep the action on full history**

Retain `actions/checkout@v7` with `fetch-depth: 0` and the Gitleaks action.

- [ ] **Step 3: Add configuration comments explaining every exception family**

Each exception must state why it is non-secret/synthetic and what prevents recurrence.

- [ ] **Step 4: Validate TOML syntax and Gitleaks behavior**

Expected: verified false positives disappear, unresolved credential-shaped findings still fail the scan.

- [ ] **Step 5: Commit**

Commit message: `fix(security): classify historical gitleaks findings`.

### Task 3: Harden generated/local artifact exclusion

**Files:**
- Modify: `.gitignore`

**Interfaces:**
- Consumes: Task 1 evidence for historical `.codex-chrome-home-scroll*` artifacts.
- Produces: ignore rules preventing local browser/profile state from being committed again.

- [ ] **Step 1: Add root and recursive ignore patterns for `.codex-chrome-home-scroll*` directories**

The rule must ignore the directories themselves, not only screenshots generated inside them.

- [ ] **Step 2: Verify legitimate source files are not matched**

Check pattern scope against repository naming.

- [ ] **Step 3: Commit**

Commit message: `chore(repo): ignore local codex browser profiles`.

### Task 4: Handle genuine historical credentials safely

**Files:**
- Potentially modify: example env/docs/source files only when a current-tree credential-shaped value remains.
- Documentation: security remediation note if credential rotation/history rewrite is required.

**Interfaces:**
- Consumes: Task 1 classification.
- Produces: explicit remediation for any plausible historical credential, without pretending an allowlist removes exposure.

- [ ] **Step 1: For current-tree credentials, replace with unmistakable placeholders**

Examples should use values such as `replace-with-your-token` rather than high-entropy strings.

- [ ] **Step 2: For historical credentials, do not allowlist until rotation status is known**

If a historical value may have been live, record that rotation/revocation is required. A Git history rewrite is a separate consequential operation and must not be performed silently.

- [ ] **Step 3: Re-run/inspect Security workflow result on the branch**

Expected: only unresolved genuine-risk findings may remain red; all false positives should be eliminated.

### Task 5: Repository PR/branch hygiene after security gate is trustworthy

**Files:**
- Inspect: open PRs and branches.

**Interfaces:**
- Consumes: a trustworthy security gate from Tasks 1-4.
- Produces: a categorized cleanup set for Dependabot vs. human feature branches.

- [ ] **Step 1: Confirm human open PR count**

Current evidence shows zero non-Dependabot open PRs; re-check before mutation.

- [ ] **Step 2: Do not merge bulk dependency groups blindly**

Prioritize security/compatibility-sensitive upgrades and CI-green groups; avoid combining React/toolchain major-risk changes with unrelated product work.

- [ ] **Step 3: Identify stale human branches whose commits are already contained in `main`**

Delete only after ancestry/merge verification. Branch deletion is consequential and must be evidence-backed.

### Task 6: Verification before completion

**Files:**
- No new files required.

**Interfaces:**
- Consumes: all previous tasks.
- Produces: evidence-backed completion status.

- [ ] **Step 1: Verify branch diff**

No scanner disabling, no broad secret-rule allowlist, no leaked values in comments/config.

- [ ] **Step 2: Verify Security workflow jobs**

Confirm Secret scan, Trivy, Cargo audit, npm audit, Hex audit, and Python audits on the resulting commit.

- [ ] **Step 3: Report remaining risks explicitly**

If credential rotation or history rewrite remains unresolved, state it as an open security item rather than claiming the repository is perfect.
