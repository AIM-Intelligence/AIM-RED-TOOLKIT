import { useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import IdeModal from "../../components/modal/Ide";
import Loading from "../../components/loading/Loading";
import WrongPath from "../WrongPath/WrongPath";
import ProjectPanel from "./layouts/ProjectPanel";
import ProjectError from "./errors/ProjectError";
import ProjectFlow from "./flow/ProjectFlow";
import { removeStyle } from "./removeStyle";
import { useProjectData } from "../../hooks/useProjectData";
import { useNodeOperations } from "../../hooks/useNodeOperations";
import { useEdgeOperations } from "../../hooks/useEdgeOperations";
import { useProjectStyles } from "../../hooks/useProjectStyles";

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
  const [nodeIdCounter, setNodeIdCounter] = useState(4);

  // Apply project styles
  useProjectStyles(removeStyle);

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
  });

  // Handle retry
  const handleRetry = useCallback(() => {
    window.location.reload();
  }, []);

  // Conditional rendering
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
          addNewNode={addNewNode}
          nodeCount={nodes.length}
          edgeCount={edges.length}
        />
      </ProjectFlow>

      {/* IDE Modal */}
      <IdeModal
        isOpen={isIdeModalOpen}
        onClose={() => setIsIdeModalOpen(false)}
        projectId={projectId}
        projectTitle={projectTitle}
        nodeId={selectedNodeData.nodeId}
        nodeTitle={selectedNodeData.title}
      />
    </>
  );
}
