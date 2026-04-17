import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { ParsedPatch, TestResult } from '../types/agent';
import { PatchApplier } from './patchApplier';

const execAsync = promisify(exec);

export interface PatchApplicationResult {
  applied: boolean;
  sandboxRootPath?: string;
  sandboxProjectRootPath?: string;
  tempFilePath?: string;
  tempPatchedFilePath?: string;
  acceptedPatchPath?: string;
  error?: string;
}

export class ExecutionSandbox {
  constructor(private readonly patchApplier = new PatchApplier()) {}

  async applyCandidatePatch(
    repositoryPath: string,
    targetFilePath: string | undefined,
    candidateContent: string | undefined,
    originalContent: string | undefined,
    parsedPatch?: ParsedPatch,
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
      const runId = `run-${Date.now()}`;
      const sandboxRootPath = path.join(repositoryPath, '.debug-drive', runId);
      const artifactsDir = path.join(sandboxRootPath, 'artifacts');
      const workingDir = path.join(sandboxRootPath, 'working');
      const sandboxProjectRootPath = path.join(
        path.dirname(repositoryPath),
        '.debug-drive-sandboxes',
        path.basename(repositoryPath),
        runId,
        'project',
      );
      const sanitizedRelativePath = targetFilePath.replace(/^([\\\/])+/, '');
      const sandboxProjectFilePath = path.join(sandboxProjectRootPath, sanitizedRelativePath);
      const sandboxProjectFileParentDir = path.dirname(sandboxProjectFilePath);

      const normalizedTargetPath = targetFilePath.replace(/[\\\/]/g, '__');
      const patchArtifactPath = path.join(artifactsDir, `${normalizedTargetPath}.candidate.patch.txt`);
      const acceptedPatchPath = path.join(artifactsDir, `${normalizedTargetPath}.accepted.patch`);

      const patchedFilePath = path.join(workingDir, sanitizedRelativePath);
      const patchedFileParentDir = path.dirname(patchedFilePath);

      fs.mkdirSync(artifactsDir, { recursive: true });
      fs.mkdirSync(workingDir, { recursive: true });
      fs.mkdirSync(patchedFileParentDir, { recursive: true });
      this.copyRepositorySnapshot(repositoryPath, sandboxProjectRootPath);
      fs.mkdirSync(sandboxProjectFileParentDir, { recursive: true });

      const appliedContentResult = this.resolveAppliedContent(
        targetFilePath,
        candidateContent,
        originalContent,
        parsedPatch,
      );

      if (!appliedContentResult.ok || appliedContentResult.updatedContent === undefined) {
        return {
          applied: false,
          sandboxRootPath,
          sandboxProjectRootPath,
          tempFilePath: patchArtifactPath,
          tempPatchedFilePath: patchedFilePath,
          error: appliedContentResult.error ?? 'Patch application failed.',
        };
      }

      fs.writeFileSync(patchArtifactPath, candidateContent, 'utf8');
      fs.writeFileSync(acceptedPatchPath, parsedPatch ? this.serializeParsedPatch(parsedPatch) : candidateContent, 'utf8');
      fs.writeFileSync(sandboxProjectFilePath, appliedContentResult.updatedContent, 'utf8');

        const originalSnapshotPath = path.join(
        artifactsDir,
        `${normalizedTargetPath}.original.snapshot.txt`,
      );

      fs.writeFileSync(originalSnapshotPath, originalContent ?? '(no original content captured)', 'utf8');
      fs.writeFileSync(patchedFilePath, appliedContentResult.updatedContent, 'utf8');

      return {
        applied: true,
        sandboxRootPath,
        sandboxProjectRootPath,
        tempFilePath: patchArtifactPath,
        acceptedPatchPath,
        tempPatchedFilePath: patchedFilePath,
      };
    } catch (error) {
      return {
        applied: false,
        error: error instanceof Error ? error.message : 'Unknown patch application error.',
      };
    }
  }

  async runCommand(command: string, cwd: string, toolchainRootPath?: string): Promise<TestResult> {
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

    private serializeParsedPatch(parsedPatch: ParsedPatch): string {
    return parsedPatch.files
      .flatMap((filePatch) => [
        `--- a/${filePatch.oldFilePath}`,
        `+++ b/${filePatch.newFilePath}`,
        ...filePatch.hunks.flatMap((hunk) => [
          hunk.header,
          ...hunk.lines.map((line) => {
            if (line.type === 'add') {
              return `+${line.content}`;
            }

            if (line.type === 'remove') {
              return `-${line.content}`;
            }

            return ` ${line.content}`;
          }),
        ]),
      ])
      .join('\n');
  }

  private resolveAppliedContent(
    targetFilePath: string,
    candidateContent: string,
    originalContent: string | undefined,
    parsedPatch?: ParsedPatch,
  ): { ok: boolean; updatedContent?: string; error?: string } {
    if (!parsedPatch) {
      return {
        ok: true,
        updatedContent: candidateContent,
      };
    }

    const matchingPatch = parsedPatch.files.find((filePatch) => filePatch.newFilePath === targetFilePath);

    if (!matchingPatch) {
      return {
        ok: false,
        error: 'Parsed patch does not contain the active target file.',
      };
    }

    if (originalContent === undefined) {
      return {
        ok: false,
        error: 'Original content is required to apply a parsed patch.',
      };
    }

    return this.patchApplier.applyToContent(originalContent, matchingPatch);
  }

  private copyRepositorySnapshot(repositoryPath: string, sandboxProjectRootPath: string): void {
    const excludedRootDirectories = new Set([
      '.debug-drive',
      '.debug-drive-memory',
      '.git',
      '.vscode-test',
      'dist',
      'node_modules',
      'out',
    ]);

    fs.cpSync(repositoryPath, sandboxProjectRootPath, {
      recursive: true,
      filter: (sourcePath) => {
        const relativePath = path.relative(repositoryPath, sourcePath);

        if (!relativePath) {
          return true;
        }

        const [rootSegment] = relativePath.split(/[\\\/]/);
        return !excludedRootDirectories.has(rootSegment);
      },
    });

    this.linkNodeModules(repositoryPath, sandboxProjectRootPath);
  }

  private linkNodeModules(repositoryPath: string, sandboxProjectRootPath: string): void {
    const sourceNodeModulesPath = path.join(repositoryPath, 'node_modules');
    const sandboxNodeModulesPath = path.join(sandboxProjectRootPath, 'node_modules');

    if (!fs.existsSync(sourceNodeModulesPath) || fs.existsSync(sandboxNodeModulesPath)) {
      return;
    }

    fs.symlinkSync(sourceNodeModulesPath, sandboxNodeModulesPath, 'junction');
  }
}
