import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { DebugCoordinator } from '../core/coordinator';
import { MalformedMockModelProvider } from '../llm/malformedMockModelProvider';
import { ExperimentStore } from '../rag/experimentStore';
import { LearningStore } from '../rag/learningStore';
import { RepositoryIndexer } from '../rag/repositoryIndexer';
import { RetrievalStore } from '../rag/retriever';
import { RewardCalculator } from '../rag/reward';
import { SimpleVectorizer } from '../rag/vectorizer';
import { BenchmarkRunResult, BugContext } from '../types/agent';
import { BenchmarkStore } from '../evaluation/benchmarkStore';
import { BenchmarkRunner } from '../evaluation/benchmarkRunner';
import { MetricsCalculator } from '../evaluation/metrics';
import { ModelProviderFactory, ModelProviderSelection } from '../llm/modelProviderFactory';
import { StrategySelector } from '../rag/strategySelector';
import { PatchApplier } from '../sandbox/patchApplier';
import { ParsedPatch } from '../types/agent';

const RETRIEVAL_TOP_K = 3;
const SIMILARITY_THRESHOLD = 0.75;

interface AcceptedPatchReference {
  repositoryPath: string;
  targetFilePath: string;
  absoluteTargetPath: string;
  acceptedPatchPath: string;
  candidateDiff: string;
  originalContent: string;
  parsedPatch: ParsedPatch;
  createdAt: number;
}

let latestAcceptedPatch: AcceptedPatchReference | undefined;

function findNearestProjectRoot(filePath: string): string {
  let currentDir = path.dirname(filePath);

  while (true) {
    const packageJsonPath = path.join(currentDir, 'package.json');

    if (fs.existsSync(packageJsonPath)) {
      return currentDir;
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      return path.dirname(filePath);
    }

    currentDir = parentDir;
  }
}

function findBenchmarkRepositoryRoot(startPath: string): string {
  let currentDir = fs.existsSync(startPath) && fs.statSync(startPath).isDirectory()
    ? startPath
    : path.dirname(startPath);

  while (true) {
    const benchmarkCasesPath = path.join(currentDir, '.debug-drive-memory', 'benchmark-cases.json');

    if (fs.existsSync(benchmarkCasesPath)) {
      return currentDir;
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      return findNearestProjectRoot(startPath);
    }

    currentDir = parentDir;
  }
}

function findCommandRepositoryRoot(activeEditor: vscode.TextEditor | undefined): string | undefined {
  if (activeEditor) {
    return path.resolve(findBenchmarkRepositoryRoot(activeEditor.document.uri.fsPath));
  }

  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

  if (!workspaceFolder) {
    return undefined;
  }

  return path.resolve(findBenchmarkRepositoryRoot(workspaceFolder.uri.fsPath));
}

function findCommandRepositoryRootOrWarn(
  activeEditor: vscode.TextEditor | undefined,
  action: string,
): string | undefined {
  const repositoryPath = findCommandRepositoryRoot(activeEditor);

  if (!repositoryPath) {
    vscode.window.showWarningMessage(`Open a workspace folder or source file before ${action}.`);
  }

  return repositoryPath;
}

function resolveValidationCommandForActiveFile(
  filePath: string,
  command: string | undefined,
): string | undefined {
  if (command?.trim() !== 'npm run demo:test') {
    return command || undefined;
  }

  const demoValidationCommands = new Map<string, string>([
    [path.join('src', 'demo', 'items.ts'), 'npm run compile && node ./out/demo/items.test.js'],
    [path.join('src', 'demo', 'defaults.ts'), 'npm run compile && node ./out/demo/defaults.test.js'],
    [path.join('src', 'demo', 'parser.ts'), 'npm run compile && node ./out/demo/parser.test.js'],
    [path.join('src', 'demo', 'pagination.ts'), 'npm run compile && node ./out/demo/pagination.test.js'],
    [path.join('src', 'demo', 'flags.ts'), 'npm run compile && node ./out/demo/flags.test.js'],
  ]);

  return demoValidationCommands.get(filePath) ?? command;
}

async function runDebugSessionWithCoordinator(
  coordinator: DebugCoordinator,
  outputChannel: vscode.OutputChannel,
  providerSelection?: ModelProviderSelection,
): Promise<void> {
  const activeEditor = vscode.window.activeTextEditor;

  if (!activeEditor) {
    vscode.window.showWarningMessage(
      'Open the relevant source file before running Debug Drive so the agents can inspect real code context.',
    );
    return;
  }

  const problemStatement = await vscode.window.showInputBox({
    prompt: 'Describe the bug or failing behavior',
    placeHolder: 'Example: Unit test fails because parseUser returns null for valid input',
    ignoreFocusOut: true,
  });

  if (!problemStatement) {
    vscode.window.showWarningMessage('Debug Drive needs a bug description to start.');
    return;
  }

  const failingCommand = await vscode.window.showInputBox({
    prompt: 'Enter the test or execution command to validate fixes',
    placeHolder: 'Example: npm test -- userParser.spec.ts',
    ignoreFocusOut: true,
  });

  const errorOutput = await vscode.window.showInputBox({
    prompt: 'Paste failing test output or runtime error details',
    placeHolder: 'Example: Expected [], received undefined at parseItems (line 42)',
    ignoreFocusOut: true,
  });

  const absoluteFilePath = activeEditor.document.uri.fsPath;
  const blockedInternalPaths = [
    `${path.sep}.debug-drive${path.sep}`,
    `${path.sep}.debug-drive-memory${path.sep}`,
  ];

  if (blockedInternalPaths.some((blockedPath) => absoluteFilePath.includes(blockedPath))) {
    vscode.window.showWarningMessage(
      'Open a real repository source file, not a Debug Drive internal artifact or memory file, before running a debug session.',
    );
    return;
  }

  const repositoryPath = findNearestProjectRoot(absoluteFilePath);
  const repositoryName = path.basename(repositoryPath);
  const memoryPath = path.join(repositoryPath, '.debug-drive-memory');
  const retrievalStore = new RetrievalStore(memoryPath);
  const vectorizer = new SimpleVectorizer();
  const learningStore = new LearningStore(memoryPath);
  const experimentStore = new ExperimentStore(memoryPath);
  const rewardCalculator = new RewardCalculator();
  const strategySelector = new StrategySelector();

  const selectedCode = activeEditor.document.getText(activeEditor.selection);
  const fullCode = activeEditor.document.getText();
  const relevantCode = selectedCode && selectedCode.trim().length > 0 ? selectedCode : fullCode;
  const queryEmbeddingText = [problemStatement, errorOutput ?? '', relevantCode].join('\n');
  const queryEmbedding = await vectorizer.embedText(queryEmbeddingText);
  const rankedEmbeddingRecords = retrievalStore
    .searchEmbeddingRecords(queryEmbedding, RETRIEVAL_TOP_K)
    .filter((rankedRecord) => rankedRecord.similarity >= SIMILARITY_THRESHOLD);
  const rankedCodeChunkRecords = retrievalStore
    .searchCodeChunkRecords(queryEmbedding, RETRIEVAL_TOP_K)
    .filter((rankedRecord) => rankedRecord.similarity >= SIMILARITY_THRESHOLD);
    const relativeFilePath = path.relative(repositoryPath, absoluteFilePath);

const rankedCodeSymbolRecords = retrievalStore
  .searchCodeSymbolRecords(queryEmbedding, RETRIEVAL_TOP_K, relativeFilePath)
  .filter((rankedRecord) => rankedRecord.similarity >= SIMILARITY_THRESHOLD);


  const allRetrievalRecords = retrievalStore.loadRecords();
  const rankedSourceIds = new Set(
    rankedEmbeddingRecords.map((rankedRecord) => rankedRecord.record.sourceRecordId),
  );
  const retrievalRecords = allRetrievalRecords.filter((record) => {
    const targetFilePath = record.targetFilePath ?? '';
    const isInternalMemory =
      targetFilePath.startsWith('.debug-drive') ||
      targetFilePath.startsWith('.debug-drive-memory');

    return rankedSourceIds.has(record.id) && !isInternalMemory;
  });
  const targetFilePath = relativeFilePath || absoluteFilePath;
  const validationCommand = resolveValidationCommandForActiveFile(targetFilePath, failingCommand || undefined);

  const bugContext: BugContext = {
    repositoryPath,
    filePath: targetFilePath,
    language: activeEditor.document.languageId,
    problemStatement,
    failingCommand: validationCommand,
    errorOutput: errorOutput || undefined,
    relevantCode,
  };

  const previousLearningRecords = learningStore.loadRecords();
  const strategySelection = strategySelector.select(bugContext, previousLearningRecords);
  bugContext.strategyHint = `${strategySelection.strategy}: ${strategySelection.reason}`;
  const session = coordinator.createSession(bugContext);
  session.strategySelection = strategySelection;
  const decision = await coordinator.runSession(
    session,
    retrievalRecords,
    rankedCodeChunkRecords.map((rankedRecord) => rankedRecord.record),
  );

  const patchWorkspace = session.patchWorkspace;
  if (
    decision.nextAction === 'accept' &&
    patchWorkspace?.validated &&
    patchWorkspace.acceptedPatchPath &&
    patchWorkspace.parsedPatch
  ) {
    latestAcceptedPatch = {
      repositoryPath,
      targetFilePath,
      absoluteTargetPath: absoluteFilePath,
      acceptedPatchPath: patchWorkspace.acceptedPatchPath,
      candidateDiff: patchWorkspace.candidateDiff ?? '',
      originalContent: fullCode,
      parsedPatch: patchWorkspace.parsedPatch,
      createdAt: Date.now(),
    };
  }

  let retrievalRecordSaved = false;
  if (decision.nextAction === 'accept' && session.latestPatch) {
    const retrievalRecord = {
      id: session.id,
      repositoryPath,
      repositoryName,
      summary: session.latestPatch.summary,
      problemStatement: bugContext.problemStatement,
      errorOutput: bugContext.errorOutput,
      targetFilePath: bugContext.filePath,
      diffText: session.latestPatch.diffText,
      candidateContent: session.latestPatch.candidateContent,
      rationale: session.latestPatch.rationale,
      tags: [bugContext.language ?? 'unknown', 'accepted-fix'],
      createdAt: Date.now(),
    };

    retrievalRecordSaved = retrievalStore.appendRecord(retrievalRecord);

    if (retrievalRecordSaved) {
      const embeddingText = [
        retrievalRecord.summary,
        retrievalRecord.problemStatement,
        retrievalRecord.errorOutput ?? '',
        retrievalRecord.rationale,
        retrievalRecord.candidateContent,
      ].join('\n');

      retrievalStore.appendEmbeddingRecord({
        id: `embedding-${retrievalRecord.id}`,
        sourceRecordId: retrievalRecord.id,
        text: embeddingText,
        embedding: await vectorizer.embedText(embeddingText),
        metadata: {
          summary: retrievalRecord.summary,
          repositoryPath,
          repositoryName,
          problemStatement: retrievalRecord.problemStatement,
          errorOutput: retrievalRecord.errorOutput,
          targetFilePath: retrievalRecord.targetFilePath,
          language: bugContext.language,
          tags: retrievalRecord.tags,
          embeddingProvider: vectorizer.name,
          createdAt: retrievalRecord.createdAt,
        },
      });
    }
  }

  const rewardResult = rewardCalculator.calculate(session, decision);
  const reward = rewardResult.reward;
  const totalLearningRuns = previousLearningRecords.length + 1;
  const acceptedLearningRuns =
    previousLearningRecords.filter((record) => record.finalAction === 'accept').length +
    (decision.nextAction === 'accept' ? 1 : 0);
  const successRate = acceptedLearningRuns / totalLearningRuns;
  const averageReward =
    [...previousLearningRecords.map((record) => record.reward), reward].reduce(
      (sum, value) => sum + value,
      0,
    ) / totalLearningRuns;

  learningStore.appendRecord({
    id: `learning-${session.id}`,
    repositoryPath,
    repositoryName,
    sessionId: session.id,
    problemStatement: bugContext.problemStatement,
    targetFilePath: bugContext.filePath,
    language: bugContext.language,
    finalAction: decision.nextAction,
    testPassed: decision.testResult?.passed ?? false,
    criticApproved: decision.critique?.approved ?? false,
    roundsUsed: session.currentRound,
    maxRounds: session.maxRounds,
    reward,
    rewardExplanation: rewardResult.explanation,
    strategy: strategySelection.strategy,
    strategyReason: strategySelection.reason,
    strategyExploration: strategySelection.exploration,
    retrievedMemoryIds: retrievalRecords.map((record) => record.id),
    createdAt: Date.now(),
  });

  const experimentSummaryPath = experimentStore.saveSummary(
    session,
    decision,
    retrievalRecords,
    reward,
    repositoryName,
  );

  outputChannel.clear();
  outputChannel.show(true);
  outputChannel.appendLine('=== Debug Drive Session ===');
  outputChannel.appendLine(`Session ID: ${session.id}`);
  outputChannel.appendLine(`Round: ${session.currentRound}/${session.maxRounds}`);
  outputChannel.appendLine(`Repository: ${bugContext.repositoryPath}`);
  outputChannel.appendLine(`Repository Namespace: ${repositoryName}`);
  outputChannel.appendLine(`File: ${bugContext.filePath}`);
  outputChannel.appendLine(`Language: ${bugContext.language || '(unknown)'}`);

  outputChannel.appendLine('');
  outputChannel.appendLine('--- Session Summary ---');
  outputChannel.appendLine(`Status: ${decision.nextAction.toUpperCase()}`);
  outputChannel.appendLine(`Strategy: ${strategySelection.strategy}`);
  outputChannel.appendLine(`Strategy Exploration: ${strategySelection.exploration}`);
  outputChannel.appendLine(`Strategy Reason: ${strategySelection.reason}`);
  outputChannel.appendLine(`Validation: ${decision.testResult?.passed ? 'passed' : 'failed or not run'}`);
  outputChannel.appendLine(`Critic: ${decision.critique?.approved ? 'approved' : 'not approved'}`);
  outputChannel.appendLine(`Patch Materialized: ${session.patchWorkspace?.materialized ?? false}`);
  outputChannel.appendLine(`Patch Validated: ${session.patchWorkspace?.validated ?? false}`);
  outputChannel.appendLine(
  `Patch Safety: ${
    session.patchWorkspace?.materialized && session.patchWorkspace?.validated
      ? 'sandbox-validated'
      : 'not-validated'
  }`,
);
  outputChannel.appendLine(`Accepted Patch: ${session.patchWorkspace?.acceptedPatchPath ?? '(none)'}`);
  outputChannel.appendLine(
    `Live Apply: ${session.patchWorkspace?.acceptedPatchPath && session.patchWorkspace?.rollbackAvailable ? 'review-required' : 'not-ready'}`,
  );
  outputChannel.appendLine('');

  outputChannel.appendLine(`Model Provider: ${providerSelection?.providerMode ?? 'mock'}`);
  outputChannel.appendLine(`Model Name: ${providerSelection?.modelName ?? 'mock-debug-drive-model'}`);
  outputChannel.appendLine(`Provider Fallback: ${providerSelection?.fallbackReason ?? '(none)'}`);
  outputChannel.appendLine(`Retrieved Memories Available: ${retrievalRecords.length}`);
  outputChannel.appendLine(`New Memory Saved: ${retrievalRecordSaved}`);
  outputChannel.appendLine(`Retrieval Top K: ${RETRIEVAL_TOP_K}`);
  outputChannel.appendLine(`Similarity Threshold: ${SIMILARITY_THRESHOLD}`);
  outputChannel.appendLine(`Retrieved Code Chunks Available: ${rankedCodeChunkRecords.length}`);
  outputChannel.appendLine(`Retrieved Symbols Available: ${rankedCodeSymbolRecords.length}`);
  outputChannel.appendLine(`Current Reward: ${reward}`);
  outputChannel.appendLine(`Learning Runs: ${totalLearningRuns}`);
  outputChannel.appendLine(`Accepted Runs: ${acceptedLearningRuns}`);
  outputChannel.appendLine(`Success Rate: ${(successRate * 100).toFixed(1)}%`);
  outputChannel.appendLine(`Average Reward: ${averageReward.toFixed(3)}`);
  outputChannel.appendLine(`Experiment Summary: ${experimentSummaryPath}`);
  outputChannel.appendLine('');

  outputChannel.appendLine('--- Reward Explanation ---');

  if (rewardResult.explanation.length === 0) {
    outputChannel.appendLine('No reward adjustments were applied.');
  } else {
    for (const item of rewardResult.explanation) {
      outputChannel.appendLine(`- ${item}`);
    }
  }

  outputChannel.appendLine('');
  outputChannel.appendLine('--- Bug Context ---');
  outputChannel.appendLine(`Problem: ${bugContext.problemStatement}`);
  outputChannel.appendLine(`Validation Command: ${bugContext.failingCommand || '(not provided)'}`);
  outputChannel.appendLine(`Error Output: ${bugContext.errorOutput || '(not provided)'}`);
  outputChannel.appendLine('');
  outputChannel.appendLine('--- Retrieved Memories ---');

  if (retrievalRecords.length === 0) {
    outputChannel.appendLine('No semantically relevant fix memories found.');
  } else {
    for (const record of retrievalRecords) {
      const rankedMatch = rankedEmbeddingRecords.find(
        (rankedRecord) => rankedRecord.record.sourceRecordId === record.id,
      );
      const similarity = rankedMatch ? rankedMatch.similarity.toFixed(4) : 'N/A';

      outputChannel.appendLine(`- ${record.summary}`);
      outputChannel.appendLine(`  Similarity: ${similarity}`);
      outputChannel.appendLine(`  Problem: ${record.problemStatement}`);
      outputChannel.appendLine(`  Tags: ${record.tags.join(', ')}`);
    }
  }

  outputChannel.appendLine('');
  outputChannel.appendLine('--- Retrieved Code Context ---');

  if (rankedCodeChunkRecords.length === 0) {
    outputChannel.appendLine('No semantically relevant code chunks found for this run.');
  } else {
    for (const rankedChunk of rankedCodeChunkRecords) {
      outputChannel.appendLine(
        `- ${rankedChunk.record.filePath}:${rankedChunk.record.startLine}-${rankedChunk.record.endLine}`,
      );
      outputChannel.appendLine(`  Similarity: ${rankedChunk.similarity.toFixed(4)}`);
      outputChannel.appendLine(`  Repository: ${rankedChunk.record.repositoryName}`);
    }
  }

  outputChannel.appendLine('');

  outputChannel.appendLine('');
outputChannel.appendLine('--- Retrieved Symbol Context ---');

if (rankedCodeSymbolRecords.length === 0) {
  outputChannel.appendLine('No semantically relevant symbols found for this run.');
} else {
  for (const rankedSymbol of rankedCodeSymbolRecords) {
    outputChannel.appendLine(
      `- ${rankedSymbol.record.symbolKind} ${rankedSymbol.record.symbolName} (${rankedSymbol.record.filePath}:${rankedSymbol.record.startLine}-${rankedSymbol.record.endLine})`,
    );
    outputChannel.appendLine(`  Similarity: ${rankedSymbol.similarity.toFixed(4)}`);
    outputChannel.appendLine(`  Signature: ${rankedSymbol.record.signature}`);
  }
}

  outputChannel.appendLine('--- Agent Messages ---');

  for (const message of session.messages) {
    outputChannel.appendLine(`[${message.role.toUpperCase()}]`);
    outputChannel.appendLine(message.content);
    outputChannel.appendLine('');
  }

  outputChannel.appendLine('--- Patch Proposal ---');
  outputChannel.appendLine(`Summary: ${session.latestPatch?.summary ?? 'None'}`);
  outputChannel.appendLine(`Confidence: ${session.latestPatch?.confidence ?? 'N/A'}`);
  outputChannel.appendLine('Diff:');
  outputChannel.appendLine(session.latestPatch?.diffText ?? 'No diff generated.');
  outputChannel.appendLine('');
  outputChannel.appendLine('--- Model Transcripts ---');
  outputChannel.appendLine(`Transcript Count: ${session.modelTranscripts.length}`);
  outputChannel.appendLine(
  `Parsed Successfully: ${session.modelTranscripts.filter((transcript) => transcript.parsedSuccessfully).length}`,
);
  outputChannel.appendLine('');

  if (session.modelTranscripts.length === 0) {
    outputChannel.appendLine('No model transcripts recorded.');
  } else {
    for (const transcript of session.modelTranscripts) {
      outputChannel.appendLine(
        `- ${transcript.agentRole} via ${transcript.providerName}/${transcript.modelName}`,
      );
      outputChannel.appendLine(`  Transcript ID: ${transcript.id}`);
      outputChannel.appendLine(`  Parsed: ${transcript.parsedSuccessfully}`);
      outputChannel.appendLine(`  Parse Error: ${transcript.parseError ?? '(none)'}`);
      outputChannel.appendLine(`  Prompt Messages: ${transcript.promptMessages.length}`);
      outputChannel.appendLine(`  Response Characters: ${transcript.responseContent.length}`);
    }
  }

  outputChannel.appendLine('');
  outputChannel.appendLine('--- Patch Workspace ---');
  outputChannel.appendLine(`Target File: ${session.patchWorkspace?.targetFilePath ?? '(none)'}`);
  outputChannel.appendLine(`Materialized: ${session.patchWorkspace?.materialized ?? false}`);
  outputChannel.appendLine(`Rollback Available: ${session.patchWorkspace?.rollbackAvailable ?? false}`);
  outputChannel.appendLine(`Validated: ${session.patchWorkspace?.validated ?? false}`);
  outputChannel.appendLine(`Parsed Patch Files: ${session.patchWorkspace?.parsedPatch?.files.length ?? 0}`);
  outputChannel.appendLine(`Temp File: ${session.patchWorkspace?.tempFilePath ?? '(none)'}`);
  outputChannel.appendLine(`Accepted Patch: ${session.patchWorkspace?.acceptedPatchPath ?? '(none)'}`);
  outputChannel.appendLine(
    `Live Apply Ready: ${session.patchWorkspace?.acceptedPatchPath && session.patchWorkspace?.rollbackAvailable ? 'review-required' : 'false'}`,
  );
  outputChannel.appendLine(`Working Copy: ${session.patchWorkspace?.tempPatchedFilePath ?? '(none)'}`);
  outputChannel.appendLine(`Sandbox Root: ${session.patchWorkspace?.sandboxRootPath ?? '(none)'}`);
  outputChannel.appendLine(`Sandbox Project Root: ${session.patchWorkspace?.sandboxProjectRootPath ?? '(none)'}`);
  outputChannel.appendLine(
    'Prototype Status: Candidate patches are sandbox-validated first. Use "Debug Drive: Apply Accepted Patch" to apply the latest accepted patch to the live workspace after review.',
  );
  outputChannel.appendLine('Candidate Diff Snapshot:');
  outputChannel.appendLine(session.patchWorkspace?.candidateDiff ?? 'No candidate diff recorded.');
  outputChannel.appendLine('');
  outputChannel.appendLine('Candidate Content Snapshot:');
  outputChannel.appendLine(
    session.patchWorkspace?.candidateContent ?? 'No candidate content recorded.',
  );
  outputChannel.appendLine('');
  outputChannel.appendLine('--- Final Decision ---');
  outputChannel.appendLine(`Next Action: ${decision.nextAction}`);
  outputChannel.appendLine(`Critic Approved: ${decision.critique?.approved ?? false}`);
  outputChannel.appendLine(`Test Passed: ${decision.testResult?.passed ?? false}`);

  vscode.window.showInformationMessage(
    `Debug Drive completed round ${session.currentRound}. See the "Debug Drive" output panel for details.`,
  );
}

export function registerDebugDriveCommands(context: vscode.ExtensionContext): void {
  const outputChannel = vscode.window.createOutputChannel('Debug Drive');

  const runSessionCommand = vscode.commands.registerCommand('debug-drive.runDebugSession', async () => {
    const providerSelection = new ModelProviderFactory().create();
    const coordinator = new DebugCoordinator(undefined, providerSelection.provider);

    await runDebugSessionWithCoordinator(coordinator, outputChannel, providerSelection);
  });

  const runMalformedModelSessionCommand = vscode.commands.registerCommand(
    'debug-drive.runMalformedModelDebugSession',
    async () => {
      const malformedProvider = new MalformedMockModelProvider();
      const coordinator = new DebugCoordinator(undefined, malformedProvider);
      await runDebugSessionWithCoordinator(coordinator, outputChannel, {
        provider: malformedProvider,
        providerMode: 'mock',
        modelName: 'malformed-mock-debug-drive-model',
        fallbackReason: 'Malformed mock provider command selected for parser fallback testing.',
      });
    },
  );

  const indexRepositoryCommand = vscode.commands.registerCommand('debug-drive.indexRepository', async () => {
    const activeEditor = vscode.window.activeTextEditor;
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

    if (!activeEditor && !workspaceFolder) {
      vscode.window.showWarningMessage('Open a workspace folder or source file before indexing a repository.');
      return;
    }

    const repositoryPath = activeEditor
      ? findBenchmarkRepositoryRoot(activeEditor.document.uri.fsPath)
      : findBenchmarkRepositoryRoot(workspaceFolder!.uri.fsPath);
    const repositoryName = path.basename(repositoryPath);
    const retrievalStore = new RetrievalStore(path.join(repositoryPath, '.debug-drive-memory'));
    const vectorizer = new SimpleVectorizer();
    const indexer = new RepositoryIndexer(vectorizer);

    outputChannel.clear();
    outputChannel.show(true);
    outputChannel.appendLine('=== Debug Drive Repository Indexing ===');
    outputChannel.appendLine(`Repository: ${repositoryPath}`);
    outputChannel.appendLine(`Repository Namespace: ${repositoryName}`);
    outputChannel.appendLine(`Embedding Provider: ${vectorizer.name}`);
    outputChannel.appendLine('');

    const indexResult = await indexer.indexRepository(repositoryPath, repositoryName);
    retrievalStore.replaceCodeChunksForRepository(repositoryPath, indexResult.chunks);
    retrievalStore.replaceCodeSymbolsForRepository(repositoryPath, indexResult.symbols);

    outputChannel.appendLine(`Indexed Code Chunks: ${indexResult.chunks.length}`);
    outputChannel.appendLine(`Indexed Code Symbols: ${indexResult.symbols.length}`);
    vscode.window.showInformationMessage(
      `Debug Drive indexed ${indexResult.chunks.length} code chunks and ${indexResult.symbols.length} symbols.`,
    );
  });

  const applyAcceptedPatchCommand = vscode.commands.registerCommand(
    'debug-drive.applyAcceptedPatch',
    async () => {
      if (!latestAcceptedPatch) {
        vscode.window.showWarningMessage(
          'No accepted Debug Drive patch is ready yet. Run a debug session that reaches ACCEPT first.',
        );
        return;
      }

      if (!fs.existsSync(latestAcceptedPatch.absoluteTargetPath)) {
        vscode.window.showErrorMessage(
          `Debug Drive cannot find the target file: ${latestAcceptedPatch.absoluteTargetPath}`,
        );
        return;
      }

      const currentContent = fs.readFileSync(latestAcceptedPatch.absoluteTargetPath, 'utf8');
      if (currentContent !== latestAcceptedPatch.originalContent) {
        vscode.window.showWarningMessage(
          'Debug Drive did not apply the patch because the live file changed after validation. Re-run the debug session to validate against the latest file.',
        );
        return;
      }

      const confirmation = await vscode.window.showWarningMessage(
        `Apply the latest sandbox-validated patch to ${latestAcceptedPatch.targetFilePath}? A rollback snapshot will be saved first.`,
        { modal: true },
        'Apply Patch',
      );

      if (confirmation !== 'Apply Patch') {
        vscode.window.showInformationMessage('Debug Drive live patch application cancelled.');
        return;
      }

      const parsedFilePatch = latestAcceptedPatch.parsedPatch.files.find(
        (filePatch) => filePatch.newFilePath === latestAcceptedPatch?.targetFilePath,
      );

      if (!parsedFilePatch) {
        vscode.window.showErrorMessage('Debug Drive could not find the target file inside the accepted patch.');
        return;
      }

      const applyResult = new PatchApplier().applyToContent(currentContent, parsedFilePatch);

      if (!applyResult.ok || applyResult.updatedContent === undefined) {
        vscode.window.showErrorMessage(`Debug Drive could not apply the accepted patch: ${applyResult.error}`);
        return;
      }

      const rollbackDir = path.join(latestAcceptedPatch.repositoryPath, '.debug-drive', 'live-rollbacks');
      const sanitizedTargetPath = latestAcceptedPatch.targetFilePath.replace(/[\\\/]/g, '__');
      const rollbackPath = path.join(
        rollbackDir,
        `${Date.now()}__${sanitizedTargetPath}.rollback.txt`,
      );

      fs.mkdirSync(rollbackDir, { recursive: true });
      fs.writeFileSync(rollbackPath, currentContent, 'utf8');
      fs.writeFileSync(latestAcceptedPatch.absoluteTargetPath, applyResult.updatedContent, 'utf8');

      outputChannel.show(true);
      outputChannel.appendLine('');
      outputChannel.appendLine('--- Live Patch Applied ---');
      outputChannel.appendLine(`Target File: ${latestAcceptedPatch.absoluteTargetPath}`);
      outputChannel.appendLine(`Accepted Patch: ${latestAcceptedPatch.acceptedPatchPath}`);
      outputChannel.appendLine(`Rollback Snapshot: ${rollbackPath}`);
      outputChannel.appendLine('Status: applied to live workspace');

      vscode.window.showInformationMessage(
        `Debug Drive applied the accepted patch. Rollback snapshot: ${rollbackPath}`,
      );
    },
  );

    const seedBenchmarkCaseCommand = vscode.commands.registerCommand(
    'debug-drive.seedBenchmarkCase',
    async () => {
      const activeEditor = vscode.window.activeTextEditor;

      if (!activeEditor) {
        vscode.window.showWarningMessage('Open a source file before seeding a benchmark case.');
        return;
      }

      const absoluteFilePath = activeEditor.document.uri.fsPath;
      const repositoryPath = findNearestProjectRoot(absoluteFilePath);
      const repositoryName = path.basename(repositoryPath);
      const benchmarkStore = new BenchmarkStore(path.join(repositoryPath, '.debug-drive-memory'));
      const relativeFilePath = path.relative(repositoryPath, absoluteFilePath);

      const problemStatement = await vscode.window.showInputBox({
        prompt: 'Benchmark bug description',
        placeHolder: 'Example: Empty arrays return undefined instead of []',
        ignoreFocusOut: true,
      });

      if (!problemStatement) {
        vscode.window.showWarningMessage('Benchmark case needs a problem statement.');
        return;
      }

      const failingCommand = await vscode.window.showInputBox({
        prompt: 'Benchmark validation command',
        placeHolder: 'Example: npm run compile',
        ignoreFocusOut: true,
      });

      if (!failingCommand) {
        vscode.window.showWarningMessage('Benchmark case needs a validation command.');
        return;
      }

      const errorOutput = await vscode.window.showInputBox({
        prompt: 'Benchmark error output',
        placeHolder: 'Example: Expected [], received undefined',
        ignoreFocusOut: true,
      });

      const existingCases = benchmarkStore.loadCases();

      existingCases.push({
        id: `benchmark-${Date.now()}`,
        name: problemStatement.slice(0, 80),
        repositoryName,
        targetFilePath: relativeFilePath,
        language: activeEditor.document.languageId,
        problemStatement,
        failingCommand,
        errorOutput: errorOutput || undefined,
        expectedFinalAction: 'accept',
        tags: [activeEditor.document.languageId, 'seeded'],
      });

      benchmarkStore.saveCases(existingCases);

      vscode.window.showInformationMessage(`Debug Drive seeded benchmark case: ${problemStatement.slice(0, 60)}`);
    },
  );

    const runBenchmarksCommand = vscode.commands.registerCommand('debug-drive.runBenchmarks', async () => {
    const activeEditor = vscode.window.activeTextEditor;
    const repositoryPath = findCommandRepositoryRootOrWarn(activeEditor, 'running benchmarks');

    if (!repositoryPath) {
      return;
    }

    const selectedMode = await vscode.window.showQuickPick(
      [
        { label: 'normal', description: 'Use RAG and Critic' },
        { label: 'no-rag', description: 'Disable retrieved memories and code chunks' },
        { label: 'no-critic', description: 'Reserved ablation mode' },
      ],
      {
        placeHolder: 'Select benchmark evaluation mode',
        ignoreFocusOut: true,
      },
    );

    if (!selectedMode) {
      vscode.window.showWarningMessage('Benchmark run cancelled.');
      return;
    }

    const repositoryName = path.basename(repositoryPath);
    const benchmarkStore = new BenchmarkStore(path.join(repositoryPath, '.debug-drive-memory'));
    const benchmarkRunner = new BenchmarkRunner();
    const metricsCalculator = new MetricsCalculator();
    const cases = benchmarkStore.loadCases();

    if (cases.length === 0) {
      vscode.window.showWarningMessage('No Debug Drive benchmark cases found. Seed a benchmark case first.');
      return;
    }

    outputChannel.clear();
    outputChannel.show(true);
    outputChannel.appendLine('=== Debug Drive Benchmark Evaluation ===');
    outputChannel.appendLine(`Repository: ${repositoryPath}`);
    outputChannel.appendLine(`Repository Namespace: ${repositoryName}`);
    outputChannel.appendLine(`Benchmark Cases: ${cases.length}`);
    outputChannel.appendLine(`Mode: ${selectedMode.label}`);
    outputChannel.appendLine('');

    const runResults: BenchmarkRunResult[] = [];

    for (const benchmarkCase of cases) {
      outputChannel.appendLine(`Running: ${benchmarkCase.name}`);
      const result = await benchmarkRunner.runCase(benchmarkCase, {
        repositoryPath,
        mode: selectedMode.label as 'normal' | 'no-rag' | 'no-critic',
        topK: RETRIEVAL_TOP_K,
        similarityThreshold: SIMILARITY_THRESHOLD,
      });

      benchmarkStore.appendResult(result);
      runResults.push(result);

      outputChannel.appendLine(`  Final Action: ${result.finalAction}`);
      outputChannel.appendLine(`  Success: ${result.success}`);
      outputChannel.appendLine(`  Reward: ${result.reward}`);
      outputChannel.appendLine(`  Rounds: ${result.roundsUsed}/${result.maxRounds}`);
      outputChannel.appendLine('');
    }

    const metrics = metricsCalculator.calculate(runResults);
    const benchmarkSummary = {
      id: `benchmark-summary-${Date.now()}`,
      repositoryPath,
      repositoryName,
      mode: selectedMode.label as 'normal' | 'no-rag' | 'no-critic',
      benchmarkCaseCount: cases.length,
      results: runResults,
      metrics,
      createdAt: Date.now(),
    };
    const benchmarkSummaryPath = benchmarkStore.saveEvaluationSummary(benchmarkSummary);
    const benchmarkReportPath = benchmarkStore.saveEvaluationReport(benchmarkSummary);

    outputChannel.appendLine('--- Metrics ---');
    outputChannel.appendLine(`Total Runs: ${metrics.totalRuns}`);
    outputChannel.appendLine(`Successful Runs: ${metrics.successfulRuns}`);
    outputChannel.appendLine(`Success Rate: ${(metrics.successRate * 100).toFixed(1)}%`);
    outputChannel.appendLine(`Validation Pass Rate: ${(metrics.validationPassRate * 100).toFixed(1)}%`);
    outputChannel.appendLine(`pass@k: ${(metrics.passAtK * 100).toFixed(1)}%`);
    outputChannel.appendLine(`fix@k: ${(metrics.fixAtK * 100).toFixed(1)}%`);
    outputChannel.appendLine(`Average Reward: ${metrics.averageReward.toFixed(3)}`);
    outputChannel.appendLine(`Average Rounds Used: ${metrics.averageRoundsUsed.toFixed(2)}`);
    outputChannel.appendLine(`Average Retrieved Memories: ${metrics.averageRetrievedMemoryCount.toFixed(2)}`);
    outputChannel.appendLine(`Average Retrieved Code Chunks: ${metrics.averageRetrievedCodeChunkCount.toFixed(2)}`);
    outputChannel.appendLine('');

    outputChannel.appendLine('--- Report Artifacts ---');
    outputChannel.appendLine(`Benchmark Summary JSON: ${benchmarkSummaryPath}`);
    outputChannel.appendLine(`Benchmark Report MD: ${benchmarkReportPath}`);

    outputChannel.appendLine(`Retrieval Used Runs: ${metrics.retrievalUsedRuns}`);
    outputChannel.appendLine(`Retrieval Success Rate: ${(metrics.retrievalSuccessRate * 100).toFixed(1)}%`);
    outputChannel.appendLine(`No-Retrieval Success Rate: ${(metrics.noRetrievalSuccessRate * 100).toFixed(1)}%`);

    vscode.window.showInformationMessage(`Debug Drive benchmark run complete: ${metrics.successfulRuns}/${metrics.totalRuns} successful.`);
  });

    const runAblationComparisonCommand = vscode.commands.registerCommand(
    'debug-drive.runAblationComparison',
    async () => {
      const activeEditor = vscode.window.activeTextEditor;
      const repositoryPath = findCommandRepositoryRootOrWarn(activeEditor, 'running ablations');

      if (!repositoryPath) {
        return;
      }

      const repositoryName = path.basename(repositoryPath);
      const benchmarkStore = new BenchmarkStore(path.join(repositoryPath, '.debug-drive-memory'));
      const benchmarkRunner = new BenchmarkRunner();
      const metricsCalculator = new MetricsCalculator();
      const cases = benchmarkStore.loadCases();
      const modes: Array<'normal' | 'no-rag'> = ['normal', 'no-rag'];

      if (cases.length === 0) {
        vscode.window.showWarningMessage('No Debug Drive benchmark cases found. Seed a benchmark case first.');
        return;
      }

      outputChannel.clear();
      outputChannel.show(true);
      outputChannel.appendLine('=== Debug Drive Ablation Comparison ===');
      outputChannel.appendLine(`Repository: ${repositoryPath}`);
      outputChannel.appendLine(`Repository Namespace: ${repositoryName}`);
      outputChannel.appendLine(`Benchmark Cases: ${cases.length}`);
      outputChannel.appendLine('');

      const allAblationResults: BenchmarkRunResult[] = [];

      for (const mode of modes) {
        const runResults: BenchmarkRunResult[] = [];

        outputChannel.appendLine(`--- Mode: ${mode} ---`);

        for (const benchmarkCase of cases) {
          const result = await benchmarkRunner.runCase(benchmarkCase, {
            repositoryPath,
            mode,
            topK: RETRIEVAL_TOP_K,
            similarityThreshold: SIMILARITY_THRESHOLD,
          });

          benchmarkStore.appendResult(result);
          runResults.push(result);
          allAblationResults.push(result);
        }

        const metrics = metricsCalculator.calculate(runResults);

        outputChannel.appendLine(`Success Rate: ${(metrics.successRate * 100).toFixed(1)}%`);
        outputChannel.appendLine(`Validation Pass Rate: ${(metrics.validationPassRate * 100).toFixed(1)}%`);
        outputChannel.appendLine(`pass@k: ${(metrics.passAtK * 100).toFixed(1)}%`);
        outputChannel.appendLine(`fix@k: ${(metrics.fixAtK * 100).toFixed(1)}%`);
        outputChannel.appendLine(`Average Reward: ${metrics.averageReward.toFixed(3)}`);
        outputChannel.appendLine(`Average Rounds Used: ${metrics.averageRoundsUsed.toFixed(2)}`);
        outputChannel.appendLine(`Average Retrieved Memories: ${metrics.averageRetrievedMemoryCount.toFixed(2)}`);
        outputChannel.appendLine(`Average Retrieved Code Chunks: ${metrics.averageRetrievedCodeChunkCount.toFixed(2)}`);
                outputChannel.appendLine(`Retrieval Used Runs: ${metrics.retrievalUsedRuns}`);
        outputChannel.appendLine(`Retrieval Success Rate: ${(metrics.retrievalSuccessRate * 100).toFixed(1)}%`);
        outputChannel.appendLine(`No-Retrieval Success Rate: ${(metrics.noRetrievalSuccessRate * 100).toFixed(1)}%`);
        outputChannel.appendLine('');
      }

      const ablationMetrics = metricsCalculator.calculate(allAblationResults);
      const ablationSummary = {
        id: `benchmark-ablation-summary-${Date.now()}`,
        repositoryPath,
        repositoryName,
        mode: 'ablation',
        benchmarkCaseCount: cases.length,
        results: allAblationResults,
        metrics: ablationMetrics,
        createdAt: Date.now(),
      } as const;
      const ablationSummaryPath = benchmarkStore.saveEvaluationSummary(ablationSummary);
      const ablationReportPath = benchmarkStore.saveEvaluationReport(ablationSummary);

      outputChannel.appendLine('--- Report Artifacts ---');
      outputChannel.appendLine(`Ablation Summary JSON: ${ablationSummaryPath}`);
      outputChannel.appendLine(`Ablation Report MD: ${ablationReportPath}`);

      vscode.window.showInformationMessage('Debug Drive ablation comparison complete.');
    },
  );

  context.subscriptions.push(
    runSessionCommand,
    runMalformedModelSessionCommand,
    applyAcceptedPatchCommand,
    indexRepositoryCommand,
    seedBenchmarkCaseCommand,
    runBenchmarksCommand,
    runAblationComparisonCommand,
    outputChannel,
  );
}
