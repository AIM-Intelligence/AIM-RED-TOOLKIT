import { useState, useEffect, useRef } from "react";
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
  const [dimensions, setDimensions] = useState({ width: 300, height: 200 });
  const [isResizing, setIsResizing] = useState(false);
  const nodeRef = useRef<HTMLDivElement>(null);
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
      if (preview.length > 500) {
        preview = preview.substring(0, 500) + "...";
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

  const handleResize = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);

    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = dimensions.width;
    const startHeight = dimensions.height;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.min(600, Math.max(200, startWidth + e.clientX - startX));
      const newHeight = Math.min(400, Math.max(150, startHeight + e.clientY - startY));
      
      setDimensions({ width: newWidth, height: newHeight });
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'nwse-resize';
  };

  return (
    <>
      <div
        ref={nodeRef}
        className={clsx(
          "bg-neutral-900 rounded-lg border border-neutral-600 relative",
          "select-none",
          hovering && !isResizing && "border-neutral-400",
          isResizing && "shadow-xl border-blue-500"
        )}
        style={{
          width: `${dimensions.width}px`,
          height: `${dimensions.height}px`,
        }}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
      >
        {/* Inner container with overflow control */}
        <div className="flex flex-col h-full overflow-hidden rounded-lg">
          {/* 삭제 버튼 */}
          {hovering && (
            <button
              onClick={handleDelete}
              className="absolute top-2 right-2 w-5 h-5 bg-red-500/80 text-white rounded flex items-center justify-center text-xs hover:bg-red-600 transition-colors z-10"
            >
              ✕
            </button>
          )}

          {/* Output display area - takes most of the space */}
          <div 
            className="flex-1 p-3 overflow-auto nowheel"
          tabIndex={0}
          onMouseDown={(e) => {
            e.stopPropagation();
            e.currentTarget.focus();
          }}
          onWheel={(e) => {
            e.stopPropagation();
          }}
        >
          {hasResult ? (
            <pre className="text-sm text-green-400 font-mono whitespace-pre-wrap break-all">
              {resultPreview}
            </pre>
          ) : (
            <div className="text-neutral-500 text-sm">
              No output yet. Run the flow to see results.
            </div>
          )}
        </div>

          {/* Download button - small and at the bottom */}
          {hasResult && (
            <div className="border-t border-neutral-700 p-2">
              <button
                className="text-xs px-2 py-1 bg-neutral-800 text-neutral-300 hover:bg-neutral-700 hover:text-white rounded transition-colors w-full"
                onClick={handleGetResult}
              >
                Download
              </button>
            </div>
          )}
        </div>

        {/* Resize handle */}
        <div
          onMouseDown={handleResize}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseEnter={(e) => {
            e.stopPropagation();
            document.body.style.cursor = 'nwse-resize';
          }}
          onMouseLeave={(e) => {
            e.stopPropagation();
            if (!isResizing) {
              document.body.style.cursor = '';
            }
          }}
          className="nodrag absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize group z-20"
          style={{ pointerEvents: 'auto' }}
        >
          <div className="absolute bottom-0 right-0 w-full h-full pointer-events-none">
            {/* Three dots pattern for better visibility */}
            <svg 
              className="w-full h-full" 
              viewBox="0 0 16 16"
              style={{ opacity: hovering || isResizing ? 1 : 0.5 }}
            >
              <circle cx="12" cy="12" r="1" fill="#737373"/>
              <circle cx="8" cy="12" r="1" fill="#737373"/>
              <circle cx="12" cy="8" r="1" fill="#737373"/>
            </svg>
          </div>
          {/* Invisible larger hit area */}
          <div className="absolute -top-1 -left-1 w-6 h-6 bg-transparent pointer-events-none" />
        </div>

        <Handle
          type="target"
          position={Position.Left}
          className="w-3 h-3 bg-gray-500 border-2 border-gray-400"
          style={{
            left: -6,
            top: '50%',
            transform: 'translateY(-50%)',
            background: '#6b7280',
            border: '2px solid #9ca3af',
          }}
        />
      </div>
    </>
  );
}
