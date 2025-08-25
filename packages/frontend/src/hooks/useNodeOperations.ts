import { useCallback, useEffect, useRef } from "react";
import {
  useNodesState,
  useEdgesState,
  type OnNodesChange,
  type OnEdgesChange,
  type NodeChange,
} from "@xyflow/react";
import type { Edge } from "@xyflow/react";
import { projectApi } from "../utils/api";
import type { DefaultNodeType } from "../components/nodes/DefaultNode";
import type { StartNodeType } from "../components/nodes/StartNode";
import type { ResultNodeType } from "../components/nodes/ResultNode";

// Union type for all node types
type AnyNodeType = DefaultNodeType | StartNodeType | ResultNodeType;

interface UseNodeOperationsProps {
  projectId: string | undefined;
  initialNodes: AnyNodeType[];
  initialEdges: Edge[];
  nodeIdCounter: number;
  setNodeIdCounter: React.Dispatch<React.SetStateAction<number>>;
  onNodeClick: (nodeId: string, title: string) => void;
}

interface UseNodeOperationsReturn {
  nodes: AnyNodeType[];
  edges: Edge[];
  setNodes: React.Dispatch<React.SetStateAction<AnyNodeType[]>>;
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
  onNodesChange: OnNodesChange<AnyNodeType>;
  onEdgesChange: OnEdgesChange<Edge>;
  addNewNode: (nodeData: {
    title: string;
    description: string;
    nodeType: "custom" | "start" | "result";
  }) => Promise<void>;
}

export function useNodeOperations({
  projectId,
  initialNodes,
  initialEdges,
  nodeIdCounter,
  setNodeIdCounter,
  onNodeClick,
}: UseNodeOperationsProps): UseNodeOperationsReturn {
  const [nodes, setNodes, onNodesChangeInternal] =
    useNodesState<AnyNodeType>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initialEdges);
  const positionUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Update nodes when initialNodes change
  useEffect(() => {
    setNodes(initialNodes);
  }, [initialNodes, setNodes]);

  // Update edges when initialEdges change
  useEffect(() => {
    setEdges(initialEdges);
  }, [initialEdges, setEdges]);

  // Listen for node port updates
  useEffect(() => {
    const handleUpdateNodePorts = (event: CustomEvent) => {
      const { nodeId, metadata } = event.detail;
      console.log("Received updateNodePorts event:", { nodeId, metadata });
      
      setNodes((currentNodes) => 
        currentNodes.map((node) => {
          if (node.id === nodeId) {
            console.log(`Updating node ${nodeId} with metadata:`, metadata);
            // Convert metadata inputs/outputs to PortInfo format
            const inputs = metadata.inputs?.map((input: any) => ({
              id: input.name,
              label: input.name,
              type: input.type,
              required: input.required !== false,
              default: input.default,
            }));
            
            const outputs = metadata.outputs?.map((output: any) => ({
              id: output.name,
              label: output.name,
              type: output.type,
              required: false,
              default: undefined,
            }));
            
            return {
              ...node,
              data: {
                ...node.data,
                mode: metadata.mode,
                inputs: inputs,
                outputs: outputs,
              },
            };
          }
          return node;
        })
      );
    };

    window.addEventListener("updateNodePorts" as any, handleUpdateNodePorts);
    return () => {
      window.removeEventListener("updateNodePorts" as any, handleUpdateNodePorts);
    };
  }, [setNodes]);

  // Custom handler for node changes that persists position updates
  const onNodesChange = useCallback<OnNodesChange<AnyNodeType>>(
    (changes: NodeChange<AnyNodeType>[]) => {
      // Apply changes to local state first
      onNodesChangeInternal(changes);

      // Check if any position changes occurred
      const positionChanges = changes.filter(
        (change) => change.type === "position" && change.dragging === false
      );

      if (positionChanges.length > 0 && projectId) {
        // Clear existing timeout
        if (positionUpdateTimeoutRef.current) {
          clearTimeout(positionUpdateTimeoutRef.current);
        }

        // Debounce position updates to avoid too many API calls
        positionUpdateTimeoutRef.current = setTimeout(() => {
          positionChanges.forEach(async (change) => {
            if (change.type === "position" && change.position) {
              try {
                await projectApi.updateNodePosition({
                  project_id: projectId,
                  node_id: change.id,
                  position: change.position,
                });
                console.log(`Position updated for node ${change.id}`);
              } catch (error) {
                console.error(`Failed to update position for node ${change.id}:`, error);
              }
            }
          });
        }, 500); // Wait 500ms after drag ends before updating
      }
    },
    [onNodesChangeInternal, projectId]
  );

  // Add new node
  const addNewNode = useCallback(
    async (nodeData: {
      title: string;
      description: string;
      nodeType: "custom" | "start" | "result";
    }) => {
      if (!projectId) return;

      const nodeId = nodeIdCounter.toString();
      const position = {
        x: Math.random() * 500 + 100,
        y: Math.random() * 300 + 100,
      };

      try {
        // Call API to create node on backend
        const response = await projectApi.createNode({
          project_id: projectId,
          node_id: nodeId,
          node_type: nodeData.nodeType,
          position: position,
          data: {
            title: nodeData.title,
            description: nodeData.description,
          },
        });

        if (response.success) {
          // Add node to frontend after successful backend creation
          let newNode: AnyNodeType;

          if (nodeData.nodeType === "custom") {
            // Create DefaultNode with viewCode
            newNode = {
              id: nodeId,
              type: "custom",
              position: position,
              data: {
                title: nodeData.title,
                description: nodeData.description,
                file: response.node.data.file,
                viewCode: () => onNodeClick(nodeId, nodeData.title),
              },
            } as DefaultNodeType;
          } else if (nodeData.nodeType === "start") {
            // Create StartNode without viewCode
            newNode = {
              id: nodeId,
              type: "start",
              position: position,
              data: {
                title: nodeData.title,
                description: nodeData.description,
                file: response.node.data.file,
              },
            } as StartNodeType;
          } else {
            // Create ResultNode without viewCode or file
            newNode = {
              id: nodeId,
              type: "result",
              position: position,
              data: {
                title: nodeData.title,
                description: nodeData.description,
              },
            } as ResultNodeType;
          }

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
    },
    [nodeIdCounter, setNodes, projectId, setNodeIdCounter, onNodeClick]
  );

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

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (positionUpdateTimeoutRef.current) {
        clearTimeout(positionUpdateTimeoutRef.current);
      }
    };
  }, []);

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
