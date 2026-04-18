# Debug Drive

**Debug Drive is an agentic VS Code debugging assistant that detects failing code context, proposes patches, validates them in a sandbox, and applies accepted fixes with review and rollback.**

It combines multi-agent debugging, repository retrieval, safe patch execution, benchmark evaluation, and reward-based strategy selection into a demo-ready developer tooling prototype.

## Key Features

- **Agent loop:** Debugger, Critic, and Tester agents collaborate across patch proposal, review, and validation.
- **Auto debug workflow:** Opens an active file, infers bug context from diagnostics/demo cases, and runs the right validation command.
- **RAG context:** Retrieves accepted fix memories, indexed code chunks, and symbol-level repository context.
- **Safe patching:** Applies candidate diffs in sandbox copies before exposing accepted patches for live review.
- **Rollback-aware live apply:** Applies accepted patches only after confirmation and saves rollback snapshots.
- **Evaluation harness:** Runs benchmarks, ablations, pass@k/fix@k, reward metrics, and grouped difficulty/category reports.
- **Model abstraction:** Supports mock and OpenAI provider paths with transcript logging and fallback handling.

## Architecture

```text
VS Code Commands
      |
      v
DebugCoordinator
      |
      +-- Retrieval Layer
      |     +-- fix memories + code chunks + symbols
      |
      +-- Debugger Agent
      |     +-- model-backed patch proposal
      |
      +-- Critic Agent
      |     +-- patch review
      |
      +-- Tester Agent
            +-- sandbox patch application + validation
```

Accepted sessions generate patch artifacts, session reports, benchmark summaries, and rollback snapshots.

## Quick Demo

1. Open a demo bug, for example:

```text
src/demo/items.ts
```

2. Run:

```text
Debug Drive: Auto Debug Active File
```

3. Review the accepted result:

```text
Status: ACCEPT
Validation: passed
Patch Safety: sandbox-validated
Live Apply: review-required
```

4. Apply or inspect artifacts:

```text
Debug Drive: Apply Accepted Patch
Debug Drive: Open Latest Session Report
Debug Drive: Open Latest Accepted Patch
```

Full walkthrough: [docs/demo.md](docs/demo.md)

## Evaluation Snapshot

Current deterministic benchmark suite:

| Evaluation | Cases | Success Rate | Validation Pass Rate | pass@k | fix@k |
|---|---:|---:|---:|---:|---:|
| Normal | 6 | 100.0% | 100.0% | 100.0% | 100.0% |
| No-RAG Ablation | 6 | 100.0% | 100.0% | 100.0% | 100.0% |

Reports include difficulty/category breakdowns and are exported as Markdown and JSON.

More detail: [docs/evaluation.md](docs/evaluation.md)

## Setup

```powershell
npm install
npm run compile
```

Run the extension from VS Code using **Run Extension**, then execute Debug Drive commands from the Command Palette.

## Commands

```text
Debug Drive: Auto Debug Active File
Debug Drive: Run Debug Session
Debug Drive: Apply Accepted Patch
Debug Drive: Open Latest Session Report
Debug Drive: Open Latest Accepted Patch
Debug Drive: Open Latest Benchmark Report
Debug Drive: Index Repository
Debug Drive: Seed Benchmark Case
Debug Drive: Run Benchmarks
Debug Drive: Run Ablation Comparison
```

## Project Status

Completed through **Phase 20: Final Demo Polish + Real-World Readiness**.

Debug Drive is demo-ready as a flagship AI developer-tooling project. The next improvements would be codebase refactoring, stronger real-model reliability, and larger real-world benchmark suites.
