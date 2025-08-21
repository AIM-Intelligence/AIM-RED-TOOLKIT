import { useState, useCallback, useMemo } from "react";
import { useParams } from "react-router-dom";
import IdeModal from "../../components/modal/Ide";
import SetupModal from "../../components/modal/SetupModal";
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
  const [isSetupModalOpen, setIsSetupModalOpen] = useState(false);
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

  // Check if there's already a start node
  const hasStartNode = useMemo(() => {
    return nodes.some(node => node.type === "start");
  }, [nodes]);

  // Handle SetupModal confirm
  const handleSetupConfirm = useCallback(async (nodeData: {
    title: string;
    description: string;
    nodeType: "default" | "start" | "result";
  }) => {
    await addNewNode(nodeData);
    setIsSetupModalOpen(false);
  }, [addNewNode]);

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
          onAddNodeClick={() => setIsSetupModalOpen(true)}
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

      {/* Setup Modal for creating new nodes */}
      <SetupModal
        isOpen={isSetupModalOpen}
        onClose={() => setIsSetupModalOpen(false)}
        onConfirm={handleSetupConfirm}
        hasStartNode={hasStartNode}
      />
    </>
  );
}
