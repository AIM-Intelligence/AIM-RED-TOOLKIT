import { useState, useEffect } from "react";
import { projectApi, codeApi } from "../utils/api";
import type { ProjectStructure, ProjectNode, ProjectEdge } from "../types";
import type { DefaultNodeType } from "../components/nodes/DefaultNode";
import type { StartNodeType } from "../components/nodes/StartNode";
import type { ResultNodeType } from "../components/nodes/ResultNode";
import type { Edge, MarkerType } from "@xyflow/react";

// Union type for all node types
type AnyNodeType = DefaultNodeType | StartNodeType | ResultNodeType;

interface UseProjectDataReturn {
  projectData: ProjectStructure | null;
  projectTitle: string;
  isLoading: boolean;
  error: string | null;
  isInvalidProject: boolean;
  transformedNodes: AnyNodeType[];
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
  const [transformedNodes, setTransformedNodes] = useState<AnyNodeType[]>([]);
  const [transformedEdges, setTransformedEdges] = useState<Edge[]>([]);
  const [maxNodeId, setMaxNodeId] = useState(1);

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
          const nodes: AnyNodeType[] = project.nodes.map(
            (node: ProjectNode): AnyNodeType => {
              const nodeType = node.type || "custom";
              const baseData = {
                title: node.data.title || `Node ${node.id}`,
                description: node.data.description || "",
              };

              if (nodeType === 'start') {
                return {
                  id: node.id,
                  type: 'start',
                  position: node.position,
                  data: {
                    ...baseData,
                    file: node.data.file,
                  },
                } as StartNodeType;
              } else if (nodeType === 'result') {
                return {
                  id: node.id,
                  type: 'result',
                  position: node.position,
                  data: baseData,
                } as ResultNodeType;
              } else {
                return {
                  id: node.id,
                  type: 'custom',
                  position: node.position,
                  data: {
                    ...baseData,
                    file: node.data.file,
                    viewCode: () => {
                      onNodeClick(node.id, node.data.title || `Node ${node.id}`, node.data.file);
                    },
                  },
                } as DefaultNodeType;
              }
            }
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

          // Fetch metadata for custom nodes
          const nodesWithMetadata = await Promise.all(
            nodes.map(async (node) => {
              if (node.type === 'custom') {
                try {
                  const metadataResult = await codeApi.getNodeMetadata({
                    project_id: projectId,
                    node_id: node.id,
                    node_data: { data: node.data }
                  });
                  
                  console.log(`Metadata for node ${node.id}:`, metadataResult);
                  
                  if (metadataResult.success && metadataResult.metadata) {
                    const metadata = metadataResult.metadata;
                    
                    // Convert metadata to port format
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
                    
                    // Return node with metadata
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
                } catch (error) {
                  console.error(`Failed to fetch metadata for node ${node.id}:`, error);
                }
              }
              return node;
            })
          );

          setTransformedNodes(nodesWithMetadata);
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