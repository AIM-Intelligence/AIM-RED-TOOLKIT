import React, { useRef, useEffect, useState, useCallback } from "react";
import Editor from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import RunCodeButton from "../buttons/ide/RunCodeButton";
import ExportCodeButton from "../buttons/ide/ExportCodeButton";
import SaveStatusModal from "./SaveStatusModal";

interface IdeModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectTitle: string;
  nodeId: string;
  nodeTitle: string;
  initialCode?: string;
}

const IdeModal: React.FC<IdeModalProps> = ({
  isOpen,
  onClose,
  projectTitle,
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

  // Fetch code from backend when modal opens
  const fetchCode = useCallback(async () => {
    if (!projectTitle || !nodeId) return;

    setIsLoadingCode(true);
    try {
      const response = await fetch("http://localhost:8000/api/code/getcode", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          project_name: projectTitle,
          node_id: nodeId,
          node_title: nodeTitle,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.code) {
          setCode(data.code);
          if (editorRef.current) {
            editorRef.current.setValue(data.code);
          }
        }
      }
    } catch (error) {
      console.error("Error fetching code:", error);
    } finally {
      setIsLoadingCode(false);
    }
  }, [projectTitle, nodeId, nodeTitle]);

  const handleSave = async () => {
    if (!editorRef.current) return;

    setSaveModalOpen(true);
    setSaveStatus("loading");
    const currentCode = editorRef.current.getValue();

    try {
      const response = await fetch("http://localhost:8000/api/code/savecode", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          project_name: projectTitle,
          node_id: nodeId,
          node_title: nodeTitle,
          code: currentCode,
        }),
      });

      if (response.ok) {
        setSaveStatus("success");
        setCode(currentCode);
      } else {
        setSaveStatus("error");
      }
    } catch (error) {
      console.error("Error saving code:", error);
      setSaveStatus("error");
    }
  };

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

  const handleEditorDidMount = (editor: editor.IStandaloneCodeEditor) => {
    editorRef.current = editor;
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-[9990] backdrop-blur-lg bg-black/50 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative bg-[#0a0a0a] rounded-xl w-[70vw] h-[70vh] overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.8)] animate-slideUp flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          {/* Left side - Action buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="px-4 py-2 rounded-lg font-medium transition-all bg-blue-600 text-white hover:bg-blue-700 hover:cursor-pointer "
            >
              Save
            </button>
            <RunCodeButton />
            <ExportCodeButton 
              nodeId={nodeId} 
              nodeTitle={nodeTitle} 
              editorRef={editorRef}
            />
          </div>

          {/* Center - Title */}
          <h2 className="text-white text-lg font-semibold absolute left-1/2 transform -translate-x-1/2">
            {nodeTitle}
          </h2>

          {/* Right side - Close button */}
          <button
            className="bg-transparent border-none text-white cursor-pointer p-2 flex items-center justify-center rounded transition-all duration-200 ease-in-out hover:bg-white/10 active:scale-95"
            onClick={onClose}
            aria-label="Close modal"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M18 6L6 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M6 6L18 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        {/* Editor Container */}
        <div className="flex-1 overflow-hidden">
          {isLoadingCode ? (
            <div className="flex flex-col items-center justify-center h-full">
              <img
                src={"/aim-red.png"}
                alt="Loading"
                className="w-9 h-9 animate-spin-reverse mb-3"
              />
              <div className="text-white">Loading code...</div>
            </div>
          ) : (
            <Editor
              height="100%"
              defaultLanguage="python"
              value={code}
              theme="vs-dark"
              onMount={handleEditorDidMount}
              onChange={(value) => setCode(value || "")}
              options={{
                minimap: { enabled: true },
                fontSize: 14,
                lineNumbers: "on",
                roundedSelection: false,
                scrollBeyondLastLine: false,
                readOnly: false,
                automaticLayout: true,
                wordWrap: "on",
                scrollbar: {
                  vertical: "visible",
                  horizontal: "visible",
                  verticalScrollbarSize: 10,
                  horizontalScrollbarSize: 10,
                },
                padding: {
                  top: 10,
                  bottom: 10,
                },
              }}
            />
          )}
        </div>
      </div>

      {/* Save Status Modal */}
      <SaveStatusModal
        isOpen={saveModalOpen}
        status={saveStatus}
        onClose={() => setSaveModalOpen(false)}
      />
    </div>
  );
};

export default IdeModal;
