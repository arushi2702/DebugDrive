# Debug Drive

**Debug Drive is an agentic VS Code debugging assistant that proposes patches, critiques them, validates them in a sandbox, and evaluates results with benchmark and ablation reports.**

It combines multi-agent debugging, retrieval-augmented context, sandboxed patch validation, rollback-safe artifacts, model-provider abstraction, and reward-based learning traces into one developer-tooling prototype.

## Key Features

- Multi-agent debugging with a Debugger, Critic, and Tester loop
- Sandbox-based patch validation with no automatic live workspace mutation
- Retrieval-augmented debugging over accepted fixes and indexed code chunks
- Mock and OpenAI model-provider paths with safe fallback handling
- Benchmark and ablation evaluation with Markdown/JSON reports

## Architecture

```text
VS Code Command
      |
      v
DebugCoordinator
      |
      +-- Retrieval Layer
      |     +-- fix memories + code chunks
      |
      +-- Debugger Agent
      |     +-- model-backed patch proposal
      |
      +-- Critic Agent
      |     +-- patch review + revision feedback
      |
      +-- Tester Agent
            +-- sandbox patch application + validation
```

Debug Drive validates candidate patches in sandbox project copies and exports accepted patch artifacts for review.

## Quick Demo

1. Run the failing demo test:

```powershell
npm run demo:test
```

2. Launch the extension and run:

```text
Debug Drive: Run Debug Session
```

3. Observe:

- Patch proposed
- Critic approved
- Sandbox validation passed
- Accepted patch artifact exported
- Live repository remains unchanged by default

Full walkthrough: [docs/demo.md](docs/demo.md)

## Why It Matters

Debug Drive explores how AI agents can:

- Safely debug code without directly mutating live environments
- Reuse past fixes and repository context through retrieval
- Validate patches with execution feedback
- Evaluate debugging behavior with reproducible benchmarks

This bridges LLM agents, software engineering tooling, and research-style evaluation.

## Evaluation Snapshot

Current deterministic demo benchmark suite:

| Evaluation | Cases | Success Rate | Validation Pass Rate | pass@k | fix@k |
|---|---:|---:|---:|---:|---:|
| Normal | 6 | 100.0% | 100.0% | 100.0% | 100.0% |
| No-RAG Ablation | 6 | 100.0% | 100.0% | 100.0% | 100.0% |

More detail: [docs/evaluation.md](docs/evaluation.md)

## Setup

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

## Commands

```text
Debug Drive: Run Debug Session
Debug Drive: Index Repository
Debug Drive: Apply Accepted Patch
Debug Drive: Seed Benchmark Case
Debug Drive: Run Benchmarks
Debug Drive: Run Ablation Comparison
```

## Project Status

Completed through **Phase 13: Expanded Evaluation Proof**.

Next planned phases:

- Phase 14: Launch packaging with screenshots and architecture polish
- Phase 15: Symbol-aware repository intelligence
- Phase 16: Strategy learning / RL-style policy selection

