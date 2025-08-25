import React, { useRef, useEffect, useState, useCallback } from "react";
import Editor from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import type * as Monaco from "monaco-editor";
import SimpleExportButton from "../buttons/ide/SimpleExportButton";
import LoadingModal from "./LoadingModal";
import { codeApi } from "../../utils/api";
import X from "../buttons/modal/x";

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
        if (editorRef.current) {
          editorRef.current.setValue(data.code);
        }
      }
    } catch (error) {
      console.error("Error fetching code:", error);
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

  // Fetch code when modal opens
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

      // Set the code directly
      editor.setValue(code);

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
        <div className="flex justify-between items-center p-4 border-b border-neutral-700">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            Python IDE - {nodeTitle}
            {isLoadingCode && (
              <span className="text-sm text-neutral-400">(Loading...)</span>
            )}
          </h2>
          <X onClose={onClose} />
        </div>

        <div className="flex-1 p-4 bg-neutral-900">
          <Editor
            height="100%"
            defaultLanguage="python"
            defaultValue={code}
            theme="vs-dark"
            onMount={handleEditorDidMount}
            options={{
              automaticLayout: true,
              minimap: { enabled: true },
              fontSize: 14,
            }}
          />
        </div>

        <div className="p-4 border-t border-neutral-700 flex justify-between">
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
              <span>▶️</span>
              Run
            </button>
            <SimpleExportButton
              code={editorRef.current?.getValue() || code}
              fileName={`${nodeId}_${nodeTitle.replace(/\s+/g, "_")}.py`}
            />
          </div>
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
