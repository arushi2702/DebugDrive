# Debug Drive

Debug Drive is a VS Code extension prototype for RL-inspired, multi-agent code debugging. It coordinates Debugger, Critic, and Tester agents, uses execution feedback from a sandbox, stores accepted fix memories, performs vector-style retrieval, and records learning/reward traces for research experimentation.

## Current Capabilities

- Multi-agent debugging loop with Debugger, Critic, and Tester roles.
- Iterative critique, revision, validation, and final accept/reject decisions.
- Sandboxed patch artifacts, working-copy files, and per-run experiment summaries.
- Local retrieval memory for accepted fixes.
- Vector-style semantic retrieval with similarity scores and thresholding.
- Learning records with rewards, reward explanations, success rate, and retrieved-memory influence.
- Repository namespace tracking for future cross-repo indexing.

## Development

Install dependencies:

```powershell
npm install
```

Compile:

```powershell
npm run compile
```

Run the extension from VS Code using `Run Extension`, then execute:

```text
Debug Drive: Run Debug Session
```

## Prototype Status

This project is currently a research prototype. Candidate patches are materialized into sandbox working-copy files and artifacts, but are not yet applied back to the live repository. Future phases will add real embeddings, LLM-backed agents, true patch application/rollback, benchmark evaluation, and production hardening.
