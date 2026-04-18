# Evaluation

Debug Drive includes a small deterministic benchmark suite for demo and regression testing.

## Current Demo Benchmark Suite

The suite contains 6 TypeScript cases:

- Empty array handling
- Missing default value
- Whitespace and empty-value parsing
- One-based pagination
- Safe feature-flag default
- Existing seeded compile validation case

## Latest Benchmark Result

```text
Benchmark Cases: 6
Success Rate: 100.0%
Validation Pass Rate: 100.0%
pass@k: 100.0%
fix@k: 100.0%
Average Rounds Used: 1.17
```

## Latest Ablation Comparison

```text
Normal Success Rate: 100.0%
No-RAG Success Rate: 100.0%
```

## Summary Table

| Evaluation | Cases | Success Rate | Validation Pass Rate | pass@k | fix@k |
|---|---:|---:|---:|---:|---:|
| Normal | 6 | 100.0% | 100.0% | 100.0% | 100.0% |
| No-RAG Ablation | 6 | 100.0% | 100.0% | 100.0% | 100.0% |

## Report Artifacts

Debug Drive writes generated benchmark reports under:

```text
.debug-drive-memory/benchmark-summaries/
```

Reports are generated in both JSON and Markdown formats.

## Interpretation

The current benchmark suite is intentionally deterministic so the demo is reliable. The deterministic mock provider can solve these controlled benchmark cases with or without RAG.

The next evaluation milestone is to add harder real-model benchmarks where retrieval impact can be measured more meaningfully.
