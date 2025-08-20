import { useState } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import clsx from "clsx";

export interface SimpleAddData {
  title: string;
  description: string;
  viewCode?: () => void;
}

export type SimpleAddNodeType = Node<SimpleAddData>;

export default function SimpleAddNode(props: NodeProps<SimpleAddNodeType>) {
  const [hovering, setHovering] = useState(false);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    const deleteEvent = new CustomEvent("deleteNode", {
      detail: { id: props.id },
      bubbles: true,
    });
    e.currentTarget.dispatchEvent(deleteEvent);
  };

  return (
    <div
      className={clsx(
        "bg-gradient-to-br from-green-900 to-green-700 rounded-lg border-2 border-green-500 p-3 min-w-[180px] relative transition-all",
        hovering && "border-green-400 shadow-lg shadow-green-500/30"
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

      {/* Add icon */}
      <div className="absolute top-2 right-2 text-green-300">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
        </svg>
      </div>

      <div className="px-1">
        <h3 className="text-white font-semibold text-sm mb-1">
          {props.data.title || "Add"}
        </h3>
        <p className="text-green-200 text-xs mb-2">
          {props.data.description || "Adds two values: a + b"}
        </p>
        
        {/* Operation display */}
        <div className="bg-green-950/50 rounded p-2 text-center">
          <div className="text-white text-lg font-mono">
            a + b
          </div>
        </div>
      </div>

      {/* Named input handles */}
      <div className="absolute left-0 top-[35%] -translate-x-2">
        <Handle
          type="target"
          position={Position.Left}
          id="a"
          className="w-3 h-3 bg-green-400"
        />
        <span className="absolute -left-8 top-1/2 -translate-y-1/2 text-green-300 text-xs font-mono">
          a
        </span>
      </div>
      
      <div className="absolute left-0 top-[65%] -translate-x-2">
        <Handle
          type="target"
          position={Position.Left}
          id="b"
          className="w-3 h-3 bg-green-400"
        />
        <span className="absolute -left-8 top-1/2 -translate-y-1/2 text-green-300 text-xs font-mono">
          b
        </span>
      </div>

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-green-400"
        style={{
          right: -6,
          top: "50%",
          transform: "translateY(-50%)",
        }}
      />
    </div>
  );
}