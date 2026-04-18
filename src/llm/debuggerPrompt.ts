import { BugContext, CodeChunkRecord, CritiqueResult, RetrievalRecord } from '../types/agent';
import { ModelMessage } from './modelProvider';

export interface DebuggerPromptInput {
  bugContext: BugContext;
  previousCritique?: CritiqueResult;
  retrievedMemories: RetrievalRecord[];
  retrievedCodeChunks: CodeChunkRecord[];
  round: number;
}

export class DebuggerPromptBuilder {
  build(input: DebuggerPromptInput): ModelMessage[] {
    return [
      {
        role: 'system',
        content: [
          'You are the Debugger agent in Debug Drive, a multi-agent autonomous debugging system.',
          'Your task is to propose a safe candidate patch using the bug report, execution feedback, retrieved fix memories, and retrieved code context.',
          'Return only valid JSON with these fields: summary, rationale, diffText, candidateContent, confidence.',
          'The confidence field must be a number between 0 and 1.',
          'Do not include markdown fences or extra commentary outside the JSON object.',
        ].join('\n'),
      },
      {
        role: 'user',
        content: [
          `Round: ${input.round}`,
          '',
          'Bug Context:',
          `Repository: ${input.bugContext.repositoryPath}`,
          `File: ${input.bugContext.filePath ?? '(unknown)'}`,
          `Language: ${input.bugContext.language ?? '(unknown)'}`,
          `Problem: ${input.bugContext.problemStatement}`,
          `Failing Command: ${input.bugContext.failingCommand ?? '(not provided)'}`,
          `Error Output: ${input.bugContext.errorOutput ?? '(not provided)'}`,
          input.bugContext.strategyHint ? `Selected Strategy: ${input.bugContext.strategyHint}` : undefined,
          '',
          'Relevant Code:',
          input.bugContext.relevantCode ?? '(not provided)',
          '',
          'Previous Critique:',
          input.previousCritique
            ? [
                `Approved: ${input.previousCritique.approved}`,
                `Issues: ${input.previousCritique.issues.join(' | ') || '(none)'}`,
                `Suggestions: ${input.previousCritique.improvementSuggestions.join(' | ') || '(none)'}`,
              ].join('\n')
            : '(none)',
          '',
          'Retrieved Fix Memories:',
          input.retrievedMemories.length > 0
            ? input.retrievedMemories
                .map((record) =>
                  [
                    `- Summary: ${record.summary}`,
                    `  Problem: ${record.problemStatement}`,
                    `  Rationale: ${record.rationale}`,
                  ].join('\n'),
                )
                .join('\n')
            : '(none)',
          '',
          'Retrieved Code Context:',
          input.retrievedCodeChunks.length > 0
            ? input.retrievedCodeChunks
                .map((chunk) =>
                  [
                    `- ${chunk.filePath}:${chunk.startLine}-${chunk.endLine}`,
                    chunk.content,
                  ].join('\n'),
                )
                .join('\n\n')
            : '(none)',
        ].filter((item): item is string => item !== undefined).join('\n'),
      },
    ];
  }
}
