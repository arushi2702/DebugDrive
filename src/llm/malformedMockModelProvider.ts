import { ModelProvider, ModelRequest, ModelResponse } from './modelProvider';

export class MalformedMockModelProvider implements ModelProvider {
  readonly providerName = 'malformed-mock-provider';
  readonly modelName = 'malformed-mock-debug-drive-model';

  async generate(_request: ModelRequest): Promise<ModelResponse> {
    return {
      content: 'This is not valid JSON and should trigger parser fallback.',
      providerName: this.providerName,
      modelName: this.modelName,
      rawResponse: {
        malformed: true,
      },
    };
  }
}
