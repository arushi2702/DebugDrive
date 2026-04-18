# Debug Drive

Debug Drive is a VS Code extension prototype for agentic debugging. It runs a Debugger-Critic-Tester loop, retrieves related code/fix memories, validates candidate patches in a sandbox, exports accepted patch artifacts, and generates benchmark/ablation reports.

The goal is to build a safe debugging assistant that can reason over code, propose fixes, test them outside the live workspace, and learn from previous debugging sessions.

## Current Status

Completed through **Phase 10**.

Debug Drive currently supports:

- Multi-agent debugging sessions with Debugger, Critic, and Tester agents
- RAG-style retrieval over accepted fixes and indexed code chunks
- Learning records with rewards, success rate, and reward explanations
- Model provider abstraction with a deterministic mock provider for demos
- Structured model transcripts and parser fallback handling
- Unified diff parsing and sandbox patch application
- Accepted patch export with rollback metadata
- Benchmark evaluation with success rate, validation pass rate, pass@k, and fix@k
- Ablation comparison for normal vs no-RAG runs
- Markdown and JSON evaluation reports
- A reliable TypeScript demo bug path

## Demo

The demo bug lives in:

```text
src/demo/items.ts
```

The live file intentionally returns `undefined` for an empty array:

```ts
return undefined as unknown as string[];
```

Run:

```powershell
npm run demo:test
```

Expected before Debug Drive runs:

```text
AssertionError: undefined !== []
```

Then launch the extension and run:

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

Expected Debug Drive result:

```text
Next Action: accept
Critic Approved: true
Test Passed: true
```

The accepted patch is exported as an artifact instead of being applied directly to the live workspace:

```diff
-    return undefined as unknown as string[];
+    return [];
```

## Commands

Available VS Code commands:

```text
Debug Drive: Run Debug Session
Debug Drive: Index Repository
Debug Drive: Apply Accepted Patch
Debug Drive: Seed Benchmark Case
Debug Drive: Run Benchmarks
Debug Drive: Run Ablation Comparison
```

## Evaluation

Debug Drive can run saved benchmark cases and produce reports under:

```text
.debug-drive-memory/benchmark-summaries/
```

Current report metrics include:

- Success rate
- Validation pass rate
- pass@k
- fix@k
- Average reward
- Average rounds used
- Retrieved memory count
- Retrieved code chunk count
- Retrieval usefulness metrics

Generated `.debug-drive/` and `.debug-drive-memory/` artifacts are ignored by Git.

### Current Demo Benchmark Suite

The current demo benchmark suite contains 6 TypeScript cases:

- Empty array handling
- Missing default value
- Whitespace and empty-value parsing
- One-based pagination
- Safe feature-flag default
- Existing seeded compile validation case

Latest demo benchmark result:

```text
Benchmark Cases: 6
Success Rate: 100.0%
Validation Pass Rate: 100.0%
pass@k: 100.0%
fix@k: 100.0%
Average Rounds Used: 1.17

## Development

Install dependencies:

```powershell
npm install
```

Compile:

```powershell
npm run compile
```

Run the demo test:

```powershell
npm run demo:test
```

Run the extension from VS Code using `Run Extension`, then execute Debug Drive commands from the Command Palette.

## Model Provider Configuration

Debug Drive supports a deterministic mock provider for demos and an OpenAI provider for real model-backed patch proposals.

By default, Debug Drive uses:

```text
debugDrive.modelProvider = mock

## Roadmap

Planned next phases:

- Phase 11: Real LLM provider and stronger patch flow
- Phase 12: Product UX polish
- Phase 13: Expanded benchmark suite and evaluation proof
- Phase 14: Launch packaging with screenshots and architecture diagram
- Phase 15: Symbol-aware repository intelligence
- Phase 16: Strategy learning / RL-style policy selection

## Prototype Note

Debug Drive is a work in progress.
