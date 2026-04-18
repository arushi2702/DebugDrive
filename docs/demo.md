# Debug Drive Demo

This walkthrough shows the polished Phase 20 flow: open a buggy file, auto-debug it, review artifacts, apply the accepted patch, and verify the fix.

## 1. Start From A Known Bug

Open:

```text
src/demo/items.ts
```

The file intentionally returns `undefined` for an empty array:

```ts
export function getItems(items: string[]): string[] {
  if (items.length === 0) {
    return undefined as unknown as string[];
  }

  return items;
}
```

Run:

```powershell
npm run compile
node ./out/demo/items.test.js
```

Expected failure:

```text
AssertionError: undefined !== []
```

## 2. Run Auto Debug

Launch the extension in VS Code and run:

```text
Debug Drive: Auto Debug Active File
```

For demo files, Debug Drive infers the bug statement, validation command, and error output automatically. For normal files, it uses VS Code diagnostics and `package.json` script inference when available.

Expected session summary:

```text
Status: ACCEPT
Validation: passed
Critic: approved
Patch Safety: sandbox-validated
Live Apply: review-required
Session Report: .debug-drive/session-reports/session-....md
```

Expected accepted patch:

```diff
--- a/src/demo/items.ts
+++ b/src/demo/items.ts
@@
-    return undefined as unknown as string[];
+    return [];
```

## 3. Review Artifacts

Use the post-accept buttons or Command Palette:

```text
Debug Drive: Open Latest Session Report
Debug Drive: Open Latest Accepted Patch
```

Reports and patches are written under:

```text
.debug-drive/
```

## 4. Apply The Accepted Patch

Run:

```text
Debug Drive: Apply Accepted Patch
```

Debug Drive checks that the live file has not changed since validation, asks for confirmation, writes a rollback snapshot, and then applies the accepted patch.

Expected output:

```text
--- Live Patch Applied ---
Status: applied to live workspace
Rollback Snapshot: .debug-drive/live-rollbacks/...
```

Verify:

```powershell
npm run compile
node ./out/demo/items.test.js
```

Expected result:

```text
Demo item tests passed.
```

Restore the demo bug before recording another run:

```powershell
git restore src/demo/items.ts
```

## 5. Show Evaluation

Run:

```text
Debug Drive: Run Benchmarks
Debug Drive: Run Ablation Comparison
Debug Drive: Open Latest Benchmark Report
```

The generated reports include success rate, validation pass rate, pass@k, fix@k, reward, retrieval metrics, and difficulty/category breakdowns.

## One-Line Explanation

```text
Debug Drive is an agentic debugging assistant that retrieves context, proposes and critiques patches, validates them in a sandbox, applies accepted fixes with rollback, and generates evaluation reports.
```
