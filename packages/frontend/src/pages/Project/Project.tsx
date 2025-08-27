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
  const { nodes, edges, setEdges, onNodesChange, onEdgesChange, addNewNode } =
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
          // Refresh the page to load the new node
          // This ensures the node is properly loaded with template code
          window.location.reload();
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
