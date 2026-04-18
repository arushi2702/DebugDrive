import { ModelProvider, ModelRequest, ModelResponse } from './modelProvider';

export interface OpenAIModelProviderOptions {
  apiKey: string;
  model: string;
}

interface OpenAIChatResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

export class OpenAIModelProvider implements ModelProvider {
  readonly providerName = 'openai';

  constructor(private readonly options: OpenAIModelProviderOptions) {}

  get modelName(): string {
    return this.options.model;
  }

  async generate(request: ModelRequest): Promise<ModelResponse> {
    if (!this.options.apiKey) {
      throw new Error('OpenAI API key is required when using the OpenAI model provider.');
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.options.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.options.model,
        messages: request.messages,
        temperature: request.temperature ?? 0.2,
        max_tokens: request.maxTokens ?? 1200,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`OpenAI request failed with ${response.status}: ${errorBody}`);
    }

    const data = (await response.json()) as OpenAIChatResponse;
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('OpenAI response did not include message content.');
    }

    return {
      content,
      providerName: this.providerName,
      modelName: this.modelName,
      rawResponse: data,
    };
  }
}
