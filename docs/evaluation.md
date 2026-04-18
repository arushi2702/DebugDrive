# Evaluation

Debug Drive includes a deterministic benchmark suite for demos, regression checks, and research-style reporting.

## Benchmark Suite

The current suite contains 6 TypeScript cases:

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

## Latest Demo Snapshot

```text
Benchmark Cases: 6
Success Rate: 100.0%
Validation Pass Rate: 100.0%
pass@k: 100.0%
fix@k: 100.0%
Average Rounds Used: ~1.3
```

## Ablation Snapshot

```text
Normal Success Rate: 100.0%
No-RAG Success Rate: 100.0%
```

The deterministic mock provider can solve the controlled demo cases with or without RAG. Retrieval impact should be evaluated more meaningfully on harder real-model benchmarks.

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
