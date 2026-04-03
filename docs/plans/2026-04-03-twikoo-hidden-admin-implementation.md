# Twikoo Hidden Admin Entry Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Keep Twikoo comments visible while hiding the admin entry by default and enabling Twikoo's native passphrase-based reveal flow through site configuration.

**Architecture:** The change stays inside the existing Twikoo integration boundary. Extend the typed Twikoo config, configure the hidden-admin fields in site metadata, and forward those fields through `components/TwikooComments.tsx` into `twikoo.init(...)` without adding any site-managed admin state.

**Tech Stack:** Next.js 15, React 19, TypeScript, Twikoo 1.7.6, Node built-in test runner

---

### Task 1: Add regression coverage for hidden-admin config

**Files:**
- Modify: `tests/comments-regression.test.cjs`
- Test: `tests/comments-regression.test.cjs`

**Step 1: Write the failing test**

Add source assertions for the new Twikoo config shape and configured values.

```js
test('Twikoo config supports hidden admin options', () => {
  const typesSource = read('types/comments.ts')

  assert.match(typesSource, /hideAdmin/)
  assert.match(typesSource, /adminPass/)
})

test('Site metadata configures hidden Twikoo admin entry', () => {
  const metadataSource = read('data/siteMetadata.js')

  assert.match(metadataSource, /hideAdmin:\s*true/)
  assert.match(metadataSource, /adminPass:\s*['"][^'"]+['"]/)
})
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/comments-regression.test.cjs`
Expected: FAIL because the new hidden-admin fields do not exist yet in `types/comments.ts` or `data/siteMetadata.js`.

**Step 3: Write minimal implementation**

Update `types/comments.ts` to allow the new Twikoo fields, and update `data/siteMetadata.js` to configure them.

```ts
export interface TwikooConfig {
  envId: string
  lang?: string
  hideAdmin?: boolean
  adminPass?: string
}
```

```js
twikooConfig: {
  envId: 'https://comment.fortunately.top/',
  lang: 'zh-CN',
  hideAdmin: true,
  adminPass: 'your-secret-passphrase',
},
```

**Step 4: Run test to verify it passes**

Run: `node --test tests/comments-regression.test.cjs`
Expected: PASS for the new hidden-admin config assertions; other comment regressions remain green.

**Step 5: Commit**

```bash
git add tests/comments-regression.test.cjs types/comments.ts data/siteMetadata.js
git commit -m "feat: configure hidden Twikoo admin entry"
```

### Task 2: Forward hidden-admin config through Twikoo init

**Files:**
- Modify: `components/TwikooComments.tsx`
- Modify: `tests/comments-regression.test.cjs`
- Test: `tests/comments-regression.test.cjs`

**Step 1: Write the failing test**

Add an assertion that the Twikoo wrapper forwards the hidden-admin fields into the init options.

```js
test('TwikooComments forwards hidden admin options into init', () => {
  const twikooSource = read('components/TwikooComments.tsx')

  assert.match(twikooSource, /hideAdmin:\s*twikooConfig\.hideAdmin/)
  assert.match(twikooSource, /adminPass:\s*twikooConfig\.adminPass/)
})
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/comments-regression.test.cjs`
Expected: FAIL because `components/TwikooComments.tsx` currently passes only `envId`, `el`, and `lang`.

**Step 3: Write minimal implementation**

Broaden the local init options type and pass the new fields through unchanged.

```ts
type TwikooInitOptions = {
  envId: string
  el: string
  lang: string
  hideAdmin?: boolean
  adminPass?: string
}
```

```ts
;(init as TwikooInit)({
  envId: twikooConfig.envId,
  el: `#${commentElementId}`,
  lang: twikooConfig.lang ?? 'zh-CN',
  hideAdmin: twikooConfig.hideAdmin,
  adminPass: twikooConfig.adminPass,
})
```

**Step 4: Run test to verify it passes**

Run: `node --test tests/comments-regression.test.cjs`
Expected: PASS with the new forwarding assertion and no regressions in existing Twikoo integration checks.

**Step 5: Commit**

```bash
git add components/TwikooComments.tsx tests/comments-regression.test.cjs
git commit -m "feat: forward Twikoo hidden admin options"
```

### Task 3: Verify formatting and repository-level safety

**Files:**
- Modify: `components/TwikooComments.tsx`
- Modify: `data/siteMetadata.js`
- Modify: `tests/comments-regression.test.cjs`
- Modify: `types/comments.ts`

**Step 1: Run targeted verification**

Run the source-level regression test and then lint the touched code paths.

```bash
node --test tests/comments-regression.test.cjs
yarn lint
```

Expected:
- `node --test tests/comments-regression.test.cjs` passes.
- `yarn lint` passes or only reports pre-existing unrelated issues outside the touched files.

**Step 2: Fix any lint or formatting issues**

Keep changes minimal. Prefer source edits only if lint fails on the touched files.

**Step 3: Re-run verification**

```bash
node --test tests/comments-regression.test.cjs
yarn lint
```

Expected: both commands pass for the final patch set, or any remaining failure is documented as pre-existing and unrelated.

**Step 4: Final commit**

```bash
git add components/TwikooComments.tsx data/siteMetadata.js tests/comments-regression.test.cjs types/comments.ts
git commit -m "test: verify hidden Twikoo admin integration"
```

### Task 4: Prepare execution workspace before coding

**Files:**
- Modify: `.gitignore` (only if needed for a local worktree directory)

**Step 1: Use `@using-git-worktrees` before executing the plan**

If `.worktrees/` or `worktrees/` exists, verify it is ignored before creating the worktree. If neither exists, choose a worktree location before implementation starts.

**Step 2: Create an isolated worktree**

Example:

```bash
git worktree add .worktrees/twikoo-hidden-admin -b feat/twikoo-hidden-admin
```

Expected: clean isolated workspace for implementation, without disturbing unrelated changes in the current checkout.

**Step 3: Verify baseline before changes**

```bash
node --test tests/comments-regression.test.cjs
```

Expected: current comment regression suite passes before applying the feature changes.
