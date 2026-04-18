# Evaluation

Debug Drive includes a deterministic benchmark suite for demos, regression checks, and research-style reporting.

## Benchmark Suite

The demo suite contains 6 TypeScript cases:

- Empty array handling
- Missing default value
- Whitespace and empty-value parsing
- One-based pagination
- Safe feature-flag default
- Existing seeded compile validation case

Each benchmark case can include:

- Difficulty: `easy`, `medium`, or `hard`
- Category: `edge-case`, `defaults`, `parsing`, `state`, `validation`, or `other`
- Expected final action
- Validation command
- Error output

Phase 21 adds a tracked built-in mixed suite under `src/demo/realistic` with realistic bug categories such as null handling, API misuse, off-by-one logic, authorization state, config defaults, and expected hard failures.

## Metrics

Generated reports include:

- Success rate
- Validation pass rate
- pass@k
- fix@k
- Average reward
- Average rounds used
- Retrieved memory/code context counts
- Retrieval vs no-retrieval success rates
- Difficulty breakdown
- Category breakdown
- Failure analysis
- Patch risk summaries in session reports

## Latest Demo Snapshot

```text
Demo Benchmark Cases: 6
Built-in Mixed Cases: 15+
Metrics: measured per run
Failure Analysis: included in generated reports
```

## Ablation Snapshot

```text
Normal Success Rate: 100.0%
No-RAG Success Rate: 100.0%
```

The deterministic mock provider can solve the controlled demo cases with or without RAG. The built-in mixed suite intentionally includes harder cases and expected failures so evaluation reports are less synthetic.

## Report Artifacts

Benchmark reports are generated under:

```text
.debug-drive-memory/benchmark-summaries/
```

Session reports are generated under:

```text
.debug-drive/session-reports/
```

Both JSON and Markdown benchmark summaries are produced for reproducibility.

## Next Evaluation Milestones

- Add 20-50 real-world style benchmark cases.
- Add no-symbols and no-strategy ablations.
- Compare mock and OpenAI-backed runs.
- Add failure analysis for rejected or invalid patches.
