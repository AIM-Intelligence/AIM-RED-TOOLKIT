import { useState, useEffect } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import clsx from "clsx";
import { useExecutionStore } from "../../stores/executionStore";

export type ResultNodeType = Node<{
  title: string;
  description: string;
  projectTitle?: string;
}>;

export default function ResultNode(props: NodeProps<ResultNodeType>) {
  const [hovering, setHovering] = useState(false);
  const [hasResult, setHasResult] = useState(false);
  const [resultPreview, setResultPreview] = useState<string>("");
  const getNodeResult = useExecutionStore((state) => state.getNodeResult);
  const runId = useExecutionStore((state) => state.runId);
  const executionResults = useExecutionStore((state) => state.executionResults);

  // Update result preview when execution results change
  useEffect(() => {
    const result = getNodeResult(props.id);
    if (result !== null && result !== undefined) {
      // The result is now the actual value directly from the previous node
      const displayValue = result;

      // Format result for preview
      let preview = "";
      if (typeof displayValue === "object" && displayValue !== null) {
        preview = JSON.stringify(displayValue, null, 2);
      } else {
        preview = String(displayValue);
      }
      // Limit preview length
      if (preview.length > 100) {
        preview = preview.substring(0, 100) + "...";
      }
      setResultPreview(preview);
      setHasResult(true);
    } else {
      setResultPreview("");
      setHasResult(false);
    }
  }, [executionResults, props.id, getNodeResult]);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    // 부모 컴포넌트에서 처리하도록 이벤트 전달
    const deleteEvent = new CustomEvent("deleteNode", {
      detail: { id: props.id },
      bubbles: true,
    });
    e.currentTarget.dispatchEvent(deleteEvent);
  };

  const handleGetResult = (e: React.MouseEvent) => {
    e.stopPropagation();

    // Get the result for this node
    const result = getNodeResult(props.id);

    if (result === null || result === undefined) {
      alert("No execution result available. Please run the flow first.");
      return;
    }

    // Create JSON content with metadata
    const resultData = {
      node_id: props.id,
      node_title: props.data.title,
      project_title: props.data.projectTitle,
      run_id: runId,
      timestamp: new Date().toISOString(),
      result: result, // This is now the actual return value from the previous node
    };

    // Create and download JSON file
    const blob = new Blob([JSON.stringify(resultData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `result_${props.id}_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setHasResult(true);
  };

  return (
    <>
      <div
        className={clsx(
          "bg-black rounded-lg border-2 border-neutral-500 p-4 min-w-[200px] relative flex flex-col items-center justify-center",
          hovering && "border-red-400 shadow-lg"
        )}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
      >
        {/* 삭제 버튼 */}
        {hovering && (
          <button
            onClick={handleDelete}
            className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600 transition-colors z-10"
          >
            ✕
          </button>
        )}

        <div className="w-full flex flex-col items-center justify-center">
          <h3 className="text-white font-semibold text-sm mb-2">Result</h3>

          {/* Result preview */}
          {hasResult && (
            <div className="mb-2">
              <div className="text-xs text-neutral-400 mb-1">Output:</div>
              <div className="bg-neutral-900 rounded p-2 max-w-[250px] max-h-[100px] overflow-auto">
                <pre className="text-xs text-green-400 whitespace-pre-wrap break-all">
                  {resultPreview}
                </pre>
              </div>
            </div>
          )}

          {/* Get Result button */}
          <button
            className={clsx(
              "text-xs px-2 py-1 rounded transition-colors w-full",
              hasResult
                ? "bg-green-800 text-white hover:bg-green-700"
                : "bg-neutral-600 text-neutral-400 cursor-not-allowed"
            )}
            onClick={handleGetResult}
            disabled={!hasResult}
          >
            {hasResult ? "Download Result" : "No Result Yet"}
          </button>
        </div>

        <Handle
          type="target"
          position={Position.Left}
          className="w-3 h-3"
          style={{
            left: -6,
            top: `${30}px`,
          }}
        />
      </div>
    </>
  );
}
