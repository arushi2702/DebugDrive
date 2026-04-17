export interface ModelMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ModelRequest {
  messages: ModelMessage[];
  temperature?: number;
  maxTokens?: number;
}

export interface ModelResponse {
  content: string;
  providerName: string;
  modelName: string;
  rawResponse?: unknown;
}

export interface ModelProvider {
  readonly providerName: string;
  readonly modelName: string;
  generate(request: ModelRequest): Promise<ModelResponse>;
}
