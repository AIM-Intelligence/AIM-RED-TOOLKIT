import { useCallback, useEffect } from "react";
import { useNodesState, useEdgesState, type OnNodesChange, type OnEdgesChange } from "@xyflow/react";
import type { Edge } from "@xyflow/react";
import { projectApi } from "../utils/api";
import type { DefaultNodeType } from "../components/nodes/DefaultNode";

interface UseNodeOperationsProps {
  projectId: string | undefined;
  initialNodes: DefaultNodeType[];
  initialEdges: Edge[];
  nodeIdCounter: number;
  setNodeIdCounter: React.Dispatch<React.SetStateAction<number>>;
  onNodeClick: (nodeId: string, title: string) => void;
}

interface UseNodeOperationsReturn {
  nodes: DefaultNodeType[];
  edges: Edge[];
  setNodes: React.Dispatch<React.SetStateAction<DefaultNodeType[]>>;
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  addNewNode: () => Promise<void>;
}

export function useNodeOperations({
  projectId,
  initialNodes,
  initialEdges,
  nodeIdCounter,
  setNodeIdCounter,
  onNodeClick,
}: UseNodeOperationsProps): UseNodeOperationsReturn {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Update nodes when initialNodes change
  useEffect(() => {
    setNodes(initialNodes);
  }, [initialNodes, setNodes]);

  // Update edges when initialEdges change
  useEffect(() => {
    setEdges(initialEdges);
  }, [initialEdges, setEdges]);

  // Add new node
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
            viewCode: () => onNodeClick(nodeId, nodeTitle),
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
  }, [nodeIdCounter, setNodes, projectId, setNodeIdCounter, onNodeClick]);

  // Node deletion handler
  useEffect(() => {
    const deleteNodeAsync = async (nodeId: string) => {
      if (!projectId) return;

      // Store current state for rollback
      const previousNodes = nodes;
      const previousEdges = edges;

      // Optimistic update - immediately remove from UI
      setNodes((nds) => nds.filter((node) => node.id !== nodeId));
      setEdges((eds) =>
        eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId)
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

  return {
    nodes,
    edges,
    setNodes,
    setEdges,
    onNodesChange,
    onEdgesChange,
    addNewNode,
  };
}