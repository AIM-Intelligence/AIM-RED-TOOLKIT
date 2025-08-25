import { useState } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import clsx from "clsx";
import LoadingModal from "../modal/LoadingModal";
import type { NodeData } from "../../types";

export type DefaultNodeType = Node<NodeData>;

export default function DefaultNode(props: NodeProps<DefaultNodeType>) {
  const [hovering, setHovering] = useState(false);
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    status: "loading" | "success" | "error";
    message: string;
    resultData?: unknown;
  }>({
    isOpen: false,
    status: "loading",
    message: "",
    resultData: undefined,
  });

  const handleNodeClick = () => {
    //(nodeid-nodetitle.py)
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
    <>
      <LoadingModal
        isOpen={modalState.isOpen}
        status={modalState.status}
        onClose={() => setModalState({ ...modalState, isOpen: false })}
        notice={{
          loading: modalState.message,
          success:
            modalState.status === "success"
              ? `${modalState.message}\n\nOutput:\n${modalState.resultData}`
              : modalState.message,
          error: modalState.message,
          errorDetails:
            modalState.status === "error" && modalState.resultData
              ? String(modalState.resultData)
              : undefined,
        }}
      />
      <div
        className={clsx(
          "bg-black rounded-lg border-2 border-neutral-500 p-4 min-w-[200px] relative",
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
          <h3 className="text-white font-semibold text-sm mb-1">
            {props.data.title || "Node Title"}
          </h3>
          <p className="text-neutral-400 text-xs mb-2">
            {props.data.description || "Node description"}
          </p>
          <button
            className="text-xs bg-red-800 text-white px-2 py-1 rounded hover:bg-red-900 transition-colors hover:cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              handleNodeClick();
            }}
          >
            View Code
          </button>
        </div>

        {/* Input Handles */}
        {props.data.inputs && props.data.inputs.length > 0 ? (
          props.data.inputs.map((input, index) => {
            const totalInputs = props.data.inputs!.length;
            const spacing = 100 / (totalInputs + 1);
            const topPosition = spacing * (index + 1);
            
            return (
              <div key={`input-${input.id}`}>
                <Handle
                  type="target"
                  position={Position.Left}
                  id={input.id}
                  className="w-3 h-3"
                  style={{
                    left: -6,
                    top: `${topPosition}%`,
                  }}
                  title={`${input.label} (${input.type})${input.required ? ' *' : ''}`}
                />
                {hovering && (
                  <div
                    className="absolute text-xs text-neutral-400 pointer-events-none"
                    style={{
                      left: 8,
                      top: `${topPosition}%`,
                      transform: 'translateY(-50%)',
                    }}
                  >
                    {input.label}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          // Fallback to single input handle
          <Handle
            type="target"
            position={Position.Left}
            className="w-3 h-3"
            style={{
              left: -6,
              top: `50%`,
            }}
          />
        )}

        {/* Output Handles */}
        {props.data.outputs && props.data.outputs.length > 0 ? (
          props.data.outputs.map((output, index) => {
            const totalOutputs = props.data.outputs!.length;
            const spacing = 100 / (totalOutputs + 1);
            const topPosition = spacing * (index + 1);
            
            return (
              <div key={`output-${output.id}`}>
                <Handle
                  type="source"
                  position={Position.Right}
                  id={output.id}
                  className="w-3 h-3"
                  style={{
                    right: -6,
                    top: `${topPosition}%`,
                  }}
                  title={`${output.label} (${output.type})`}
                />
                {hovering && (
                  <div
                    className="absolute text-xs text-neutral-400 pointer-events-none"
                    style={{
                      right: 8,
                      top: `${topPosition}%`,
                      transform: 'translateY(-50%)',
                    }}
                  >
                    {output.label}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          // Fallback to single output handle
          <Handle
            type="source"
            position={Position.Right}
            className="w-3 h-3"
            style={{
              right: -6,
              top: `50%`,
            }}
          />
        )}
      </div>
    </>
  );
}
