# External Repository Smoke Test

Use this checklist to validate Debug Drive outside its own repository.

## Candidate Repository Criteria

- Small TypeScript or JavaScript project
- Has `package.json`
- Has a test or compile script
- Contains a simple reproducible bug or allows introducing one locally

## Procedure

1. Open the external repository in VS Code.
2. Run:

```text
Debug Drive: Index Repository
```

3. Open the buggy source file.
4. Run:

```text
Debug Drive: Auto Debug Active File
```

5. Record:

- Repository name
- Target file
- Validation command
- Final decision
- Test result
- Patch risk
- Whether live apply was used
- Session report path

## Result Template

```text
Repository:
Bug:
Language:
Validation command:
Final decision:
Validation passed:
Patch risk:
Applied live:
Notes:
```

## Honesty Rule

Failures are useful. Record rejected patches, invalid diffs, weak retrieval, and unsafe patch decisions. Do not convert exploratory smoke tests into success claims unless the generated report supports them.
