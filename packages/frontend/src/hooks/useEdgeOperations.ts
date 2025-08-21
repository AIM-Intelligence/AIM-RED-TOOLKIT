import { useCallback, useEffect } from "react";
import { addEdge, type Connection, type Edge, MarkerType } from "@xyflow/react";
import { projectApi } from "../utils/api";

interface UseEdgeOperationsProps {
  projectId: string | undefined;
  edges: Edge[];
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
}

interface UseEdgeOperationsReturn {
  onConnect: (connection: Connection) => Promise<void>;
  isValidConnection: (connection: Edge | Connection) => boolean;
}

export function useEdgeOperations({
  projectId,
  edges,
  setEdges,
}: UseEdgeOperationsProps): UseEdgeOperationsReturn {
  // Validate connection
  const isValidConnection = useCallback((connection: Edge | Connection) => {
    const source = "source" in connection ? connection.source : null;
    const target = "target" in connection ? connection.target : null;

    // Prevent self-connection
    if (source && target && source === target) {
      return false;
    }

    return true;
  }, []);

  // Handle connection creation
  const onConnect = useCallback(
    async (connection: Connection) => {
      if (!projectId) return;

      // Check for duplicate connections
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

  // Edge deletion handler
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

  return {
    onConnect,
    isValidConnection,
  };
}