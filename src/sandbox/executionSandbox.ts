import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { TestResult } from '../types/agent';

const execAsync = promisify(exec);

export interface PatchApplicationResult {
  applied: boolean;
  sandboxRootPath?: string;
  sandboxProjectRootPath?: string;
  tempFilePath?: string;
  tempPatchedFilePath?: string;
  error?: string;
}

export class ExecutionSandbox {
  async applyCandidatePatch(
    repositoryPath: string,
    targetFilePath: string | undefined,
    candidateContent: string | undefined,
    originalContent: string | undefined,
  ): Promise<PatchApplicationResult> {
    if (!targetFilePath) {
      return {
        applied: false,
        error: 'No target file path was provided for patch application.',
      };
    }

    if (!candidateContent) {
      return {
        applied: false,
        error: 'No candidate content was available to apply.',
      };
    }

    try {
      const sandboxRootPath = path.join(repositoryPath, '.debug-drive', `run-${Date.now()}`);
      const artifactsDir = path.join(sandboxRootPath, 'artifacts');
      const workingDir = path.join(sandboxRootPath, 'working');
      const sandboxProjectRootPath = path.join(sandboxRootPath, 'project');
      const sanitizedRelativePath = targetFilePath.replace(/^([\\\/])+/, '');
      const sandboxProjectFilePath = path.join(sandboxProjectRootPath, sanitizedRelativePath);
      const sandboxProjectFileParentDir = path.dirname(sandboxProjectFilePath);

      const normalizedTargetPath = targetFilePath.replace(/[\\\/]/g, '__');
      const patchArtifactPath = path.join(artifactsDir, `${normalizedTargetPath}.candidate.patch.txt`);

      const patchedFilePath = path.join(workingDir, sanitizedRelativePath);
      const patchedFileParentDir = path.dirname(patchedFilePath);

      fs.mkdirSync(artifactsDir, { recursive: true });
      fs.mkdirSync(workingDir, { recursive: true });
      fs.mkdirSync(sandboxProjectRootPath, { recursive: true });
      fs.mkdirSync(patchedFileParentDir, { recursive: true });
      fs.mkdirSync(sandboxProjectFileParentDir, { recursive: true });

      fs.writeFileSync(patchArtifactPath, candidateContent, 'utf8');
      fs.writeFileSync(sandboxProjectFilePath, candidateContent, 'utf8');

        const originalSnapshotPath = path.join(
        artifactsDir,
        `${normalizedTargetPath}.original.snapshot.txt`,
      );

      fs.writeFileSync(originalSnapshotPath, originalContent ?? '(no original content captured)', 'utf8');
      fs.writeFileSync(patchedFilePath, candidateContent, 'utf8');

      return {
        applied: true,
        sandboxRootPath,
        sandboxProjectRootPath,
        tempFilePath: patchArtifactPath,
        tempPatchedFilePath: patchedFilePath,
      };
    } catch (error) {
      return {
        applied: false,
        error: error instanceof Error ? error.message : 'Unknown patch application error.',
      };
    }
  }

  async runCommand(command: string, cwd: string): Promise<TestResult> {
    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd,
        timeout: 15000,
        windowsHide: true,
      });

      return {
        passed: true,
        command,
        stdout: stdout ?? '',
        stderr: stderr ?? '',
        exitCode: 0,
      };
    } catch (error) {
      const execError = error as {
        stdout?: string;
        stderr?: string;
        code?: number;
        message?: string;
      };

      return {
        passed: false,
        command,
        stdout: execError.stdout ?? '',
        stderr: execError.stderr ?? execError.message ?? 'Unknown execution failure.',
        exitCode: typeof execError.code === 'number' ? execError.code : 1,
      };
    }
  }
}
