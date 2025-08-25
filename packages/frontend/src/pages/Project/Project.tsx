import { useState, useCallback, useMemo, useEffect } from "react";
import { useParams } from "react-router-dom";
import IdeModal from "../../components/modal/Ide";
import SetupModal from "../../components/modal/SetupModal";
import Loading from "../../components/loading/Loading";
import WrongPath from "../WrongPath/WrongPath";
import ProjectPanel from "./layouts/ProjectPanel";
import ProjectError from "./errors/ProjectError";
import ProjectFlow from "./flow/ProjectFlow";
import { useProjectData } from "../../hooks/useProjectData";
import { useNodeOperations } from "../../hooks/useNodeOperations";
import { useEdgeOperations } from "../../hooks/useEdgeOperations";
import { projectApi } from "../../utils/api";

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
  const [nodeIdCounter, setNodeIdCounter] = useState(1);
  const [venvReady, setVenvReady] = useState(false);
  const [venvChecking, setVenvChecking] = useState(true);
  const [showVenvSuccess, setShowVenvSuccess] = useState(false);
  const [venvStatus, setVenvStatus] = useState<{
    status?: string;
    progress?: number;
    message?: string;
    current_package?: string;
  }>({});

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

  // Check venv status
  useEffect(() => {
    if (!projectId) return;

    let intervalId: NodeJS.Timeout | null = null;
    let mounted = true;

    const checkVenvStatus = async () => {
      try {
        const status = await projectApi.getVenvStatus(projectId);
        if (mounted) {
          // Update venv status for progress display
          setVenvStatus({
            status: status.status,
            progress: status.progress,
            message: status.message,
            current_package: status.current_package,
          });
          
          if (status.venv_ready && !venvReady) {
            // First time venv becomes ready
            setVenvReady(true);
            setVenvChecking(false);
            setShowVenvSuccess(true);
            
            // Hide success message after 2 seconds
            setTimeout(() => {
              if (mounted) {
                setShowVenvSuccess(false);
              }
            }, 2000);
            
            if (intervalId) {
              clearInterval(intervalId);
            }
          } else if (status.venv_ready) {
            // Already ready
            setVenvReady(true);
            setVenvChecking(false);
            if (intervalId) {
              clearInterval(intervalId);
            }
          } else if (status.status === 'failed') {
            // Venv creation failed
            setVenvChecking(false);
            if (intervalId) {
              clearInterval(intervalId);
            }
            console.error("Virtual environment creation failed:", status.error);
          } else if (status.status === 'creating' || 
                    status.status === 'installing_pip' || 
                    status.status === 'installing_base' ||
                    status.status === 'installing_lsp') {
            // Still creating, keep checking
            setVenvChecking(true);
          }
        }
      } catch (error) {
        console.error("Error checking venv status:", error);
        if (mounted) {
          setVenvChecking(false);
        }
      }
    };

    // Initial check
    checkVenvStatus();

    // Poll every 2 seconds if venv is not ready
    if (!venvReady) {
      intervalId = setInterval(checkVenvStatus, 2000);
    }

    return () => {
      mounted = false;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [projectId, venvReady]);

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

  // Handle SetupModal confirm
  const handleSetupConfirm = useCallback(
    async (nodeData: {
      title: string;
      description: string;
      nodeType: "custom" | "start" | "result";
    }) => {
      await addNewNode(nodeData);
      setIsSetupModalOpen(false);
    },
    [addNewNode]
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
          onAddNodeClick={() => setIsSetupModalOpen(true)}
          nodeCount={nodes.length}
          edgeCount={edges.length}
        />
        
        {/* Venv Status Notification */}
        {venvChecking && !venvReady && (
          <div className="absolute top-4 right-4 bg-yellow-900/90 text-yellow-200 px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 z-50">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span className="text-sm">Setting up Python environment...</span>
          </div>
        )}
        
        {showVenvSuccess && (
          <div className="absolute top-4 right-4 bg-green-900/90 text-green-200 px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 z-50 animate-fadeOut">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-sm">Python environment ready!</span>
          </div>
        )}
      </ProjectFlow>

      {/* IDE Modal */}
      <IdeModal
        isOpen={isIdeModalOpen}
        onClose={() => setIsIdeModalOpen(false)}
        projectId={projectId}
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
