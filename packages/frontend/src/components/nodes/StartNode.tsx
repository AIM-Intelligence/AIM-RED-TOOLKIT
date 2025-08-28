import { useState } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import clsx from "clsx";
import { useExecutionStore } from "../../stores/executionStore";
import { useParams } from "react-router-dom";
import { projectApi } from "../../utils/api";
import LoadingModal from "../modal/LoadingModal";
import type { ExecuteFlowResponse } from "../../types/interface";

export type StartNodeType = Node<{
  title: string;
  description: string;
  file?: string; // File path reference for the node's Python code
}>;

export default function StartNode(props: NodeProps<StartNodeType>) {
  const [hovering, setHovering] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    status: "loading" | "success" | "error";
    message: string;
    errorDetails?: string;
  }>({
    isOpen: false,
    status: "loading",
    message: "",
    errorDetails: undefined,
  });
  const { projectId } = useParams<{ projectId: string }>();
  const setExecuting = useExecutionStore((state) => state.setExecuting);
  const setExecutionResults = useExecutionStore(
    (state) => state.setExecutionResults
  );
  const setToastMessage = useExecutionStore((state) => state.setToastMessage);
  const resultNodes = useExecutionStore((state) => state.resultNodes);

  const handleRunFlow = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (!projectId) {
      setModalState({
        isOpen: true,
        status: "error",
        message: "Project ID not found",
        errorDetails:
          "Unable to identify the current project. Please refresh the page and try again.",
      });
      return;
    }

    setIsRunning(true);
    setExecuting(true);
    setModalState({
      isOpen: true,
      status: "loading",
      message: "Executing flow...",
      errorDetails: undefined,
    });

    try {
      const result = await projectApi.executeFlow({
        project_id: projectId,
        start_node_id: props.id,
        params: {},
        result_node_values: resultNodes,
        max_workers: 4,
        timeout_sec: 30,
        halt_on_error: true,
      });

      if (result.success) {
        setExecutionResults({
          execution_results: result.execution_results || {},
          result_nodes: result.result_nodes || {},
          execution_order: result.execution_order || [],
          total_execution_time_ms: result.total_execution_time_ms || 0,
          run_id: result.run_id || `run-${Date.now()}`,
        });

        const nodeCount = result.execution_order?.length || 0;
        const timeMs = result.total_execution_time_ms || 0;

        // 성공 시 모달 닫고 Toast 표시
        setModalState({
          isOpen: false,
          status: "success",
          message: "",
          errorDetails: undefined,
        });
        
        // Toast 메시지 표시
        setToastMessage(`✅ Flow executed successfully! (${nodeCount} nodes in ${timeMs}ms)`);
        setTimeout(() => setToastMessage(null), 3000); // 3초 후 자동으로 사라짐
        
        console.log(`Flow executed successfully! (${nodeCount} nodes in ${timeMs}ms)`);

        console.log("Flow execution completed:", result);
      } else {
        // Collect error details from execution results
        type ExecutionResult = ExecuteFlowResponse["execution_results"][string];
        const failedNodes = Object.entries(result.execution_results || {})
          .filter(
            ([, res]: [string, ExecutionResult]) => res.status === "error"
          )
          .map(([nodeId, res]: [string, ExecutionResult]) => {
            return `Node ${nodeId}:\n${res.error || "Unknown error"}${
              res.logs ? "\n\nLogs:\n" + res.logs : ""
            }`;
          })
          .join("\n\n---\n\n");

        setModalState({
          isOpen: true,
          status: "error",
          message: "Flow execution failed",
          errorDetails: failedNodes || "No error details available",
        });

        console.error("Flow execution error:", result);
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      const errorStack = error instanceof Error ? error.stack : "";

      setModalState({
        isOpen: true,
        status: "error",
        message: "Failed to execute flow",
        errorDetails: `Error: ${errorMessage}${
          errorStack ? "\n\nStack trace:\n" + errorStack : ""
        }`,
      });

      console.error("Flow execution error:", error);
    } finally {
      setIsRunning(false);
      setExecuting(false);
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
      
      {/* Error modal only */}
      <LoadingModal
        isOpen={modalState.isOpen}
        status={modalState.status}
        position="top" // 상단 중앙에 표시
        onClose={() => setModalState({ ...modalState, isOpen: false })}
        notice={{
          loading: modalState.message,
          success: modalState.message,
          error: modalState.message,
          errorDetails: modalState.errorDetails,
        }}
      />
      <div
        className={clsx(
          "bg-black rounded-lg border-2 border-neutral-500 p-4 min-w-[100px] relative flex flex-col items-center justify-center",
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
          <h3 className="text-white font-semibold text-sm mb-2">Start</h3>
          <button
            className={clsx(
              "text-xs text-white px-2 py-1 rounded transition-colors",
              isRunning
                ? "bg-neutral-600 cursor-not-allowed"
                : "bg-red-800 hover:bg-red-700"
            )}
            onClick={handleRunFlow}
            disabled={isRunning}
          >
            {isRunning ? "Running..." : "⏵ Run Flow"}
          </button>
        </div>

        <Handle
          type="source"
          position={Position.Right}
          className="w-3 h-3"
          style={{
            right: -11.5,
            top: '50%',
            transform: 'translateY(-50%)',
          }}
        />
      </div>
    </>
  );
}
