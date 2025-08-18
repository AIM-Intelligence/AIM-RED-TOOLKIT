import type { editor } from "monaco-editor";
import { useRef } from "react";
import type { ExportButtonProps } from "../props";

export default function ExportCodeButton({ nodeTitle }: ExportButtonProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  const handleExportCode = () => {
    if (editorRef.current) {
      const code = editorRef.current.getValue();
      const blob = new Blob([code], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${nodeTitle.replace(/\s+/g, "_")}.py`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  return (
    <button
      onClick={handleExportCode}
      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center gap-2"
      aria-label="Export code"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
      Export
    </button>
  );
}
