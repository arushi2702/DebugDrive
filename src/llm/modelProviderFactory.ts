import * as vscode from 'vscode';
import { MockModelProvider } from './mockModelProvider';
import { OpenAIModelProvider } from './openAIModelProvider';
import { ModelProvider } from './modelProvider';

export interface ModelProviderSelection {
  provider: ModelProvider;
  providerMode: 'mock' | 'openai';
  modelName: string;
  fallbackReason?: string;
}

export class ModelProviderFactory {
  create(): ModelProviderSelection {
    const config = vscode.workspace.getConfiguration('debugDrive');

    const configuredProvider = config.get<'mock' | 'openai'>('modelProvider', 'mock');
    const configuredModel = config.get<string>('openaiModel', 'gpt-4o-mini');
    const configuredApiKey = config.get<string>('openaiApiKey', '');
    const apiKey = configuredApiKey || process.env.OPENAI_API_KEY || '';

    if (configuredProvider === 'openai') {
      if (!apiKey) {
        const fallbackProvider = new MockModelProvider();

        return {
          provider: fallbackProvider,
          providerMode: 'mock',
          modelName: fallbackProvider.modelName,
          fallbackReason: 'OpenAI provider selected but no API key was configured.',
        };
      }

      const provider = new OpenAIModelProvider({
        apiKey,
        model: configuredModel,
      });

      return {
        provider,
        providerMode: 'openai',
        modelName: provider.modelName,
      };
    }

    const provider = new MockModelProvider();

    return {
      provider,
      providerMode: 'mock',
      modelName: provider.modelName,
    };
  }
}
