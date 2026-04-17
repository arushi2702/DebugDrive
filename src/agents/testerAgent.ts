import { TestResult } from '../types/agent';
import { PatchWorkspaceState } from '../types/session';
import { ExecutionSandbox } from '../sandbox/executionSandbox';

export class TesterAgent {
  constructor(private readonly sandbox = new ExecutionSandbox()) {}

  async evaluatePatch(
    command: string | undefined,
    repositoryPath: string,
    patchWorkspace?: PatchWorkspaceState,
  ): Promise<TestResult> {
    const executedCommand = command ?? 'npm test';

    if (patchWorkspace) {
      const applicationResult = await this.sandbox.applyCandidatePatch(
        repositoryPath,
        patchWorkspace.targetFilePath,
        patchWorkspace.candidateContent,
        patchWorkspace.originalContent,
        patchWorkspace.parsedPatch,
      );

      patchWorkspace.tempFilePath = applicationResult.tempFilePath;
      patchWorkspace.acceptedPatchPath = applicationResult.acceptedPatchPath;
      patchWorkspace.tempPatchedFilePath = applicationResult.tempPatchedFilePath;
      patchWorkspace.sandboxRootPath = applicationResult.sandboxRootPath;
      patchWorkspace.sandboxProjectRootPath = applicationResult.sandboxProjectRootPath;
      patchWorkspace.materialized = applicationResult.applied;
      patchWorkspace.rollbackAvailable = applicationResult.applied;

      if (!applicationResult.applied) {
        return {
          passed: false,
          command: executedCommand,
          stdout: '',
          stderr: applicationResult.error ?? 'Patch application failed before execution.',
          exitCode: 1,
        };
      }

      const executionCwd = patchWorkspace.sandboxProjectRootPath ?? repositoryPath;
      const executionResult = await this.sandbox.runCommand(executedCommand, executionCwd, repositoryPath);

      const patchDetails = [
        `Patch Artifact: ${applicationResult.tempFilePath ?? '(none)'}`,
        `Working Copy: ${applicationResult.tempPatchedFilePath ?? '(none)'}`,
      ].join('\n');

      return {
        ...executionResult,
        stdout: executionResult.stdout
          ? `${patchDetails}\n\n${executionResult.stdout}`
          : patchDetails,
      };
    }

    return this.sandbox.runCommand(executedCommand, repositoryPath);
  }
}
