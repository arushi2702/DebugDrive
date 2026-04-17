import { ModelProvider, ModelRequest, ModelResponse } from './modelProvider';

function extractTargetFile(content: string): string {
  const match = content.match(/^File:\s*(.+)$/m);
  return match?.[1]?.trim() || 'unknown-file';
}

function extractPreviousCritique(content: string): string | undefined {
  const suggestionsMatch = content.match(/^Suggestions:\s*(.+)$/m);
  const suggestions = suggestionsMatch?.[1]?.trim();

  if (!suggestions || suggestions === '(none)') {
    return undefined;
  }

  return suggestions;
}

function extractFirstRelevantCodeLine(content: string): string {
  const marker = 'Relevant Code:\n';
  const markerIndex = content.indexOf(marker);

  if (markerIndex === -1) {
    return '// unable to locate relevant code';
  }

  const afterMarker = content.slice(markerIndex + marker.length);
  const firstLine = afterMarker.split(/\r?\n/).find((line) => line.trim().length > 0);

  return firstLine ?? '// unable to locate relevant code';
}

function buildDemoPatch(targetFile: string, previousCritique: string | undefined): ModelResponse {
  const buggyLine = '    return undefined as unknown as string[];';
  const fixedLine = '    return [];';

  return {
    content: JSON.stringify(
      {
        summary: `Fix empty-array behavior in ${targetFile}`,
        rationale: [
          'The failing behavior says an empty input should return [] but the implementation returns undefined.',
          'The candidate patch replaces the empty-array branch with an explicit empty array return.',
          previousCritique ? `Addressing critique: ${previousCritique}` : undefined,
        ]
          .filter(Boolean)
          .join('\n'),
        diffText: [
          `--- a/${targetFile}`,
          `+++ b/${targetFile}`,
          '@@',
          `-${buggyLine}`,
          `+${fixedLine}`,
        ].join('\n'),
        candidateContent: [
          `// Demo model candidate content for ${targetFile}`,
          'export function getItems(items: string[]): string[] {',
          '  if (items.length === 0) {',
          fixedLine,
          '  }',
          '',
          '  return items;',
          '}',
        ].join('\n'),
        confidence: 0.82,
      },
      null,
      2,
    ),
    providerName: 'mock-provider',
    modelName: 'mock-debug-drive-model',
    rawResponse: {
      targetFile,
      demoPatch: true,
    },
  };
}

export class MockModelProvider implements ModelProvider {
  readonly providerName = 'mock-provider';
  readonly modelName = 'mock-debug-drive-model';

  async generate(request: ModelRequest): Promise<ModelResponse> {
    const latestUserMessage = [...request.messages]
      .reverse()
      .find((message) => message.role === 'user');

    const targetFile = latestUserMessage ? extractTargetFile(latestUserMessage.content) : 'unknown-file';
    const previousCritique = latestUserMessage
      ? extractPreviousCritique(latestUserMessage.content)
      : undefined;
    const firstRelevantCodeLine = latestUserMessage
      ? extractFirstRelevantCodeLine(latestUserMessage.content)
      : '// unable to locate relevant code';
    const messageContent = latestUserMessage?.content ?? '';

    if (
      targetFile.endsWith('src\\demo\\items.ts') ||
      targetFile.endsWith('src/demo/items.ts') ||
      messageContent.includes('return undefined as unknown as string[]')
    ) {
      return buildDemoPatch(targetFile, previousCritique);
    }

    return {
      content: JSON.stringify(
        {
          summary: `Mock model generated patch proposal for ${targetFile}`,
          rationale: [
            latestUserMessage
              ? `Mock response based on: ${latestUserMessage.content.slice(0, 240)}`
              : 'Mock response generated without user context.',
            previousCritique ? `Addressing critique: ${previousCritique}` : undefined,
          ]
            .filter(Boolean)
            .join('\n'),
          diffText: [
            `--- a/${targetFile}`,
            `+++ b/${targetFile}`,
            '@@',
            `-${firstRelevantCodeLine}`,
            '+// mock model candidate fix',
            `+${firstRelevantCodeLine}`,
          ].join('\n'),
          candidateContent: [
            `// Mock model candidate content for ${targetFile}`,
            '// mock model candidate fix',
            firstRelevantCodeLine,
          ].join('\n'),
          confidence: 0.72,
        },
        null,
        2,
      ),
      providerName: this.providerName,
      modelName: this.modelName,
      rawResponse: {
        messageCount: request.messages.length,
        targetFile,
      },
    };
  }
}
