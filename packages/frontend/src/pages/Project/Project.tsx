import { useState, useCallback, useMemo, useEffect } from "react";
import { useParams } from "react-router-dom";
import {
  ReactFlow,
  MiniMap,
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
import { projectApi } from "../../utils/api";
import type { ProjectNode, ProjectEdge, ProjectStructure } from "../../types";

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

        const data = await projectApi.getProject(projectId);

        if (data.success && data.project) {
          const project: ProjectStructure = data.project;

          // Set project title
          setProjectTitle(project.project_name || "");

          // Transform backend nodes to ReactFlow format
          const transformedNodes: DefaultNodeType[] = project.nodes.map(
            (node: ProjectNode) => ({
              id: node.id,
              type: node.type || "default",
              position: node.position,
              data: {
                title: node.data.title || `Node ${node.id}`,
                description: node.data.description || "",
                file: node.data.file, // Include file reference from backend
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
            (edge: ProjectEdge) => ({
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
              ...project.nodes.map((n: ProjectNode) => parseInt(n.id, 10) || 0)
            );
            setNodeIdCounter(maxId + 1);
          }
        }
      } catch (err) {
        console.error("Error fetching project:", err);
        // Check if it's a network or malformed URI error or 404
        if (err instanceof TypeError && err.message.includes("URI")) {
          setIsInvalidProject(true);
        } else if (err instanceof Error && err.message.includes("404")) {
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
    async (connection: Connection) => {
      if (!projectId) return;

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

      const edgeId = `e${connection.source}-${connection.target}-${Date.now()}`;

      try {
        // Call API to create edge on backend
        const response = await projectApi.createEdge({
          project_id: projectId,
          edge_id: edgeId,
          edge_type: "custom",
          source: connection.source!,
          target: connection.target!,
          marker_end: { type: MarkerType.ArrowClosed },
        });

        if (response.success) {
          // Add edge to frontend after successful backend creation
          setEdges((eds) =>
            addEdge(
              {
                ...connection,
                id: edgeId,
                type: "custom",
                style: { stroke: "#64748b", strokeWidth: 2 },
                markerEnd: { type: MarkerType.ArrowClosed },
              },
              eds
            )
          );
        }
      } catch (error) {
        console.error("Failed to create edge:", error);
        alert(
          `Failed to create edge: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
    },
    [edges, setEdges, projectId]
  );

  // 새 노드 추가
  const addNewNode = useCallback(async () => {
    if (!projectId) return;

    const nodeId = nodeIdCounter.toString();
    const nodeTitle = `Node ${nodeIdCounter}`;
    const position = {
      x: Math.random() * 500 + 100,
      y: Math.random() * 300 + 100,
    };

    try {
      // Call API to create node on backend
      const response = await projectApi.createNode({
        project_id: projectId,
        node_id: nodeId,
        node_type: "default",
        position: position,
        data: {
          title: nodeTitle,
          description: "New node description",
        },
      });

      if (response.success) {
        // Add node to frontend after successful backend creation
        const newNode: DefaultNodeType = {
          id: nodeId,
          type: "default",
          position: position,
          data: {
            title: nodeTitle,
            description: "New node description",
            file: response.node.data.file, // Include file reference from backend
            viewCode: () => handleNodeClick(nodeId, nodeTitle),
          },
        };
        setNodes((nds) => [...nds, newNode]);
        setNodeIdCounter((id) => id + 1);
      }
    } catch (error) {
      console.error("Failed to create node:", error);
      alert(
        `Failed to create node: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }, [nodeIdCounter, setNodes, projectId]);

  // 노드 삭제 핸들러
  useEffect(() => {
    const deleteNodeAsync = async (nodeId: string) => {
      if (!projectId) return;
      
      // Store current state for rollback
      const previousNodes = nodes;
      const previousEdges = edges;
      
      // Optimistic update - immediately remove from UI
      setNodes((nds) => nds.filter((node) => node.id !== nodeId));
      setEdges((eds) =>
        eds.filter(
          (edge) => edge.source !== nodeId && edge.target !== nodeId
        )
      );

      try {
        // Call API to delete node on backend
        const response = await projectApi.deleteNode({
          project_id: projectId,
          node_id: nodeId,
        });

        if (!response.success) {
          // Rollback on failure
          setNodes(previousNodes);
          setEdges(previousEdges);
          alert("Failed to delete node");
        }
      } catch (error) {
        // Rollback on error
        setNodes(previousNodes);
        setEdges(previousEdges);
        console.error("Failed to delete node:", error);
        alert(
          `Failed to delete node: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
    };

    const handleDeleteNode = (event: Event) => {
      const customEvent = event as CustomEvent<{ id: string }>;
      const nodeId = customEvent.detail.id;
      deleteNodeAsync(nodeId);
    };

    document.addEventListener("deleteNode", handleDeleteNode);
    return () => {
      document.removeEventListener("deleteNode", handleDeleteNode);
    };
  }, [setNodes, setEdges, projectId, nodes, edges]);

  // Edge 삭제 핸들러 - 추가
  useEffect(() => {
    const deleteEdgeAsync = async (edgeId: string) => {
      if (!projectId) return;
      
      // Store current state for rollback
      const previousEdges = edges;
      
      // Optimistic update - immediately remove from UI
      setEdges((eds) => eds.filter((edge) => edge.id !== edgeId));

      try {
        // Call API to delete edge on backend
        const response = await projectApi.deleteEdge({
          project_id: projectId,
          edge_id: edgeId,
        });

        if (!response.success) {
          // Rollback on failure
          setEdges(previousEdges);
          alert("Failed to delete edge");
        }
      } catch (error) {
        // Rollback on error
        setEdges(previousEdges);
        console.error("Failed to delete edge:", error);
        alert(
          `Failed to delete edge: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
    };

    const handleDeleteEdge = (event: Event) => {
      const customEvent = event as CustomEvent<{ id: string }>;
      const edgeId = customEvent.detail.id;
      deleteEdgeAsync(edgeId);
    };

    document.addEventListener("deleteEdge", handleDeleteEdge);
    return () => {
      document.removeEventListener("deleteEdge", handleDeleteEdge);
    };
  }, [setEdges, projectId, edges]);

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

        <Panel
          position="top-left"
          className="bg-neutral-800 p-4 rounded-lg border border-neutral-700"
        >
          <div className="flex flex-col gap-3 items-center">
            <h1>{projectTitle}</h1>
            <button
              onClick={addNewNode}
              className="px-4 py-2 bg-red-700 text-white rounded hover:bg-red-800 transition-colors text-sm font-medium"
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
