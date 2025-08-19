import { useState } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import clsx from "clsx";

export type DefaultNodeType = Node<{
  title: string;
  description: string;
  viewCode: () => void;
}>;

export default function DefaultNode(props: NodeProps<DefaultNodeType>) {
  const [hovering, setHovering] = useState(false);

  const handleNodeClick = () => {
    // 노드 클릭 시 파일 이름 생성 (nodeid-nodetitle.py)
    const fileName = `${props.id}-${props.data.title.replace(/\s+/g, "-")}.py`;
    console.log("Generated file name:", fileName);

    if (props.data.viewCode) {
      props.data.viewCode();
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    // 부모 컴포넌트에서 처리하도록 이벤트 전달
    const deleteEvent = new CustomEvent("deleteNode", {
      detail: { id: props.id },
      bubbles: true,
    });
    e.currentTarget.dispatchEvent(deleteEvent);
  };

  return (
    <div
      className={clsx(
        "bg-black rounded-lg border-2 border-gray-500 p-4 min-w-[200px] relative",
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

      <div className="px-8">
        <h3 className="text-white font-semibold text-sm mb-1">
          {props.data.title || "Node Title"}
        </h3>
        <p className="text-gray-400 text-xs mb-2">
          {props.data.description || "Node description"}
        </p>
        <button
          className="text-xs bg-red-800 text-white px-2 py-1 rounded hover:bg-red-700 transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            handleNodeClick();
          }}
        >
          View Code
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

      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3"
        style={{
          right: -6,
          top: `${30}px`,
        }}
      />
    </div>
  );
}
