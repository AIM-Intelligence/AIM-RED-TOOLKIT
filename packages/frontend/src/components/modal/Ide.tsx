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
  const [venvStatus, setVenvStatus] = useState<
    "checking" | "creating" | "ready" | "error"
  >("checking");
  const [venvProgress, setVenvProgress] = useState<{
    progress?: number;
    message?: string;
    current_package?: string | null;
  }>({
    progress: 0,
    message: "",
    current_package: null
  });
  const modelRef = useRef<Monaco.editor.ITextModel | null>(null);
  const [showTerminal, setShowTerminal] = useState(false);

  // Handle package changes from terminal
  const handleTerminalPackageChanged = useCallback(async () => {
    // Restart LSP to pick up changes
    if (lspConnection) {
      console.log("Restarting LSP after terminal package change");
      await lspConnection.restart();
    }
  }, [lspConnection]);

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
        // Only update model if it exists, otherwise the code will be used when model is created
        if (editorRef.current && modelRef.current) {
          try {
            // Update model value directly instead of setValue on editor
            modelRef.current.setValue(data.code);
          } catch (error) {
            console.error("Error updating model value:", error);
            // Fallback: just update the state, it will be used when editor mounts
          }
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

  // Check venv status only when modal opens
  useEffect(() => {
    let retryTimeout: NodeJS.Timeout | null = null;
    let isCancelled = false;

    const checkVenvStatus = async () => {
      if (!isOpen || !projectId || isCancelled) return;
      
      try {
        setVenvStatus("checking");
        const { projectApi } = await import("../../utils/api");
        const venvStatusResult = await projectApi.getVenvStatus(projectId);

        if (isCancelled) return;

        console.log("Venv status check result:", venvStatusResult);

        // Update progress information
        if (venvStatusResult.progress !== undefined) {
          setVenvProgress({
            progress: venvStatusResult.progress || 0,
            message: venvStatusResult.message || "",
            current_package: venvStatusResult.current_package || null,
          });
        }

        if (!venvStatusResult.venv_ready) {
          // Check the detailed status
          if (venvStatusResult.status === "not_started") {
            console.log("Virtual environment not started, initiating creation...");
            setVenvStatus("creating");
            
            // Start venv creation
            try {
              const createResult = await projectApi.createVenv(projectId);
              console.log("Venv creation initiated:", createResult);
              
              // Poll for status after starting creation
              if (!isCancelled) {
                retryTimeout = setTimeout(() => {
                  checkVenvStatus();
                }, 2000);
              }
            } catch (createError) {
              console.error("Failed to initiate venv creation:", createError);
              setVenvStatus("error");
            }
            return;
          } else if (
            venvStatusResult.status === "creating" ||
            venvStatusResult.status === "installing_pip" ||
            venvStatusResult.status === "installing_base" ||
            venvStatusResult.status === "installing_lsp"
          ) {
            console.log(
              `Virtual environment ${venvStatusResult.status}: ${venvStatusResult.message}`
            );
            setVenvStatus("creating");
            // Poll again after 3 seconds for venv creation progress
            if (!isCancelled) {
              retryTimeout = setTimeout(() => {
                checkVenvStatus();
              }, 3000);
            }
            return;
          } else if (venvStatusResult.status === "completed") {
            // Explicitly handle completed status
            console.log("Virtual environment creation completed");
            setVenvStatus("ready");
            return;
          } else if (venvStatusResult.status === "failed") {
            console.error(
              "Virtual environment creation failed:",
              venvStatusResult.error
            );
            setVenvStatus("error");
            return;
          }
        } else {
          // Venv is ready
          setVenvStatus("ready");
        }
      } catch (error) {
        console.error("Failed to check venv status:", error);
        if (!isCancelled) {
          setVenvStatus("error");
        }
      }
    };

    if (isOpen && projectId) {
      checkVenvStatus();
    }

    return () => {
      isCancelled = true;
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
    };
  }, [isOpen, projectId]);

  // Connect to LSP when venv is ready (separate effect)
  useEffect(() => {
    let connectTimeout: NodeJS.Timeout | null = null;

    const connectLSP = async () => {
      if (!isOpen || !projectId || lspConnection || isLspConnecting || venvStatus !== "ready") {
        return;
      }

      try {
        setIsLspConnecting(true);
        console.log("Connecting to LSP...");
        const connection = await pythonLspClient.connect(projectId);
        setLspConnection(connection);
        console.log("LSP connected successfully");
      } catch (error) {
        console.error("Failed to connect to LSP:", error);
        // Retry LSP connection after 5 seconds, but only if modal is still open
        if (isOpen) {
          connectTimeout = setTimeout(() => {
            connectLSP();
          }, 5000);
        }
      } finally {
        setIsLspConnecting(false);
      }
    };

    if (venvStatus === "ready") {
      connectLSP();
    }

    return () => {
      if (connectTimeout) {
        clearTimeout(connectTimeout);
      }
    };
  }, [isOpen, projectId, venvStatus, lspConnection, isLspConnecting]);

  // Cleanup LSP connection when modal closes
  useEffect(() => {
    return () => {
      if (!isOpen && lspConnection) {
        lspConnection.dispose();
        setLspConnection(null);
        setVenvStatus("checking");
      }
    };
  }, [isOpen, lspConnection]);

  // Fetch code and packages when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchCode();
    }
  }, [isOpen, nodeId, fetchCode]);

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

      // Create a model for the file with proper URI that matches executor's file system
      // Sanitize the title the same way the backend does
      const sanitizedTitle = nodeTitle.replace(/[^a-zA-Z0-9]/g, "_");
      const fileUri = `file:///app/projects/${projectId}/${nodeId}_${sanitizedTitle}.py`;

      // Dispose old model if exists
      if (modelRef.current) {
        disposeModel(modelRef.current);
      }

      // Create new model with current code
      const model = createModel(code, "python", fileUri);
      modelRef.current = model;
      editor.setModel(model);
      
      // Focus editor to trigger LSP document sync
      editor.focus();

      // LSP will handle all language features (diagnostics, hover, completion, etc.)

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
            {venvStatus === "checking" && (
              <span className="text-sm text-yellow-400">
                (Checking environment...)
              </span>
            )}
            {venvStatus === "creating" && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-blue-400">
                  {venvProgress.message || "Setting up Python environment..."}
                </span>
                {venvProgress.progress !== undefined && venvProgress.progress > 0 && (
                  <div className="w-32 h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 transition-all duration-300"
                      style={{ width: `${Math.min(100, Math.max(0, venvProgress.progress))}%` }}
                    />
                  </div>
                )}
                {venvProgress.current_package && (
                  <span className="text-xs text-gray-400">
                    ({venvProgress.current_package})
                  </span>
                )}
              </div>
            )}
            {venvStatus === "error" && (
              <span className="text-sm text-red-400">(Environment error)</span>
            )}
            {venvStatus === "ready" && !isLoadingCode && (
              <span className="text-sm text-green-400">✓ Ready</span>
            )}
          </h2>
          <X onClose={onClose} />
        </div>

        <div
          className={`flex-1 flex ${
            showTerminal ? "flex-col" : ""
          } bg-neutral-900 overflow-hidden`}
        >
          <div
            className={`${
              showTerminal ? "flex-1" : "h-full"
            } relative min-h-0 w-full`}
            style={{ minHeight: "400px" }}
          >
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
