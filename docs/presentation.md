# Presentation Package

Use this file to prepare the GitHub, resume, and interview story for Debug Drive.

## 90-Second Demo Script

1. Open `src/demo/items.ts` and show the failing empty-array branch.
2. Run `Debug Drive: Auto Debug Active File`.
3. Show `Status: ACCEPT`, `Patch Safety`, `Patch Risk`, and `Session Report`.
4. Open the accepted patch.
5. Apply the patch with rollback.
6. Run the target test and show it passing.
7. Open the benchmark report and show difficulty/category breakdowns.

## Resume Bullet

Built **Debug Drive**, an agentic VS Code debugging assistant that retrieves repository context and prior validated fixes, proposes and critiques patches, validates them in sandboxed copies, applies accepted fixes with rollback protection, and benchmarks repair performance with ablation reports and reward-based strategy selection.

## Interview Talking Points

- Why a Debugger/Critic/Tester loop instead of one agent
- How sandbox validation prevents unsafe live edits
- How accepted-fix memory and symbol retrieval ground patch proposals
- How reward-based strategy selection uses prior validated sessions
- How patch risk scoring classifies low/medium/high-risk changes
- Why benchmark failures are reported instead of hidden

## Limitations

- Real-world success depends on model quality and available validation commands.
- Current benchmark suite is still smaller than academic repair datasets.
- Mock-provider runs are for deterministic demo/regression testing, not proof of model capability.
- Real OpenAI-backed results should be reported separately from mock results.
