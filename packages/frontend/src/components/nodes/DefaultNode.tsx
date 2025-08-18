import { useState, useCallback } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import clsx from "clsx";

export type DefaultNodeType = Node<{
  title: string;
  description: string;
  viewCode: () => void;
}>;

export default function DefaultNode(props: NodeProps<DefaultNodeType>) {
  const [outputNum, setOutputNum] = useState(1);
  const [inputNum, setInputNum] = useState(1);
  const [hovering, setHovering] = useState(false);

  const handleAddOutput = useCallback(() => {
    setOutputNum((prev) => prev + 1);
  }, []);

  const handleAddInput = useCallback(() => {
    setInputNum((prev) => prev + 1);
  }, []);

  const handleNodeClick = () => {
    // 노드 클릭 시 파일 이름 생성 (project-id-title.py)
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
        "bg-gray-900 rounded-lg border-2 border-gray-700 p-4 min-w-[200px] relative",
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

      {/* Output 추가 버튼 */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          handleAddOutput();
        }}
        className="absolute top-2 right-2 w-5 h-5 bg-red-950 text-white rounded flex items-center justify-center text-xs hover:bg-red-900 transition-colors"
        title="Add Output"
      >
        +
      </button>

      {/* Input 추가 버튼 */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          handleAddInput();
        }}
        className="absolute top-2 left-2 w-5 h-5 bg-red-950 text-white rounded flex items-center justify-center text-xs hover:bg-red-900 transition-colors"
        title="Add Input"
      >
        +
      </button>

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

      {/* Dynamic Input Handles */}
      {Array.from({ length: inputNum }, (_, index) => {
        const handleId = `input-${index}`;
        return (
          <Handle
            key={handleId}
            id={handleId}
            type="target"
            position={Position.Left}
            className="w-3 h-3 bg-blue-600 border-2 border-blue-400 hover:bg-blue-500"
            style={{
              left: -6,
              top: `${30 + index * 20}px`,
            }}
          />
        );
      })}

      {/* Dynamic Output Handles */}
      {Array.from({ length: outputNum }, (_, index) => {
        const handleId = `output-${index}`;
        return (
          <Handle
            key={handleId}
            id={handleId}
            type="source"
            position={Position.Right}
            className="w-3 h-3 bg-green-600 border-2 border-green-400 hover:bg-green-500"
            style={{
              right: -6,
              top: `${30 + index * 20}px`,
            }}
          />
        );
      })}
    </div>
  );
}
