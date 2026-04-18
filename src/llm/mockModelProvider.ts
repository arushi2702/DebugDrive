import { ModelProvider, ModelRequest, ModelResponse } from './modelProvider';

function buildSingleLinePatch(
  targetFile: string,
  summary: string,
  rationale: string,
  buggyLine: string,
  fixedLine: string,
  previousCritique: string | undefined,
): ModelResponse {
  return {
    content: JSON.stringify(
      {
        summary: `${summary} in ${targetFile}`,
        rationale: [
          rationale,
          'The candidate patch replaces the incorrect line with the expected behavior.',
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
          fixedLine,
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

function buildDefaultsDemoPatch(targetFile: string, previousCritique: string | undefined): ModelResponse {
  const buggyLine = "  return preferences.theme ?? '';";
  const fixedLine = "  return preferences.theme ?? 'light';";

  return buildSingleLinePatch(
    targetFile,
    'Fix missing default theme',
    'The default theme should be light when no user preference is provided.',
    buggyLine,
    fixedLine,
    previousCritique,
  );
}

function buildParserDemoPatch(targetFile: string, previousCritique: string | undefined): ModelResponse {
  const buggyLine = '  return input.split(\',\').map((tag) => tag);';
  const fixedLine = "  return input.split(',').map((tag) => tag.trim()).filter((tag) => tag.length > 0);";

  return buildSingleLinePatch(
    targetFile,
    'Fix tag parsing whitespace and empty values',
    'The parser should trim tags and remove empty values.',
    buggyLine,
    fixedLine,
    previousCritique,
  );
}

function buildPaginationDemoPatch(targetFile: string, previousCritique: string | undefined): ModelResponse {
  const buggyLine = '  return page * pageSize;';
  const fixedLine = '  return (page - 1) * pageSize;';

  return buildSingleLinePatch(
    targetFile,
    'Fix one-based pagination start index',
    'The page number is one-based, so page 1 should start at index 0.',
    buggyLine,
    fixedLine,
    previousCritique,
  );
}

function buildFlagsDemoPatch(targetFile: string, previousCritique: string | undefined): ModelResponse {
  const buggyLine = '  return flags.enableBeta ?? true;';
  const fixedLine = '  return flags.enableBeta ?? false;';

  return buildSingleLinePatch(
    targetFile,
    'Fix unsafe beta flag default',
    'Beta features should be disabled unless explicitly enabled.',
    buggyLine,
    fixedLine,
    previousCritique,
  );
}

function buildNullUserPatch(targetFile: string, previousCritique: string | undefined): ModelResponse {
  return buildSingleLinePatch(
    targetFile,
    'Fix null user email fallback',
    'Null or missing user emails should return the configured unknown email fallback.',
    "  return profile!.email ?? '';",
    "  return profile?.email ?? 'unknown@example.com';",
    previousCritique,
  );
}

function buildCartPatch(targetFile: string, previousCritique: string | undefined): ModelResponse {
  return buildSingleLinePatch(
    targetFile,
    'Fix cart total quantity calculation',
    'Cart totals must multiply each item price by its quantity.',
    '  return items.reduce((sum, item) => sum + item.price, 0);',
    '  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);',
    previousCritique,
  );
}

function buildPermissionsPatch(targetFile: string, previousCritique: string | undefined): ModelResponse {
  return buildSingleLinePatch(
    targetFile,
    'Fix suspended editor permission',
    'Suspended users should not be allowed to edit even if their role normally can.',
    "  return user.role === 'admin' || user.role === 'editor';",
    "  return !user.suspended && (user.role === 'admin' || user.role === 'editor');",
    previousCritique,
  );
}

function buildDatesPatch(targetFile: string, previousCritique: string | undefined): ModelResponse {
  return buildSingleLinePatch(
    targetFile,
    'Fix inclusive expiry comparison',
    'A timestamp should be expired once it is equal to or before the current time.',
    '  return expiresAtMs < nowMs;',
    '  return expiresAtMs <= nowMs;',
    previousCritique,
  );
}

function buildApiResponsePatch(targetFile: string, previousCritique: string | undefined): ModelResponse {
  return buildSingleLinePatch(
    targetFile,
    'Fix failed API response unwrap',
    'Failed API responses should throw their error instead of returning undefined data.',
    '  return response.data as T;',
    "  if (!response.ok) { throw new Error(response.error ?? 'Request failed'); } return response.data as T;",
    previousCritique,
  );
}

function buildDedupePatch(targetFile: string, previousCritique: string | undefined): ModelResponse {
  return buildSingleLinePatch(
    targetFile,
    'Fix duplicate ID filtering',
    'ID lists should preserve first-seen order while removing duplicates.',
    '  return ids;',
    '  return Array.from(new Set(ids));',
    previousCritique,
  );
}

function buildRetryPatch(targetFile: string, previousCritique: string | undefined): ModelResponse {
  return buildSingleLinePatch(
    targetFile,
    'Fix retryable HTTP status handling',
    'Only transient rate-limit and server errors should be retried.',
    '  return statusCode >= 400;',
    '  return statusCode === 429 || statusCode >= 500;',
    previousCritique,
  );
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

        if (targetFile.endsWith('src\\demo\\defaults.ts') || targetFile.endsWith('src/demo/defaults.ts')) {
      return buildDefaultsDemoPatch(targetFile, previousCritique);
    }

    if (targetFile.endsWith('src\\demo\\parser.ts') || targetFile.endsWith('src/demo/parser.ts')) {
      return buildParserDemoPatch(targetFile, previousCritique);
    }

    if (targetFile.endsWith('src\\demo\\pagination.ts') || targetFile.endsWith('src/demo/pagination.ts')) {
      return buildPaginationDemoPatch(targetFile, previousCritique);
    }

    if (targetFile.endsWith('src\\demo\\flags.ts') || targetFile.endsWith('src/demo/flags.ts')) {
      return buildFlagsDemoPatch(targetFile, previousCritique);
    }

    if (targetFile.endsWith('src\\demo\\realistic\\nullUser.ts') || targetFile.endsWith('src/demo/realistic/nullUser.ts')) {
      return buildNullUserPatch(targetFile, previousCritique);
    }

    if (targetFile.endsWith('src\\demo\\realistic\\cart.ts') || targetFile.endsWith('src/demo/realistic/cart.ts')) {
      return buildCartPatch(targetFile, previousCritique);
    }

    if (targetFile.endsWith('src\\demo\\realistic\\permissions.ts') || targetFile.endsWith('src/demo/realistic/permissions.ts')) {
      return buildPermissionsPatch(targetFile, previousCritique);
    }

    if (targetFile.endsWith('src\\demo\\realistic\\dates.ts') || targetFile.endsWith('src/demo/realistic/dates.ts')) {
      return buildDatesPatch(targetFile, previousCritique);
    }

    if (targetFile.endsWith('src\\demo\\realistic\\apiResponse.ts') || targetFile.endsWith('src/demo/realistic/apiResponse.ts')) {
      return buildApiResponsePatch(targetFile, previousCritique);
    }

    if (targetFile.endsWith('src\\demo\\realistic\\dedupe.ts') || targetFile.endsWith('src/demo/realistic/dedupe.ts')) {
      return buildDedupePatch(targetFile, previousCritique);
    }

    if (targetFile.endsWith('src\\demo\\realistic\\retry.ts') || targetFile.endsWith('src/demo/realistic/retry.ts')) {
      return buildRetryPatch(targetFile, previousCritique);
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
