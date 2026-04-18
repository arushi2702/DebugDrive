import {
  AgentRole,
  BugContext,
  CodeChunkRecord,
  CritiqueResult,
  ModelTranscript,
  PatchProposal,
  RetrievalRecord,
} from '../types/agent';
import { DebuggerPromptBuilder } from '../llm/debuggerPrompt';
import { ModelProvider } from '../llm/modelProvider';
import { MockModelProvider } from '../llm/mockModelProvider';
import { PatchResponseParser } from '../llm/patchResponseParser';

export interface LlmDebuggerResult {
  proposal: PatchProposal;
  transcripts: ModelTranscript[];
}

export class LlmDebuggerAgent {
  private readonly role: AgentRole = 'debugger';
  private readonly providerErrorFallback = new MockModelProvider();

  constructor(
    private readonly modelProvider: ModelProvider = new MockModelProvider(),
    private readonly promptBuilder = new DebuggerPromptBuilder(),
    private readonly parser = new PatchResponseParser(),
    private readonly maxParseAttempts = 2,
  ) {}

  async proposeFix(
    sessionId: string,
    bugContext: BugContext,
    previousCritique: CritiqueResult | undefined,
    round: number,
    retrievedMemories: RetrievalRecord[],
    retrievedCodeChunks: CodeChunkRecord[],
    fallbackProposal: PatchProposal,
  ): Promise<LlmDebuggerResult> {
    const promptMessages = this.promptBuilder.build({
      bugContext,
      previousCritique,
      round,
      retrievedMemories,
      retrievedCodeChunks,
    });

    const transcripts: ModelTranscript[] = [];
    let providerFailed = false;

    for (let attempt = 1; attempt <= this.maxParseAttempts; attempt += 1) {
      try {
        const response = await this.modelProvider.generate({
          messages: promptMessages,
          temperature: 0.2,
          maxTokens: 1200,
        });

        const parsed = this.parser.parse(response.content);

        transcripts.push({
          id: `transcript-${sessionId}-${this.role}-${round}-attempt-${attempt}-${Date.now()}`,
          sessionId,
          agentRole: this.role,
          providerName: response.providerName,
          modelName: response.modelName,
          promptMessages,
          responseContent: response.content,
          parsedSuccessfully: parsed.ok,
          parseError: parsed.error,
          createdAt: Date.now(),
        });

        if (parsed.ok && parsed.proposal) {
          return {
            proposal: parsed.proposal,
            transcripts,
          };
        }
      } catch (error) {
        providerFailed = true;
        transcripts.push({
          id: `transcript-${sessionId}-${this.role}-${round}-attempt-${attempt}-${Date.now()}`,
          sessionId,
          agentRole: this.role,
          providerName: 'provider-error',
          modelName: 'provider-error',
          promptMessages,
          responseContent: '',
          parsedSuccessfully: false,
          parseError: error instanceof Error ? error.message : 'Unknown model provider error.',
          createdAt: Date.now(),
        });
      }
    }

    if (providerFailed) {
      const fallbackResponse = await this.providerErrorFallback.generate({
        messages: promptMessages,
        temperature: 0.2,
        maxTokens: 1200,
      });
      const fallbackParsed = this.parser.parse(fallbackResponse.content);

      transcripts.push({
        id: `transcript-${sessionId}-${this.role}-${round}-provider-fallback-${Date.now()}`,
        sessionId,
        agentRole: this.role,
        providerName: fallbackResponse.providerName,
        modelName: fallbackResponse.modelName,
        promptMessages,
        responseContent: fallbackResponse.content,
        parsedSuccessfully: fallbackParsed.ok,
        parseError: fallbackParsed.error,
        createdAt: Date.now(),
      });

      if (fallbackParsed.ok && fallbackParsed.proposal) {
        return {
          proposal: fallbackParsed.proposal,
          transcripts,
        };
      }
    }

    return {
      proposal: fallbackProposal,
      transcripts,
    };
  }
}
