import * as monaco from 'monaco-editor';
import { initServices } from '@codingame/monaco-vscode-api/services';
import getConfigurationServiceOverride from '@codingame/monaco-vscode-api/service-override/configuration';
import getKeybindingsServiceOverride from '@codingame/monaco-vscode-api/service-override/keybindings';
import getThemeServiceOverride from '@codingame/monaco-vscode-api/service-override/theme';
import getTextmateServiceOverride from '@codingame/monaco-vscode-api/service-override/textmate';
import getLanguagesServiceOverride from '@codingame/monaco-vscode-api/service-override/languages';
import getModelServiceOverride from '@codingame/monaco-vscode-api/service-override/model';

let isInitialized = false;

/**
 * Initialize Monaco services for LSP support
 * This should be called once before using Monaco Editor with LSP
 */
export async function initializeMonacoServices(): Promise<void> {
  if (isInitialized) {
    return;
  }

  try {
    // Initialize VSCode API services required for LSP
    await initServices({
      ...getConfigurationServiceOverride(),
      ...getKeybindingsServiceOverride(),
      ...getThemeServiceOverride(),
      ...getTextmateServiceOverride(),
      ...getLanguagesServiceOverride(),
      ...getModelServiceOverride(),
    });

    // Register Python language if not already registered
    if (!monaco.languages.getLanguages().some(lang => lang.id === 'python')) {
      monaco.languages.register({
        id: 'python',
        extensions: ['.py'],
        aliases: ['Python', 'python'],
        mimetypes: ['text/x-python', 'application/x-python'],
      });
    }

    // Set Python language configuration
    monaco.languages.setLanguageConfiguration('python', {
      comments: {
        lineComment: '#',
        blockComment: ["'''", "'''"],
      },
      brackets: [
        ['{', '}'],
        ['[', ']'],
        ['(', ')'],
      ],
      autoClosingPairs: [
        { open: '{', close: '}' },
        { open: '[', close: ']' },
        { open: '(', close: ')' },
        { open: '"', close: '"' },
        { open: "'", close: "'" },
        { open: '"""', close: '"""' },
        { open: "'''", close: "'''" },
      ],
      surroundingPairs: [
        { open: '{', close: '}' },
        { open: '[', close: ']' },
        { open: '(', close: ')' },
        { open: '"', close: '"' },
        { open: "'", close: "'" },
      ],
      folding: {
        offSide: true,
        markers: {
          start: new RegExp('^\\s*#region\\b'),
          end: new RegExp('^\\s*#endregion\\b'),
        },
      },
      indentationRules: {
        increaseIndentPattern: /^\s*(class|def|elif|else|except|finally|for|if|try|while|with)\b.*/,
        decreaseIndentPattern: /^\s*(elif|else|except|finally)\b.*/,
      },
      onEnterRules: [
        {
          beforeText: /^\s*(?:def|class|for|if|elif|else|while|try|except|finally|with).*:\s*$/,
          action: { indentAction: monaco.languages.IndentAction.Indent },
        },
      ],
    });

    // Set default theme
    monaco.editor.setTheme('vs-dark');

    isInitialized = true;
    console.log('Monaco services initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Monaco services:', error);
    throw error;
  }
}

/**
 * Create a Monaco model for a file
 */
export function createModel(
  content: string,
  language: string,
  uri?: string
): monaco.editor.ITextModel {
  const modelUri = uri
    ? monaco.Uri.parse(uri)
    : monaco.Uri.parse(`inmemory://model/${Date.now()}.${language}`);

  // Check if model already exists
  const existingModel = monaco.editor.getModel(modelUri);
  if (existingModel) {
    existingModel.setValue(content);
    return existingModel;
  }

  return monaco.editor.createModel(content, language, modelUri);
}

/**
 * Dispose a Monaco model
 */
export function disposeModel(model: monaco.editor.ITextModel): void {
  model.dispose();
}