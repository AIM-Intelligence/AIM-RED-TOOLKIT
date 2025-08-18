import React, { useRef, useEffect } from "react";
import Editor from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import RunCodeButton from "../buttons/ide/RunCodeButton";
import ExportCodeButton from "../buttons/ide/ExportCodeButton";

interface IdeModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodeTitle?: string;
  initialCode?: string;
}

const IdeModal: React.FC<IdeModalProps> = ({
  isOpen,
  onClose,
  nodeTitle = "Python IDE",
  initialCode = "# Write your Python code here\nprint('Hello, World!')",
}) => {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

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
      className="fixed inset-0 flex items-center justify-center z-[9999] backdrop-blur-lg bg-black/50 animate-fadeIn"
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
    </div>
  );
};

export default IdeModal;
