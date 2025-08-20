import { useState } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import clsx from "clsx";

export interface CustomCalculatorData {
  title: string;
  description: string;
  operation: "add" | "multiply" | "subtract" | "divide";
  result?: number;
  viewCode?: () => void;
}

export type CustomCalculatorNodeType = Node<CustomCalculatorData>;

export default function CustomCalculatorNode(props: NodeProps<CustomCalculatorNodeType>) {
  const [hovering, setHovering] = useState(false);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    const deleteEvent = new CustomEvent("deleteNode", {
      detail: { id: props.id },
      bubbles: true,
    });
    e.currentTarget.dispatchEvent(deleteEvent);
  };

  const getOperationSymbol = () => {
    switch (props.data.operation) {
      case "add": return "+";
      case "subtract": return "-";
      case "multiply": return "×";
      case "divide": return "÷";
      default: return "+";
    }
  };

  return (
    <div
      className={clsx(
        "bg-gradient-to-br from-blue-900 to-blue-700 rounded-lg border-2 border-blue-500 p-3 min-w-[200px] relative transition-all",
        hovering && "border-blue-400 shadow-lg shadow-blue-500/30"
      )}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onDoubleClick={() => props.data.viewCode?.()}
    >
      {/* Delete button */}
      {hovering && (
        <button
          onClick={handleDelete}
          className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600 transition-colors z-10"
        >
          ✕
        </button>
      )}

      {/* Calculator icon */}
      <div className="absolute top-2 right-2 text-blue-300">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M7 2C5.9 2 5 2.9 5 4v16c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2H7zm0 2h10v16H7V4zm1 1v2h2V5H8zm3 0v2h2V5h-2zm3 0v2h2V5h-2zM8 8v2h2V8H8zm3 0v2h2V8h-2zm3 0v2h2V8h-2zM8 11v2h2v-2H8zm3 0v2h2v-2h-2zm3 0v2h2v-2h-2zM8 14v4h2v-4H8zm3 0v2h2v-2h-2zm3 0v2h2v-2h-2zm-3 3v1h5v-1h-5z"/>
        </svg>
      </div>

      <div className="px-1">
        <h3 className="text-white font-semibold text-sm mb-1">
          {props.data.title || "Calculator"}
        </h3>
        <p className="text-blue-200 text-xs mb-2">
          {props.data.description || "Performs calculation on inputs"}
        </p>
        
        {/* Operation display */}
        <div className="bg-blue-950/50 rounded p-2 mb-2">
          <div className="text-center">
            <span className="text-blue-300 text-xs">Operation</span>
            <div className="text-white text-xl font-bold">
              {getOperationSymbol()}
            </div>
          </div>
        </div>

        {/* Result display */}
        {props.data.result !== undefined && (
          <div className="bg-blue-950/50 rounded p-2">
            <div className="text-center">
              <span className="text-blue-300 text-xs">Result</span>
              <div className="text-white text-lg font-mono">
                {props.data.result.toFixed(2)}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input handles */}
      <Handle
        type="target"
        position={Position.Left}
        id="input1"
        className="w-3 h-3 bg-blue-400"
        style={{
          left: -6,
          top: "40%",
          transform: "translateY(-50%)",
        }}
      />
      
      <Handle
        type="target"
        position={Position.Left}
        id="input2"
        className="w-3 h-3 bg-blue-400"
        style={{
          left: -6,
          top: "60%",
          transform: "translateY(-50%)",
        }}
      />

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-blue-400"
        style={{
          right: -6,
          top: "50%",
          transform: "translateY(-50%)",
        }}
      />
    </div>
  );
}