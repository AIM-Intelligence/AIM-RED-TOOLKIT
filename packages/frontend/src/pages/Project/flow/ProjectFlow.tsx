import { useMemo, type ReactNode } from "react";
import {
  ReactFlow,
  MiniMap,
  Background,
  BackgroundVariant,
  Panel,
  type NodeTypes,
  type EdgeTypes,
  type Edge,
  type Connection,
  type OnNodesChange,
  type OnEdgesChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { DefaultNodeType } from "../../../components/nodes/DefaultNode";
import DefaultNode from "../../../components/nodes/DefaultNode";
import DefaultEdge from "../../../components/edges/DefaultEdge";

interface ProjectFlowProps {
  nodes: DefaultNodeType[];
  edges: Edge[];
  onNodesChange: OnNodesChange<DefaultNodeType>;
  onEdgesChange: OnEdgesChange<Edge>;
  onConnect: (connection: Connection) => void;
  isValidConnection: (connection: Edge | Connection) => boolean;
  children?: ReactNode;
}

export default function ProjectFlow({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  isValidConnection,
  children,
}: ProjectFlowProps) {
  // Define node types
  const nodeTypes = useMemo<NodeTypes>(
    () => ({
      default: DefaultNode,
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
    <div
      style={{ width: "100vw", height: "100vh", backgroundColor: "#0a0a0a" }}
    >
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
    </div>
  );
}
