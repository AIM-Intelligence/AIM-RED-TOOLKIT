import { useState, useCallback, useMemo, useEffect } from "react";
import { useParams } from "react-router-dom";
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
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { DefaultNodeType } from "../../components/nodes/DefaultNode";
import DefaultNode from "../../components/nodes/DefaultNode";
import DefaultEdge from "../../components/edges/DefaultEdge";
import IdeModal from "../../components/modal/Ide";
import { removeStyle } from "./removeStyle";
import Loading from "../../components/loading/Loading";
import WrongPath from "../WrongPath/WrongPath";

// Backend API response types
interface BackendNodeData {
  title: string;
  description?: string;
  file?: string;
}

interface BackendNode {
  id: string;
  type?: string;
  position: { x: number; y: number };
  data: BackendNodeData;
}

interface BackendEdge {
  id: string;
  type?: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  markerEnd?: { type: MarkerType | string };
}

interface BackendProject {
  project_name: string;
  project_description?: string;
  project_id: string;
  nodes: BackendNode[];
  edges: BackendEdge[];
}

interface ProjectApiResponse {
  success: boolean;
  project: BackendProject;
}

export default function Project() {
  const { projectId } = useParams<{ projectId: string }>();

  const [isIdeModalOpen, setIsIdeModalOpen] = useState(false);
  const [selectedNodeData, setSelectedNodeData] = useState<{
    nodeId: string;
    title: string;
  }>({
    nodeId: "1",
    title: "Python IDE",
  });
  const [projectTitle, setProjectTitle] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isInvalidProject, setIsInvalidProject] = useState(false);

  // Initialize nodes and edges state before using them
  const initialNodes: DefaultNodeType[] = [];
  const initialEdges: Edge[] = [];

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [nodeIdCounter, setNodeIdCounter] = useState(4);

  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = removeStyle;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // Fetch project data from backend
  useEffect(() => {
    const fetchProjectData = async () => {
      if (!projectId) return;

      setIsLoading(true);
      setError(null);

      try {
        // Validate projectId format (basic validation)
        if (!projectId.match(/^[a-zA-Z0-9_-]+$/)) {
          setIsInvalidProject(true);
          setIsLoading(false);
          return;
        }

        const response = await fetch(`/api/project/${projectId}`);

        if (!response.ok) {
          if (response.status === 404) {
            setIsInvalidProject(true);
            setIsLoading(false);
            return;
          }
          throw new Error(`Failed to fetch project: ${response.statusText}`);
        }

        const data: ProjectApiResponse = await response.json();

        if (data.success && data.project) {
          const project: BackendProject = data.project;

          // Set project title
          setProjectTitle(project.project_name || "");

          // Transform backend nodes to ReactFlow format
          const transformedNodes: DefaultNodeType[] = project.nodes.map(
            (node: BackendNode) => ({
              id: node.id,
              type: node.type || "default",
              position: node.position,
              data: {
                title: node.data.title || `Node ${node.id}`,
                description: node.data.description || "",
                viewCode: () => {
                  setSelectedNodeData({
                    nodeId: node.id,
                    title: node.data.title || `Node ${node.id}`,
                  });
                  setIsIdeModalOpen(true);
                },
              },
            })
          );

          // Transform backend edges to ReactFlow format
          const transformedEdges: Edge[] = project.edges.map(
            (edge: BackendEdge) => ({
              id: edge.id,
              type: edge.type || "custom",
              source: edge.source,
              target: edge.target,
              sourceHandle: edge.sourceHandle || undefined,
              targetHandle: edge.targetHandle || undefined,
              style: { stroke: "#64748b", strokeWidth: 2 },
              markerEnd: edge.markerEnd
                ? {
                    type: edge.markerEnd.type as MarkerType,
                  }
                : {
                    type: MarkerType.ArrowClosed,
                  },
            })
          );

          setNodes(transformedNodes);
          setEdges(transformedEdges);

          // Update node counter based on existing nodes
          if (project.nodes.length > 0) {
            const maxId = Math.max(
              ...project.nodes.map((n: BackendNode) => parseInt(n.id, 10) || 0)
            );
            setNodeIdCounter(maxId + 1);
          }
        }
      } catch (err) {
        console.error("Error fetching project:", err);
        // Check if it's a network or malformed URI error
        if (err instanceof TypeError && err.message.includes("URI")) {
          setIsInvalidProject(true);
        } else {
          setError(
            err instanceof Error ? err.message : "Failed to load project"
          );
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchProjectData();
  }, [projectId, setNodes, setEdges]);

  const handleNodeClick = (nodeId: string, title: string) => {
    setSelectedNodeData({
      nodeId,
      title,
    });
    setIsIdeModalOpen(true);
  };

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
            markerEnd: { type: MarkerType.ArrowClosed },
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
        viewCode: () => handleNodeClick(nodeId, `Node ${nodeIdCounter}`),
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

  if (!projectId) {
    return <WrongPath />;
  }

  if (isLoading) {
    return <Loading />;
  }

  if (isInvalidProject) {
    return <WrongPath />;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center w-screen h-screen bg-black">
        <div className="text-center">
          <div className="text-red-700 mb-4">
            <svg
              className="w-12 h-12 mx-auto"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">
            Failed to load project
          </h2>
          <p className="text-gray-400 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-red-800 text-white rounded hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

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
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="#374151"
        />

        <Controls
          className="bg-gray-800 border-gray-700"
          showInteractive={false}
        />

        <MiniMap
          nodeColor={nodeColor}
          nodeStrokeColor="#374151"
          nodeStrokeWidth={2}
          className="bg-gray-900 border-2 border-gray-700"
          maskColor="rgba(0, 0, 0, 0.5)"
          pannable
          zoomable
        />

        <Panel
          position="top-left"
          className="bg-gray-800 p-4 rounded-lg border border-gray-700"
        >
          <div className="flex gap-3 items-center">
            <h1>{projectTitle}</h1>
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
        projectId={projectId}
        projectTitle={projectTitle}
        nodeId={selectedNodeData.nodeId}
        nodeTitle={selectedNodeData.title}
      />
    </div>
  );
}
