# Debug Drive Demo

Use the included demo bug to show the full Debug Drive workflow.

## 1. Show The Live Bug

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
npm run demo:test
```

Expected failure:

```text
AssertionError: undefined !== []
```

This proves the live repository still contains the bug before Debug Drive runs.

## 2. Run Debug Drive

Launch the extension in VS Code and run:

```text
Debug Drive: Run Debug Session
```

Use these inputs:

```text
Bug description:
getItems returns undefined for an empty array but should return []

Validation command:
npm run demo:test

Error output:
AssertionError: undefined !== [] at getItems([])
```

## 3. Show The Accepted Sandbox Result

Expected session summary:

```text
--- Session Summary ---
Status: ACCEPT
Validation: passed
Critic: approved
Patch Materialized: true
Patch Validated: true
Patch Safety: sandbox-validated
Live Apply: review-required
```

Expected final decision:

```text
Next Action: accept
Critic Approved: true
Test Passed: true
```

Accepted patch:

```diff
--- a/src/demo/items.ts
+++ b/src/demo/items.ts
@@
-    return undefined as unknown as string[];
+    return [];
```

Debug Drive validates the patch in a sandbox copy and exports an accepted patch artifact. It does not directly mutate the live workspace by default.

## 4. Show Safety Behavior

Run the live test again:

```powershell
npm run demo:test
```

It should still fail on the live file.

This demonstrates the safety model:

```text
Debug Drive validates candidate fixes in sandbox artifacts first.
Live workspace changes require review.
```

## 5. Show Benchmark Evaluation

Run:

```text
Debug Drive: Run Benchmarks
```

Choose:

```text
normal
```

Expected output:

```text
Benchmark Cases: 6
Successful Runs: 6
Success Rate: 100.0%
Validation Pass Rate: 100.0%
pass@k: 100.0%
fix@k: 100.0%
```

Open the generated Markdown report from:

```text
.debug-drive-memory/benchmark-summaries/
```

## 6. Show Ablation Comparison

Run:

```text
Debug Drive: Run Ablation Comparison
```

Expected output:

```text
Benchmark Cases: 6

--- Mode: normal ---
Success Rate: 100.0%

--- Mode: no-rag ---
Success Rate: 100.0%
```

Open the generated ablation Markdown report from:

```text
.debug-drive-memory/benchmark-summaries/
```

## One-Line Demo Explanation

```text
Debug Drive is an agentic debugging assistant. It retrieves related context, proposes a patch, critiques it, validates it in a sandbox, exports an accepted patch artifact, and evaluates performance with benchmark and ablation reports without directly mutating the live workspace.
```
