import * as monaco from 'monaco-editor';
import { initialize } from '@codingame/monaco-vscode-api';
import getConfigurationServiceOverride from '@codingame/monaco-vscode-configuration-service-override';
import getKeybindingsServiceOverride from '@codingame/monaco-vscode-keybindings-service-override';
import getThemeServiceOverride from '@codingame/monaco-vscode-theme-service-override';
import getTextmateServiceOverride from '@codingame/monaco-vscode-textmate-service-override';
import getLanguagesServiceOverride from '@codingame/monaco-vscode-languages-service-override';
import getModelServiceOverride from '@codingame/monaco-vscode-model-service-override';
import '@codingame/monaco-vscode-theme-defaults-default-extension';

// Import oniguruma WASM loading utilities
import { loadWASM } from 'vscode-oniguruma';
import onigWasmUrl from 'vscode-oniguruma/release/onig.wasm?url';

let isInitialized = false;
let initPromise: Promise<void> | null = null;

/**
 * Initialize Monaco services for LSP support
 * This should be called once before using Monaco Editor with LSP
 */
export async function initializeMonacoServices(): Promise<void> {
  if (isInitialized) {
    return;
  }

  // Return existing promise if initialization is in progress
  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    try {
      // Load oniguruma WASM for textmate tokenization
      console.log('[Monaco] Loading oniguruma WASM from:', onigWasmUrl);
      const wasmResponse = await fetch(onigWasmUrl);
      if (!wasmResponse.ok) {
        console.warn(`[Monaco] Failed to load WASM: ${wasmResponse.status}. Continuing without textmate support.`);
        // Continue initialization without WASM - editor will still work
      } else {
        const wasmBuffer = await wasmResponse.arrayBuffer();
        await loadWASM(wasmBuffer);
        console.log('[Monaco] Successfully loaded oniguruma WASM');
      }

      // Initialize VSCode API services required for LSP
      console.log('[Monaco] Initializing VSCode API services...');
      await initialize({
        ...getModelServiceOverride(),
        ...getConfigurationServiceOverride(),
        ...getKeybindingsServiceOverride(),
        ...getThemeServiceOverride(),
        ...getTextmateServiceOverride(),
        ...getLanguagesServiceOverride(),
      }, undefined, {
        // Additional configuration for better LSP support
        workspaceProvider: {
          trusted: true,
          workspace: {
            workspaceUri: monaco.Uri.file('/app/projects')
          },
          async open() {
            return true;
          }
        }
      });
      console.log('[Monaco] VSCode API services initialized');

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
      console.log('[Monaco] Services initialized successfully');
    } catch (error) {
      console.error('[Monaco] Failed to initialize services:', error);
      console.warn('[Monaco] App will continue without full Monaco features');
      // Mark as initialized to prevent repeated attempts
      isInitialized = true;
      // Don't throw to prevent app crash - editor can work with reduced features
    }
  })();

  return initPromise;
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