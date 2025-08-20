import type { editor } from "monaco-editor";

export interface ExportButtonProps {
  nodeId: string;
  nodeTitle: string;
  editorRef?: React.RefObject<editor.IStandaloneCodeEditor | null>;
}
