import React, { useRef, useEffect, useState } from "react";
import Editor from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import RunCodeButton from "../buttons/ide/RunCodeButton";
import ExportCodeButton from "../buttons/ide/ExportCodeButton";
import SaveStatusModal from "./SaveStatusModal";

interface IdeModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectHash: string;
  projectTitle: string;
  nodeId: string;
  nodeTitle?: string;
  initialCode?: string;
}

const IdeModal: React.FC<IdeModalProps> = ({
  isOpen,
  onClose,
  projectHash,
  projectTitle,
  nodeId,
  nodeTitle = "Python IDE",
  initialCode = "# Write your Python code here\nprint('Hello, World!')",
}) => {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"loading" | "success" | "error">("loading");

  const handleSave = async () => {
    if (!editorRef.current) return;
    
    setSaveModalOpen(true);
    setSaveStatus("loading");
    const code = editorRef.current.getValue();
    
    try {
      const response = await fetch("http://localhost:8000/api/save-code", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          project_hash: projectHash,
          project_title: projectTitle,
          node_id: nodeId,
          node_title: nodeTitle,
          code: code,
        }),
      });
      
      if (response.ok) {
        setSaveStatus("success");
      } else {
        setSaveStatus("error");
      }
    } catch (error) {
      console.error("Error saving code:", error);
      setSaveStatus("error");
    }
  };

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
              className="px-4 py-2 rounded-lg font-medium transition-all bg-blue-600 text-white hover:bg-blue-700"
            >
              Save
            </button>
            <RunCodeButton />
            <ExportCodeButton nodeTitle="" />
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
          <Editor
            height="100%"
            defaultLanguage="python"
            defaultValue={initialCode}
            theme="vs-dark"
            onMount={handleEditorDidMount}
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
