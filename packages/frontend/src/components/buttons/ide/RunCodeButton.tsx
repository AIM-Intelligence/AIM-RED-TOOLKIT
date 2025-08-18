import type { editor } from "monaco-editor";
import { useRef } from "react";

export default function RunCodeButton() {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  const handleRunCode = () => {
    if (editorRef.current) {
      const code = editorRef.current.getValue();
      console.log("Running code:", code);
      // TODO: Implement actual code execution via API
    }
  };

  return (
    <button
      onClick={handleRunCode}
      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200 flex items-center gap-2"
      aria-label="Run code"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M8 5v14l11-7z" />
      </svg>
      Run
    </button>
  );
}
