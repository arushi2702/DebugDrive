# Real-Model Evaluation

Debug Drive supports both deterministic mock runs and OpenAI-backed model-provider runs.

## Goal

Use real-model evaluation to answer:

- Does the model return valid structured patch proposals?
- How often does fallback handling trigger?
- Which benchmark categories are solved without hardcoded mock behavior?
- How do OpenAI-backed runs compare against deterministic mock runs?

## How To Run

1. Configure VS Code settings:

```json
{
  "debugDrive.modelProvider": "openai",
  "debugDrive.openaiModel": "gpt-4o-mini",
  "debugDrive.openaiApiKey": "YOUR_KEY"
}
```

2. Run:

```text
Debug Drive: Run Benchmarks
```

3. Open:

```text
Debug Drive: Open Latest Benchmark Report
```

Reports record provider and model columns for each run. If no valid API key is configured, Debug Drive records fallback behavior rather than pretending a real-model run happened.

## Reporting Rule

Do not publish real-model success rates unless they come from generated Debug Drive benchmark reports. Mock-provider results and OpenAI-provider results should be reported separately.
