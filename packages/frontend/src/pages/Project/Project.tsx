import { useState, useCallback, useMemo, useEffect } from "react";
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  addEdge,
  Panel,
  type Connection,
  type Edge,
  type NodeTypes,
  type EdgeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { DefaultNodeType } from "../../components/nodes/DefaultNode";
import DefaultNode from "../../components/nodes/DefaultNode";
import DefaultEdge from "../../components/edges/DefaultEdge";
import IdeModal from "../../components/modal/Ide";

export default function Project() {
  const [isIdeModalOpen, setIsIdeModalOpen] = useState(false);
  const [selectedNodeData, setSelectedNodeData] = useState<{
    title: string;
    code: string;
  }>({
    title: "Python IDE",
    code: "# Write your Python code here\nprint('Hello, World!')",
  });

  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      .react-flow__renderer {
        background-color: transparent !important;
      }
      .react-flow__background {
        background-color: transparent !important;
      }
      .react-flow__pane {
        background-color: transparent !important;
      }
      .react-flow-transparent {
        background-color: transparent !important;
      }
      .react-flow-transparent .react-flow__renderer {
        background-color: transparent !important;
      }
      /* 노드 선택 시 핑크색 테두리 완전 제거 */
      .react-flow__node.selected {
        box-shadow: none !important;
      }
      .react-flow__node-default {
        background: transparent !important;
        border: none !important;
      }
      /* 노드 선택 시 발생하는 모든 시각적 효과 제거 */
      .react-flow__node.selected .react-flow__handle {
        background: #555 !important;
        border-color: #555 !important;
      }
      .react-flow__node:focus {
        outline: none !important;
      }
      .react-flow__node:focus-visible {
        outline: none !important;
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  const handleNodeClick = (title: string) => {
    setSelectedNodeData({
      title,
      code: "# Write your Python code here\nprint('Hello, World!')",
    });
    setIsIdeModalOpen(true);
  };

  const initialNodes: DefaultNodeType[] = [
    {
      id: "1",
      type: "default",
      position: { x: 100, y: 100 },
      data: {
        title: "Data Input",
        description: "Load dataset from CSV",
        viewCode: () => handleNodeClick("Data Input"),
      },
    },
    {
      id: "2",
      type: "default",
      position: { x: 400, y: 100 },
      data: {
        title: "Preprocessing",
        description: "Clean and normalize data",
        viewCode: () => handleNodeClick("Preprocessing"),
      },
    },
    {
      id: "3",
      type: "default",
      position: { x: 700, y: 100 },
      data: {
        title: "Model Training",
        description: "Train ML model",
        viewCode: () => handleNodeClick("Model Training"),
      },
    },
  ];

  // 초기 엣지 설정 - type: "custom" 추가
  const initialEdges: Edge[] = [
    {
      id: "e1-2",
      source: "1",
      target: "2",
      sourceHandle: "output-0",
      targetHandle: "input-0",
      type: "custom",
      style: { stroke: "#64748b", strokeWidth: 2 },
    },
    {
      id: "e2-3",
      source: "2",
      target: "3",
      sourceHandle: "output-0",
      targetHandle: "input-0",
      type: "custom",
      style: { stroke: "#64748b", strokeWidth: 2 },
    },
  ];

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [nodeIdCounter, setNodeIdCounter] = useState(4);

  // 노드 타입 정의
  const nodeTypes = useMemo<NodeTypes>(
    () => ({
      default: DefaultNode,
    }),
    []
  );

  // Edge 타입 정의 - 추가
  const edgeTypes = useMemo<EdgeTypes>(
    () => ({
      custom: DefaultEdge,
    }),
    []
  );

  // 연결 유효성 검사 함수
  const isValidConnection = useCallback((connection: Edge | Connection) => {
    const source = "source" in connection ? connection.source : null;
    const target = "target" in connection ? connection.target : null;

    // 자기 자신으로의 연결 방지
    if (source && target && source === target) {
      return false;
    }

    return true;
  }, []);

  // 연결 생성 핸들러
  const onConnect = useCallback(
    (connection: Connection) => {
      // 중복 연결 검사
      const isDuplicate = edges.some(
        (edge) =>
          edge.source === connection.source &&
          edge.target === connection.target &&
          edge.sourceHandle === connection.sourceHandle &&
          edge.targetHandle === connection.targetHandle
      );

      if (isDuplicate) {
        console.log("Duplicate connection prevented");
        return;
      }

      // addEdge 함수 사용 - type: "custom" 추가
      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            id: `e${connection.source}-${connection.target}-${Date.now()}`,
            type: "custom",
            style: { stroke: "#64748b", strokeWidth: 2 },
          },
          eds
        )
      );
    },
    [edges, setEdges]
  );

  // 새 노드 추가
  const addNewNode = useCallback(() => {
    const nodeId = nodeIdCounter.toString();
    const newNode: DefaultNodeType = {
      id: nodeId,
      type: "default",
      position: {
        x: Math.random() * 500 + 100,
        y: Math.random() * 300 + 100,
      },
      data: {
        title: `Node ${nodeIdCounter}`,
        description: "New node description",
        viewCode: () => handleNodeClick(`Node ${nodeIdCounter}`),
      },
    };
    setNodes((nds) => [...nds, newNode]);
    setNodeIdCounter((id) => id + 1);
  }, [nodeIdCounter, setNodes]);

  // 노드 삭제 핸들러
  useEffect(() => {
    const handleDeleteNode = (event: CustomEvent) => {
      const nodeId = event.detail.id;
      setNodes((nds) => nds.filter((node) => node.id !== nodeId));
      setEdges((eds) =>
        eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId)
      );
    };

    document.addEventListener("deleteNode", handleDeleteNode as EventListener);
    return () => {
      document.removeEventListener(
        "deleteNode",
        handleDeleteNode as EventListener
      );
    };
  }, [setNodes, setEdges]);

  // Edge 삭제 핸들러 - 추가
  useEffect(() => {
    const handleDeleteEdge = (event: CustomEvent) => {
      const edgeId = event.detail.id;
      setEdges((eds) => eds.filter((edge) => edge.id !== edgeId));
    };

    document.addEventListener("deleteEdge", handleDeleteEdge as EventListener);
    return () => {
      document.removeEventListener(
        "deleteEdge",
        handleDeleteEdge as EventListener
      );
    };
  }, [setEdges]);

  // MiniMap 노드 색상 함수
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
        deleteKeyCode={null} // Delete 키로 삭제 비활성화
      >
        {/* 배경 패턴 */}
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="#374151"
        />

        {/* 컨트롤 (줌 인/아웃) */}
        <Controls
          className="bg-gray-800 border-gray-700"
          showInteractive={false}
        />

        {/* 미니맵 */}
        <MiniMap
          nodeColor={nodeColor}
          nodeStrokeColor="#374151"
          nodeStrokeWidth={2}
          className="bg-gray-900 border-2 border-gray-700"
          maskColor="rgba(0, 0, 0, 0.5)"
          pannable
          zoomable
        />

        {/* 상단 패널 - 노드 추가 버튼 */}
        <Panel
          position="top-left"
          className="bg-gray-800 p-4 rounded-lg border border-gray-700"
        >
          <div className="flex gap-3 items-center">
            <button
              onClick={addNewNode}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              + Add Node
            </button>
            <div className="text-gray-400 text-sm">
              Nodes: {nodes.length} | Edges: {edges.length}
            </div>
          </div>
        </Panel>
      </ReactFlow>

      {/* IDE Modal */}
      <IdeModal
        isOpen={isIdeModalOpen}
        onClose={() => setIsIdeModalOpen(false)}
        nodeTitle={selectedNodeData.title}
        initialCode={selectedNodeData.code}
      />
    </div>
  );
}
