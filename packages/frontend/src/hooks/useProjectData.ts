import { useState, useEffect } from "react";
import { projectApi } from "../utils/api";
import type { ProjectStructure, ProjectNode, ProjectEdge } from "../types";
import type { DefaultNodeType } from "../components/nodes/DefaultNode";
import type { Edge, MarkerType } from "@xyflow/react";

interface UseProjectDataReturn {
  projectData: ProjectStructure | null;
  projectTitle: string;
  isLoading: boolean;
  error: string | null;
  isInvalidProject: boolean;
  transformedNodes: DefaultNodeType[];
  transformedEdges: Edge[];
  maxNodeId: number;
}

export function useProjectData(
  projectId: string | undefined,
  onNodeClick: (nodeId: string, title: string) => void
): UseProjectDataReturn {
  const [projectData, setProjectData] = useState<ProjectStructure | null>(null);
  const [projectTitle, setProjectTitle] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isInvalidProject, setIsInvalidProject] = useState(false);
  const [transformedNodes, setTransformedNodes] = useState<DefaultNodeType[]>([]);
  const [transformedEdges, setTransformedEdges] = useState<Edge[]>([]);
  const [maxNodeId, setMaxNodeId] = useState(4);

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
          setProjectData(project);

          // Set project title
          setProjectTitle(project.project_name || "");

          // Transform backend nodes to ReactFlow format
          const nodes: DefaultNodeType[] = project.nodes.map(
            (node: ProjectNode) => ({
              id: node.id,
              type: node.type || "default",
              position: node.position,
              data: {
                title: node.data.title || `Node ${node.id}`,
                description: node.data.description || "",
                file: node.data.file, // Include file reference from backend
                viewCode: () => {
                  onNodeClick(node.id, node.data.title || `Node ${node.id}`);
                },
              },
            })
          );

          // Transform backend edges to ReactFlow format
          const edges: Edge[] = project.edges.map((edge: ProjectEdge) => ({
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
                  type: "arrowclosed" as MarkerType,
                },
          }));

          setTransformedNodes(nodes);
          setTransformedEdges(edges);

          // Update node counter based on existing nodes
          if (project.nodes.length > 0) {
            const maxId = Math.max(
              ...project.nodes.map((n: ProjectNode) => parseInt(n.id, 10) || 0)
            );
            setMaxNodeId(maxId + 1);
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
  }, [projectId, onNodeClick]);

  return {
    projectData,
    projectTitle,
    isLoading,
    error,
    isInvalidProject,
    transformedNodes,
    transformedEdges,
    maxNodeId,
  };
}