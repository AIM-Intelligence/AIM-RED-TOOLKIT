import { useMemo, useEffect, type ReactNode } from "react";
import {
  ReactFlow,
  MiniMap,
  Background,
  BackgroundVariant,
  Panel,
  ReactFlowProvider,
  useReactFlow,
  type NodeTypes,
  type EdgeTypes,
  type Edge,
  type Connection,
  type OnNodesChange,
  type OnEdgesChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { DefaultNodeType } from "../../../components/nodes/DefaultNode";
import type { StartNodeType } from "../../../components/nodes/StartNode";
import type { ResultNodeType } from "../../../components/nodes/ResultNode";
import DefaultNode from "../../../components/nodes/DefaultNode";
import StartNode from "../../../components/nodes/StartNode";
import ResultNode from "../../../components/nodes/ResultNode";
import DefaultEdge from "../../../components/edges/DefaultEdge";

// Union type for all node types
type AnyNodeType = DefaultNodeType | StartNodeType | ResultNodeType;

interface ProjectFlowProps {
  nodes: AnyNodeType[];
  edges: Edge[];
  onNodesChange: OnNodesChange<AnyNodeType>;
  onEdgesChange: OnEdgesChange<Edge>;
  onConnect: (connection: Connection) => void;
  isValidConnection: (connection: Edge | Connection) => boolean;
  children?: ReactNode;
}

// Inner component that has access to React Flow context
function ProjectFlowInner({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  isValidConnection,
  children,
}: ProjectFlowProps) {
  const { updateNodeInternals } = useReactFlow();
  
  // Listen for custom event to update node internals
  useEffect(() => {
    const handleForceUpdate = (event: CustomEvent) => {
      const { nodeId } = event.detail;
      console.log(`Updating node internals for ${nodeId} from ProjectFlow`);
      
      // 여러 시점에 업데이트하여 확실히 적용
      updateNodeInternals(nodeId);
      
      // DOM 렌더링 후 추가 업데이트
      requestAnimationFrame(() => {
        updateNodeInternals(nodeId);
      });
      
      // 추가 지연 후 한 번 더 업데이트
      setTimeout(() => {
        updateNodeInternals(nodeId);
      }, 100);
      
      setTimeout(() => {
        updateNodeInternals(nodeId);
      }, 300);
    };
    
    window.addEventListener('forceUpdateNodeInternals' as any, handleForceUpdate);
    return () => {
      window.removeEventListener('forceUpdateNodeInternals' as any, handleForceUpdate);
    };
  }, [updateNodeInternals]);

  // Define node types
  const nodeTypes = useMemo<NodeTypes>(
    () => ({
      custom: DefaultNode,
      start: StartNode,
      result: ResultNode,
    }),
    []
  );

  // Define edge types
  const edgeTypes = useMemo<EdgeTypes>(
    () => ({
      custom: DefaultEdge,
    }),
    []
  );

  // MiniMap node color function
  const nodeColor = () => {
    return "#1e293b";
  };

  return (
    <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        isValidConnection={isValidConnection}
        fitView
        attributionPosition="bottom-left"
        defaultEdgeOptions={{
          type: "custom",
        }}
        style={{ backgroundColor: "transparent" }}
        className="react-flow-transparent"
        deleteKeyCode={null} // Disable delete key
      >
        <Background
          variant={BackgroundVariant.Cross}
          gap={20}
          size={1}
          color="#374151"
          bgColor="#000000"
        />

        <MiniMap
          nodeColor={nodeColor}
          nodeStrokeColor="#374151"
          nodeStrokeWidth={2}
          className="bg-neutral-900 border-2 border-neutral-700"
          maskColor="rgba(0, 0, 0, 0.5)"
          pannable
          zoomable
        />

        {children && (
          <Panel
            position="top-left"
            className="bg-neutral-800 p-4 rounded-lg border border-neutral-700"
          >
            {children}
          </Panel>
        )}
      </ReactFlow>
  );
}

// Main component that wraps everything in ReactFlowProvider
export default function ProjectFlow(props: ProjectFlowProps) {
  return (
    <div
      style={{ width: "100vw", height: "100vh", backgroundColor: "#0a0a0a" }}
    >
      <ReactFlowProvider>
        <ProjectFlowInner {...props} />
      </ReactFlowProvider>
    </div>
  );
}
