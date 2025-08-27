import { useState, useCallback, useMemo } from "react";
import { useParams } from "react-router-dom";
import IdeModal from "../../components/modal/Ide";
import Loading from "../../components/loading/Loading";
import WrongPath from "../WrongPath/WrongPath";
import ProjectPanel from "./layouts/ProjectPanel";
import ProjectError from "./errors/ProjectError";
import ProjectFlow from "./flow/ProjectFlow";
import { useProjectData } from "../../hooks/useProjectData";
import { useNodeOperations } from "../../hooks/useNodeOperations";
import { useEdgeOperations } from "../../hooks/useEdgeOperations";
import { type ComponentTemplate } from "../../config/componentLibrary";
import { codeApi } from "../../utils/api";

export default function Project() {
  const { projectId } = useParams<{ projectId: string }>();

  // UI State
  const [isIdeModalOpen, setIsIdeModalOpen] = useState(false);
  const [selectedNodeData, setSelectedNodeData] = useState<{
    nodeId: string;
    title: string;
  }>({
    nodeId: "1",
    title: "Python IDE",
  });
  const [nodeIdCounter, setNodeIdCounter] = useState(1);

  // Handle node click
  const handleNodeClick = useCallback((nodeId: string, title: string) => {
    setSelectedNodeData({
      nodeId,
      title,
    });
    setIsIdeModalOpen(true);
  }, []);

  // Fetch project data
  const {
    projectTitle,
    isLoading,
    error,
    isInvalidProject,
    transformedNodes,
    transformedEdges,
    maxNodeId,
  } = useProjectData(projectId, handleNodeClick);

  // Initialize node counter with max ID
  if (maxNodeId > nodeIdCounter) {
    setNodeIdCounter(maxNodeId);
  }

  // Node operations
  const { nodes, setNodes, edges, setEdges, onNodesChange, onEdgesChange, addNewNode } =
    useNodeOperations({
      projectId,
      initialNodes: transformedNodes,
      initialEdges: transformedEdges,
      nodeIdCounter,
      setNodeIdCounter,
      onNodeClick: handleNodeClick,
    });

  // Edge operations
  const { onConnect, isValidConnection } = useEdgeOperations({
    projectId,
    edges,
    setEdges,
    nodes,
  });

  // Check if there's already a start node
  const hasStartNode = useMemo(() => {
    return nodes.some((node) => node.type === "start");
  }, [nodes]);


  // Handle component library selection
  const handleComponentSelect = useCallback(
    async (component: ComponentTemplate) => {
      if (!projectId) return;

      // Check if trying to add a second start node
      if (component.nodeType === "start" && hasStartNode) {
        alert("Only one Start node is allowed per flow");
        return;
      }

      // Generate new node ID
      const newNodeId = String(nodeIdCounter);
      setNodeIdCounter(prev => prev + 1);

      try {
        // Create node from template
        const apiUrl = window.location.hostname === 'localhost' 
          ? 'http://localhost:8000' 
          : `http://${window.location.hostname}:8000`;
        const response = await fetch(`${apiUrl}/api/components/create-from-template`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            project_id: projectId,
            node_id: newNodeId,
            template_name: component.template,
            title: component.name,
            description: component.description,
          }),
        });

        if (response.ok) {
          const result = await response.json();
          
          // Get metadata for the new node to extract inputs/outputs
          let inputs = undefined;
          let outputs = undefined;
          
          try {
            const metadataResult = await codeApi.getNodeMetadata({
              project_id: projectId,
              node_id: newNodeId,
              node_data: { 
                data: { 
                  file: result.file_name || `${newNodeId}_${component.name.replace(/\s+/g, '_')}.py` 
                } 
              }
            });
            
            if (metadataResult.success && metadataResult.metadata) {
              const metadata = metadataResult.metadata;
              
              // Convert metadata to port format
              if (metadata.inputs?.length > 0) {
                inputs = metadata.inputs.map((input: any) => ({
                  id: input.name,
                  label: input.name,
                  type: input.type,
                  required: input.required !== false,
                  default: input.default,
                }));
              }
              
              if (metadata.outputs?.length > 0) {
                outputs = metadata.outputs.map((output: any) => ({
                  id: output.name,
                  label: output.name,
                  type: output.type,
                  required: false,
                  default: undefined,
                }));
              }
            }
          } catch (error) {
            console.error(`Failed to fetch metadata for new node:`, error);
          }
          
          // Create new node without page refresh
          const newNode = {
            id: newNodeId,
            type: component.nodeType || "custom",
            position: { 
              x: 250 + Math.random() * 100, // Random offset to prevent overlap
              y: 100 + Math.random() * 100 
            },
            data: {
              title: component.name,
              description: component.description,
              file: result.file_name || `${newNodeId}_${component.name.replace(/\s+/g, '_')}.py`,
              viewCode: () => handleNodeClick(newNodeId, component.name),
              inputs: inputs,
              outputs: outputs,
            }
          };
          
          // Add node to React Flow
          setNodes(currentNodes => [...currentNodes, newNode]);
        } else {
          console.error("Failed to create node from template");
        }
      } catch (error) {
        console.error("Error creating node from template:", error);
      }
    },
    [projectId, nodeIdCounter, addNewNode, hasStartNode]
  );

  // Handle retry
  const handleRetry = useCallback(() => {
    window.location.reload();
  }, []);

  // Conditional rendering
  if (!projectId || isInvalidProject) {
    return <WrongPath />;
  }

  if (isLoading) {
    return <Loading />;
  }

  if (error) {
    return <ProjectError error={error} onRetry={handleRetry} />;
  }

  return (
    <>
      <ProjectFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        isValidConnection={isValidConnection}
      >
        <ProjectPanel
          projectTitle={projectTitle}
          nodeCount={nodes.length}
          edgeCount={edges.length}
          onComponentSelect={handleComponentSelect}
        />
      </ProjectFlow>

      {/* IDE Modal */}
      <IdeModal
        isOpen={isIdeModalOpen}
        onClose={() => setIsIdeModalOpen(false)}
        projectId={projectId}
        nodeId={selectedNodeData.nodeId}
        nodeTitle={selectedNodeData.title}
      />
    </>
  );
}
