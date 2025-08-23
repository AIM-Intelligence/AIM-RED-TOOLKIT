import React, { useRef, useEffect, useState, useCallback } from "react";
import Editor from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import type * as Monaco from "monaco-editor";
import SimpleExportButton from "../buttons/ide/SimpleExportButton";
import LoadingModal from "./LoadingModal";
import { codeApi } from "../../utils/api";
import X from "../buttons/modal/x";
import { pythonLspClient, type LSPConnection } from "../../lsp/pythonLspClient";
import {
  initializeMonacoServices,
  createModel,
  disposeModel,
} from "../../lsp/monacoSetup";
import ProjectTerminal from "../terminal/ProjectTerminal";

interface IdeModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  nodeId: string;
  nodeTitle: string;
  initialCode?: string;
}

const IdeModal: React.FC<IdeModalProps> = ({
  isOpen,
  onClose,
  projectId,
  nodeId,
  nodeTitle,
  initialCode = "# Write your Python function here\ndef foo():\n  return 'Hello, World!'",
}) => {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"loading" | "success" | "error">(
    "loading"
  );
  const [code, setCode] = useState(initialCode);
  const [isLoadingCode, setIsLoadingCode] = useState(false);
  const [runModalOpen, setRunModalOpen] = useState(false);
  const [runStatus, setRunStatus] = useState<"loading" | "success" | "error">(
    "loading"
  );
  const [runResult, setRunResult] = useState<string>("");
  const [lspConnection, setLspConnection] = useState<LSPConnection | null>(
    null
  );
  const [isLspConnecting, setIsLspConnecting] = useState(false);
  const modelRef = useRef<Monaco.editor.ITextModel | null>(null);
  const [showTerminal, setShowTerminal] = useState(false);

  // Fetch installed packages
  const fetchPackages = useCallback(async () => {
    if (!projectId) return;

    try {
      const data = await codeApi.getPackages({ project_id: projectId });
      if (data.success) {
        console.log(`${data.packages} Installed`);
      }
    } catch (error) {
      console.error("Error fetching packages:", error);
    }
  }, [projectId]);

  // Handle package changes from terminal
  const handleTerminalPackageChanged = useCallback(async () => {
    // Refresh package list
    await fetchPackages();

    // Restart LSP to pick up changes
    if (lspConnection) {
      console.log("Restarting LSP after terminal package change");
      await lspConnection.restart();
    }
  }, [fetchPackages, lspConnection]);

  // Fetch code from backend when modal opens
  const fetchCode = useCallback(async () => {
    if (!projectId || !nodeId) return;

    setIsLoadingCode(true);
    try {
      const data = await codeApi.getNodeCode({
        project_id: projectId,
        node_id: nodeId,
        node_title: nodeTitle,
      });

      if (data.success && data.code) {
        setCode(data.code);
        if (editorRef.current && modelRef.current) {
          // Update model value directly instead of setValue on editor
          modelRef.current.setValue(data.code);
        }
      }
    } catch (error) {
      console.error("Error fetching code:", error);
      // If fetch fails, keep the default code
    } finally {
      setIsLoadingCode(false);
    }
  }, [projectId, nodeId, nodeTitle]);

  const handleSave = useCallback(async () => {
    if (!editorRef.current) return;

    setSaveModalOpen(true);
    setSaveStatus("loading");
    const currentCode = editorRef.current.getValue();

    try {
      const data = await codeApi.saveNodeCode({
        project_id: projectId,
        node_id: nodeId,
        node_title: nodeTitle,
        code: currentCode,
      });

      if (data.success) {
        setSaveStatus("success");
        setCode(currentCode);
        setTimeout(() => setSaveModalOpen(false), 1500);
      } else {
        setSaveStatus("error");
      }
    } catch (error) {
      setSaveStatus("error");
      console.error("Error saving code:", error);
    }
  }, [projectId, nodeId, nodeTitle]);

  const handleRunCode = useCallback(async () => {
    if (!editorRef.current) return;

    setRunModalOpen(true);
    setRunStatus("loading");
    setRunResult("");

    const currentCode = editorRef.current.getValue();

    try {
      // First save the code
      await codeApi.saveNodeCode({
        project_id: projectId,
        node_id: nodeId,
        node_title: nodeTitle,
        code: currentCode,
      });

      // Then execute it
      const result = await codeApi.executeNode({
        project_id: projectId,
        node_id: nodeId,
      });

      if (result.success) {
        setRunStatus("success");
        setRunResult(JSON.stringify(result.output, null, 2));
      } else {
        setRunStatus("error");
        setRunResult(result.error || "Execution failed");
      }
    } catch (error) {
      setRunStatus("error");
      setRunResult(error instanceof Error ? error.message : "Unknown error");
    }
  }, [projectId, nodeId, nodeTitle]);

  // Initialize Monaco services on first mount
  useEffect(() => {
    initializeMonacoServices().catch(console.error);
  }, []);

  // Connect to LSP when modal opens
  useEffect(() => {
    if (isOpen && projectId && !lspConnection && !isLspConnecting) {
      setIsLspConnecting(true);
      pythonLspClient
        .connect(projectId)
        .then((connection) => {
          setLspConnection(connection);
          console.log("LSP connected successfully");
        })
        .catch((error) => {
          console.error("Failed to connect to LSP:", error);
        })
        .finally(() => {
          setIsLspConnecting(false);
        });
    }

    return () => {
      if (lspConnection && !isOpen) {
        lspConnection.dispose();
        setLspConnection(null);
      }
    };
  }, [isOpen, projectId, lspConnection, isLspConnecting]);

  // Fetch code and packages when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchCode();
      fetchPackages();
    }
  }, [isOpen, nodeId, fetchCode, fetchPackages]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }

    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]);

  // Ctrl+S / Cmd+S save shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+S (Windows/Linux) or Cmd+S (Mac)
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault(); // Prevent browser's default save dialog
        handleSave();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, handleSave]);

  const handleEditorDidMount = useCallback(
    (editor: editor.IStandaloneCodeEditor, monaco: typeof Monaco) => {
      editorRef.current = editor;

      // Create a model for the file with proper URI
      const fileUri = `file:///${projectId}/${nodeId}_${nodeTitle.replace(
        /\s+/g,
        "_"
      )}.py`;

      // Dispose old model if exists
      if (modelRef.current) {
        disposeModel(modelRef.current);
      }

      // Create new model with current code
      const model = createModel(code, "python", fileUri);
      modelRef.current = model;
      editor.setModel(model);

      // LSP will handle all language features

      // Configure editor options
      editor.updateOptions({
        automaticLayout: true,
        minimap: { enabled: true },
        scrollBeyondLastLine: false,
        fontSize: 14,
        lineNumbers: "on",
        roundedSelection: false,
        cursorStyle: "line",
        glyphMargin: true,
        quickSuggestions: {
          other: true,
          comments: false,
          strings: false,
        },
        wordBasedSuggestions: "currentDocument",
        suggestOnTriggerCharacters: true,
        parameterHints: {
          enabled: true,
        },
        suggest: {
          snippetsPreventQuickSuggestions: false,
          showMethods: true,
          showFunctions: true,
          showVariables: true,
          showClasses: true,
          showModules: true,
          showKeywords: true,
          showSnippets: true,
          insertMode: "replace",
        },
        tabSize: 4,
        insertSpaces: true,
        formatOnType: true,
        formatOnPaste: true,
        autoIndent: "full",
        folding: true,
        foldingStrategy: "indentation",
      });

      // Add Python-specific keybindings
      editor.addAction({
        id: "python-run-code",
        label: "Run Python Code",
        keybindings: [monaco.KeyCode.F5],
        contextMenuGroupId: "navigation",
        contextMenuOrder: 1.5,
        run: () => {
          handleRunCode();
        },
      });
    },
    [code, projectId, nodeId, nodeTitle, handleRunCode]
  );

  // Cleanup model on unmount
  useEffect(() => {
    return () => {
      if (modelRef.current) {
        disposeModel(modelRef.current);
        modelRef.current = null;
      }
    };
  }, []);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-[9990] backdrop-blur-lg bg-black/50 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="bg-neutral-950 rounded-lg shadow-2xl w-11/12 max-w-6xl h-5/6 flex flex-col animate-scaleIn relative"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-4 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            {nodeTitle}
            {isLoadingCode && (
              <span className="text-sm text-gray-400">(Loading...)</span>
            )}
          </h2>
          <X onClose={onClose} />
        </div>

        <div
          className={`flex-1 flex ${
            showTerminal ? "flex-col" : ""
          } bg-neutral-900`}
        >
          <div className={`${showTerminal ? "flex-1" : "h-full"} p-4`}>
            <Editor
              height="100%"
              defaultLanguage="python"
              value={code}
              theme="vs-dark"
              onMount={handleEditorDidMount}
              loading={
                <div className="flex items-center justify-center h-full text-gray-400">
                  Loading editor...
                </div>
              }
              options={{
                automaticLayout: true,
                minimap: { enabled: true },
                fontSize: 14,
              }}
            />
          </div>

          {showTerminal && (
            <div
              className="border-t border-gray-700"
              style={{
                height: `${300}px`,
                minHeight: "200px",
                maxHeight: "500px",
              }}
            >
              <ProjectTerminal
                projectId={projectId}
                mode="pkg"
                onPackageChanged={handleTerminalPackageChanged}
                height={`${290}px`}
              />
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-700 flex justify-between">
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors flex items-center gap-2"
            >
              Save
            </button>
            <button
              onClick={handleRunCode}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              Run
            </button>
            <SimpleExportButton
              code={editorRef.current?.getValue() || code}
              fileName={`${nodeId}_${nodeTitle.replace(/\s+/g, "_")}.py`}
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowTerminal(!showTerminal)}
              className={`px-4 py-2 ${
                showTerminal
                  ? "bg-orange-600 hover:bg-orange-700"
                  : "bg-gray-600 hover:bg-gray-700"
              } text-white rounded transition-colors flex items-center gap-2`}
              title={showTerminal ? "Hide Terminal" : "Show Terminal"}
            >
              Terminal
            </button>
          </div>
        </div>

        {/* LSP Status Indicator */}
        <div className="absolute bottom-4 right-4 flex items-center gap-2 text-xs text-gray-400">
          {isLspConnecting && (
            <span className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></span>
              Connecting to language server...
            </span>
          )}
          {lspConnection && !isLspConnecting && (
            <span className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 bg-green-500 rounded-full"></span>
              Language server connected
            </span>
          )}
          {!lspConnection && !isLspConnecting && (
            <span className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 bg-gray-500 rounded-full"></span>
              Language server offline
            </span>
          )}
        </div>

        {/* Save Modal */}
        <LoadingModal
          isOpen={saveModalOpen}
          status={saveStatus}
          notice={{
            loading: "Saving code...",
            success: "Code saved successfully!",
            error: "Failed to save code",
          }}
          onClose={() => setSaveModalOpen(false)}
        />

        {/* Run Modal */}
        <LoadingModal
          isOpen={runModalOpen}
          status={runStatus}
          notice={{
            loading: "Executing code...",
            success: "Execution completed!",
            error: "Execution failed",
            errorDetails: runStatus === "error" ? runResult : undefined,
          }}
          onClose={() => setRunModalOpen(false)}
        />
      </div>
    </div>
  );
};

export default IdeModal;
