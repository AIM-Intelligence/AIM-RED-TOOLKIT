import { useState, useCallback, useMemo, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  addEdge,
  Panel,
  type Connection,
  type Edge,
  type NodeTypes,
  type EdgeTypes,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { DefaultNodeType } from "../../components/nodes/DefaultNode";
import DefaultNode from "../../components/nodes/DefaultNode";
import type { NumberParamNodeType } from "../../components/nodes/params/NumberParamNode";
import NumberParamNode from "../../components/nodes/params/NumberParamNode";
import type { SimpleAddNodeType } from "../../components/nodes/SimpleAddNode";
import SimpleAddNode from "../../components/nodes/SimpleAddNode";
import MockModelNode from "../../components/nodes/MockModelNode";
import DefaultEdge from "../../components/edges/DefaultEdge";
import IdeModal from "../../components/modal/Ide";
import { removeStyle } from "./removeStyle";
import Loading from "../../components/loading/Loading";
import WrongPath from "../WrongPath/WrongPath";
import RunPipelineButton from "../../components/buttons/RunPipelineButton";

// Backend API response types
interface BackendNodeData {
  title: string;
  description?: string;
  file?: string;
}

interface BackendNode {
  id: string;
  type?: string;
  position: { x: number; y: number };
  data: BackendNodeData;
}

interface BackendEdge {
  id: string;
  type?: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  markerEnd?: { type: MarkerType | string };
}

interface BackendProject {
  project_name: string;
  project_description?: string;
  project_id: string;
  nodes: BackendNode[];
  edges: BackendEdge[];
}

interface ProjectApiResponse {
  success: boolean;
  project: BackendProject;
}

export default function Project() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  const [isIdeModalOpen, setIsIdeModalOpen] = useState(false);
  const [selectedNodeData, setSelectedNodeData] = useState<{
    nodeId: string;
    title: string;
  }>({
    nodeId: "1",
    title: "Python IDE",
  });
  const [projectTitle, setProjectTitle] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isInvalidProject, setIsInvalidProject] = useState(false);

  // Initialize nodes and edges state before using them
  const initialNodes: DefaultNodeType[] = [];
  const initialEdges: Edge[] = [];

  const [nodes, setNodes, onNodesChangeBase] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [nodeIdCounter, setNodeIdCounter] = useState(1);
  const [saveTimeout, setSaveTimeout] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = removeStyle;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // Listen for updateNodeData events from NumberParamNode
  useEffect(() => {
    const handleUpdateNodeData = (event: any) => {
      const { id, data } = event.detail;
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === id) {
            const updatedNode = { ...node, data };
            // Auto-save after node data update
            if (saveTimeout) {
              clearTimeout(saveTimeout);
            }
            const newTimeout = setTimeout(() => {
              saveProjectStructure(nodes.map(n => n.id === id ? updatedNode : n), edges);
            }, 500); // Save after 500ms
            setSaveTimeout(newTimeout);
            return updatedNode;
          }
          return node;
        })
      );
    };

    document.addEventListener("updateNodeData", handleUpdateNodeData);
    return () => {
      document.removeEventListener("updateNodeData", handleUpdateNodeData);
    };
  }, [setNodes, edges, nodes, saveTimeout]);

  // Fetch project data from backend
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

        const response = await fetch(`/api/project/${projectId}`);

        if (!response.ok) {
          if (response.status === 404) {
            setIsInvalidProject(true);
            setIsLoading(false);
            return;
          }
          throw new Error(`Failed to fetch project: ${response.statusText}`);
        }

        const data: ProjectApiResponse = await response.json();

        if (data.success && data.project) {
          const project: BackendProject = data.project;

          // Set project title
          setProjectTitle(project.project_name || "");

          // Transform backend nodes to ReactFlow format
          const transformedNodes: (DefaultNodeType | NumberParamNodeType | SimpleAddNodeType)[] = project.nodes.map(
            (node: BackendNode) => {
              if (node.type === "numberParam") {
                // For NumberParam nodes, provide all required data
                return {
                  id: node.id,
                  type: "numberParam",
                  position: node.position,
                  data: {
                    title: node.data.title || `Number Param ${node.id}`,
                    description: node.data.description || "Number parameter",
                    paramName: `param_${node.id}`,
                    paramLabel: node.data.title || `Parameter ${node.id}`,
                    paramDescription: node.data.description || "Number value parameter",
                    value: 0.00,
                    minValue: null,
                    maxValue: null,
                    step: 1,
                    unit: "",
                    precision: 2,
                    integerOnly: false,
                    viewCode: () => {
                      setSelectedNodeData({
                        nodeId: node.id,
                        title: node.data.title || `Number Param ${node.id}`,
                      });
                      setIsIdeModalOpen(true);
                    },
                  },
                } as NumberParamNodeType;
              } else if (node.type === "simpleAdd") {
                // For SimpleAdd nodes
                return {
                  id: node.id,
                  type: "simpleAdd",
                  position: node.position,
                  data: {
                    title: node.data.title || `Add ${node.id}`,
                    description: node.data.description || "Simple addition: a + b",
                    viewCode: () => {
                      setSelectedNodeData({
                        nodeId: node.id,
                        title: node.data.title || `Add ${node.id}`,
                      });
                      setIsIdeModalOpen(true);
                    },
                  },
                } as SimpleAddNodeType;
              } else if (node.type === "mockModel") {
                // For MockModel nodes
                return {
                  id: node.id,
                  type: "mockModel",
                  position: node.position,
                  data: {
                    title: node.data.title || `Mock Model ${node.id}`,
                    description: node.data.description || "Simulates model generation",
                    viewCode: () => {
                      setSelectedNodeData({
                        nodeId: node.id,
                        title: node.data.title || `Mock Model ${node.id}`,
                      });
                      setIsIdeModalOpen(true);
                    },
                  },
                };
              } else {
                // Default node type
                return {
                  id: node.id,
                  type: node.type || "default",
                  position: node.position,
                  data: {
                    title: node.data.title || `Node ${node.id}`,
                    description: node.data.description || "",
                    viewCode: () => {
                      setSelectedNodeData({
                        nodeId: node.id,
                        title: node.data.title || `Node ${node.id}`,
                      });
                      setIsIdeModalOpen(true);
                    },
                  },
                } as DefaultNodeType;
              }
            }
          );

          // Transform backend edges to ReactFlow format
          const transformedEdges: Edge[] = project.edges.map(
            (edge: BackendEdge) => ({
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
                    type: MarkerType.ArrowClosed,
                  },
            })
          );

          setNodes(transformedNodes);
          setEdges(transformedEdges);

          // Update node counter based on existing nodes
          if (project.nodes.length > 0) {
            const maxId = Math.max(
              ...project.nodes.map((n: BackendNode) => parseInt(n.id, 10) || 0)
            );
            setNodeIdCounter(maxId + 1);
          } else {
            setNodeIdCounter(1);
          }
        }
      } catch (err) {
        console.error("Error fetching project:", err);
        // Check if it's a network or malformed URI error
        if (err instanceof TypeError && err.message.includes("URI")) {
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
  }, [projectId, setNodes, setEdges]);

  const handleNodeClick = (nodeId: string, title: string) => {
    setSelectedNodeData({
      nodeId,
      title,
    });
    setIsIdeModalOpen(true);
  };

  // Save project structure to backend
  // Custom onNodesChange handler that auto-saves
  const onNodesChange = useCallback((changes: any) => {
    onNodesChangeBase(changes);
    
    // Check if any NumberParam node data changed
    const hasDataChange = changes.some((change: any) => 
      change.type === 'dimensions' || 
      (change.type === 'select' && change.selected !== undefined)
    );
    
    if (!hasDataChange) {
      // Clear existing timeout
      if (saveTimeout) {
        clearTimeout(saveTimeout);
      }
      
      // Set new timeout for auto-save (debounced)
      const newTimeout = setTimeout(() => {
        saveProjectStructure(nodes, edges);
      }, 1000); // Save after 1 second of no changes
      
      setSaveTimeout(newTimeout);
    }
  }, [onNodesChangeBase, nodes, edges, saveTimeout]);

  const saveProjectStructure = async (currentNodes: any[], currentEdges: any[]) => {
    try {
      // Filter out only necessary data for backend
      const backendNodes = currentNodes.map(node => {
        // For NumberParam nodes, include all data
        if (node.type === 'numberParam') {
          return {
            id: node.id,
            type: node.type,
            position: node.position,
            data: {
              title: node.data.title,
              description: node.data.description,
              file: node.data.file || `${node.id}_${node.data.title?.replace(/\s+/g, '_')}.py`,
              // Include NumberParam specific data
              paramName: node.data.paramName,
              paramLabel: node.data.paramLabel,
              paramDescription: node.data.paramDescription,
              value: node.data.value,
              minValue: node.data.minValue,
              maxValue: node.data.maxValue,
              step: node.data.step,
              unit: node.data.unit,
              precision: node.data.precision,
              integerOnly: node.data.integerOnly
            }
          };
        }
        // For other nodes, just basic data
        return {
          id: node.id,
          type: node.type,
          position: node.position,
          data: {
            title: node.data.title,
            description: node.data.description,
            file: node.data.file || `${node.id}_${node.data.title?.replace(/\s+/g, '_')}.py`
          }
        };
      });

      const backendEdges = currentEdges.map(edge => ({
        id: edge.id,
        type: edge.type || "custom",
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle || null,
        targetHandle: edge.targetHandle || null
      }));

      console.log("Saving project structure with edges:", backendEdges);

      const response = await fetch(`/api/project/save/${projectId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodes: backendNodes,
          edges: backendEdges,
        }),
      });

      if (!response.ok) {
        console.error("Failed to save project structure:", await response.text());
      }
    } catch (error) {
      console.error("Error saving project structure:", error);
    }
  };

  // 노드 타입 정의
  const nodeTypes = useMemo<NodeTypes>(
    () => ({
      default: DefaultNode,
      numberParam: NumberParamNode,
      simpleAdd: SimpleAddNode,
      mockModel: MockModelNode,
    }),
    []
  );

  // Edge 타입 정의 - 추가
  const edgeTypes = useMemo<EdgeTypes>(
    () => ({
      custom: DefaultEdge,
    }),
    []
  );

  // 연결 유효성 검사 함수
  const isValidConnection = useCallback((connection: Edge | Connection) => {
    const source = "source" in connection ? connection.source : null;
    const target = "target" in connection ? connection.target : null;

    // 자기 자신으로의 연결 방지
    if (source && target && source === target) {
      return false;
    }

    return true;
  }, []);

  // 연결 생성 핸들러
  const onConnect = useCallback(
    (connection: Connection) => {
      // 중복 연결 검사
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

      const newEdge = {
        ...connection,
        id: `e${connection.source}-${connection.target}-${Date.now()}`,
        type: "custom",
        style: { stroke: "#64748b", strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed },
      };

      // addEdge 함수 사용 - type: "custom" 추가
      setEdges((eds) => {
        const newEdges = addEdge(newEdge, eds);
        // Save project structure with new edges
        saveProjectStructure(nodes, newEdges);
        return newEdges;
      });
    },
    [edges, setEdges, nodes]
  );

  // 새 노드 추가
  const addNewNode = useCallback(async (nodeType: "default" | "numberParam" | "simpleAdd" | "mockModel" = "default") => {
    const nodeId = nodeIdCounter.toString();
    
    if (nodeType === "numberParam") {
      const newNode: NumberParamNodeType = {
        id: nodeId,
        type: "numberParam",
        position: {
          x: Math.random() * 500 + 100,
          y: Math.random() * 300 + 100,
        },
        data: {
          title: `Number Param ${nodeIdCounter}`,
          description: "Number parameter",
          paramName: `param_${nodeIdCounter}`,
          paramLabel: `Parameter ${nodeIdCounter}`,
          paramDescription: "Configure this number parameter",
          value: 0.00,
          minValue: null,
          maxValue: null,
          step: 1,
          unit: "",
          precision: 2,
          integerOnly: false,
          currentValue: 0,
          viewCode: () => handleNodeClick(nodeId, `Number Param ${nodeIdCounter}`),
        },
      };
      setNodes((nds) => [...nds, newNode as any]);
      
      // First, create the node in backend
      try {
        const createNodeResponse = await fetch("/api/project/makenode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            project_id: projectId,
            node_id: nodeId,
            node_type: "numberParam",
            position: newNode.position,
            data: {
              title: newNode.data.title,
              description: newNode.data.description,
            },
          }),
        });
        
        if (!createNodeResponse.ok) {
          console.error("Failed to create node in backend");
        }
        
        // Then save the code
        const code = `"""
NumberValue Parameter Node
This node creates a NumberValue parameter that can be passed to other nodes
"""

from aim_params import NumberValue
from aim_params.core.metadata import UIMetadata

# Parameter configuration
param_name = "${newNode.data.paramName}"
param_label = "${newNode.data.paramLabel}"
param_description = "${newNode.data.paramDescription}"
value = ${newNode.data.value}
min_value = ${newNode.data.minValue === null ? 'None' : newNode.data.minValue}
max_value = ${newNode.data.maxValue === null ? 'None' : newNode.data.maxValue}
step = ${newNode.data.step}
unit = "${newNode.data.unit}"
precision = ${newNode.data.precision}
integer_only = ${newNode.data.integerOnly ? "True" : "False"}

# Create NumberValue parameter
param = NumberValue(
    name=param_name,
    ui_metadata=UIMetadata(
        label=param_label,
        description=param_description,
        default=value,
        required=True,
        editable=True
    ),
    value=value,
    min_value=min_value if min_value is not None else None,
    max_value=max_value if max_value is not None else None,
    step=step if step > 0 else None,
    unit=unit if unit else None,
    precision=precision if precision >= 0 else None,
    integer_only=integer_only
)

# Display parameter info
print(f"Created NumberValue parameter: {param_name}")
print(f"  Label: {param_label}")
print(f"  Value: {param.format_display()}")

# Pass parameter to next nodes
output_data = {
    "parameter": param,
    "name": param_name,
    "value": param.value,
    "metadata": {
        "type": "NumberValue",
        "min": min_value,
        "max": max_value,
        "step": step,
        "unit": unit,
        "integer_only": integer_only
    }
}`;
        
        await fetch("/api/code/savecode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            project_id: projectId,
            node_id: nodeId,
            code: code,
          }),
        });
      } catch (error) {
        console.error("Error saving node code:", error);
      }
    } else if (nodeType === "simpleAdd") {
      const newNode: SimpleAddNodeType = {
        id: nodeId,
        type: "simpleAdd",
        position: {
          x: Math.random() * 500 + 100,
          y: Math.random() * 300 + 100,
        },
        data: {
          title: `Add ${nodeIdCounter}`,
          description: "Simple addition: a + b",
          viewCode: () => handleNodeClick(nodeId, `Add ${nodeIdCounter}`),
        },
      };
      setNodes((nds) => [...nds, newNode as any]);
      
      // Create node in backend
      try {
        const createNodeResponse = await fetch("/api/project/makenode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            project_id: projectId,
            node_id: nodeId,
            node_type: "simpleAdd",
            position: newNode.position,
            data: {
              title: newNode.data.title,
              description: newNode.data.description,
            },
          }),
        });
        
        if (!createNodeResponse.ok) {
          console.error("Failed to create node in backend");
        }
        
        // Save the super simple add code
        const code = `# Simple Add Node - with automatic deserialization

# Get inputs 'a' and 'b' - they are already deserialized
a_data = input_data.get('a', {})
b_data = input_data.get('b', {})

# Extract values from NumberParam objects
a = 0
b = 0

if isinstance(a_data, dict):
    if 'parameter' in a_data:
        # It's a parameter object
        param = a_data['parameter']
        if hasattr(param, 'value'):
            a = param.value
    elif 'value' in a_data:
        a = a_data['value']

if isinstance(b_data, dict):
    if 'parameter' in b_data:
        # It's a parameter object
        param = b_data['parameter']
        if hasattr(param, 'value'):
            b = param.value
    elif 'value' in b_data:
        b = b_data['value']

# Simple addition!
result = a + b

print("=== RESULT ===")
print(f"a = {a}")
print(f"b = {b}")
print(f"a + b = {result}")

# Output
output_data = {"value": result}`;
        
        await fetch("/api/code/savecode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            project_id: projectId,
            node_id: nodeId,
            code: code,
          }),
        });
      } catch (error) {
        console.error("Error saving node code:", error);
      }
    } else if (nodeType === "mockModel") {
      const newNode = {
        id: nodeId,
        type: "mockModel",
        position: {
          x: Math.random() * 500 + 100,
          y: Math.random() * 300 + 100,
        },
        data: {
          title: `Mock Model ${nodeIdCounter}`,
          description: "Simulates model generation",
          viewCode: () => handleNodeClick(nodeId, `Mock Model ${nodeIdCounter}`),
        },
      };
      setNodes((nds) => [...nds, newNode]);
      
      // Create node in backend
      try {
        const createNodeResponse = await fetch("/api/project/makenode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            project_id: projectId,
            node_id: nodeId,
            node_type: "mockModel",
            position: newNode.position,
            data: {
              title: newNode.data.title,
              description: newNode.data.description,
            },
          }),
        });
        
        if (!createNodeResponse.ok) {
          console.error("Failed to create mock model node in backend");
        }
        
        // Save the mock model template code
        const mockModelCode = await fetch("/api/code/gettemplate/mock_model")
          .then(res => res.text())
          .catch(() => `# Mock Model Node
# Simulates model generation based on temperature

# Get temperature parameter
temperature = 1.0
if 'temperature' in input_data:
    temp_data = input_data['temperature']
    if 'parameter' in temp_data and hasattr(temp_data['parameter'], 'value'):
        temperature = temp_data['parameter'].value
    elif 'value' in temp_data:
        temperature = temp_data['value']

# Generate response based on temperature
if temperature < 0.5:
    response = "Low temperature: Deterministic output"
elif temperature < 1.0:
    response = "Medium temperature: Balanced output"  
else:
    response = f"High temperature ({temperature:.2f}): Creative output"

print(f"Temperature: {temperature}")
print(f"Response: {response}")

# Output
output_data = {
    "generated_text": response,
    "temperature_used": temperature,
    "model": "mock-gpt"
}`);
        
        await fetch("/api/code/savecode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            project_id: projectId,
            node_id: nodeId,
            code: mockModelCode,
          }),
        });
      } catch (error) {
        console.error("Error creating mock model node:", error);
      }
    } else {
      const newNode: DefaultNodeType = {
        id: nodeId,
        type: "default",
        position: {
          x: Math.random() * 500 + 100,
          y: Math.random() * 300 + 100,
        },
        data: {
          title: `Node ${nodeIdCounter}`,
          description: "New node description",
          viewCode: () => handleNodeClick(nodeId, `Node ${nodeIdCounter}`),
        },
      };
      setNodes((nds) => [...nds, newNode]);
      
      // Create node in backend
      try {
        const createNodeResponse = await fetch("/api/project/makenode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            project_id: projectId,
            node_id: nodeId,
            node_type: "default",
            position: newNode.position,
            data: {
              title: newNode.data.title,
              description: newNode.data.description,
            },
          }),
        });
        
        if (!createNodeResponse.ok) {
          console.error("Failed to create node in backend");
        }
        
        // Save initial code for default node
        const defaultCode = `# ${newNode.data.title}
# ${newNode.data.description}

# Write your Python code here
print("Hello from ${newNode.data.title}")

# Pass data to next nodes
output_data = {}`;
        
        await fetch("/api/code/savecode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            project_id: projectId,
            node_id: nodeId,
            code: defaultCode,
          }),
        });
      } catch (error) {
        console.error("Error creating default node:", error);
      }
    }
    
    setNodeIdCounter((id) => id + 1);
  }, [nodeIdCounter, setNodes, projectId]);

  // 노드 삭제 핸들러
  useEffect(() => {
    const handleDeleteNode = async (event: CustomEvent) => {
      const nodeId = event.detail.id;
      console.log('Project: Received deleteNode event for:', nodeId);
      
      // Delete from backend
      try {
        await fetch("/api/project/deletenode", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            project_id: projectId,
            node_id: nodeId,
          }),
        });
        
        // Update local state
        setNodes((nds) => {
          const updatedNodes = nds.filter((node) => node.id !== nodeId);
          // Save project structure
          saveProjectStructure(updatedNodes, edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId));
          return updatedNodes;
        });
        setEdges((eds) =>
          eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId)
        );
      } catch (error) {
        console.error("Error deleting node:", error);
      }
    };

    document.addEventListener("deleteNode", handleDeleteNode as EventListener);
    return () => {
      document.removeEventListener(
        "deleteNode",
        handleDeleteNode as EventListener
      );
    };
  }, [setNodes, setEdges, projectId, edges]);

  // Edge 삭제 핸들러 - 추가
  useEffect(() => {
    const handleDeleteEdge = async (event: CustomEvent) => {
      const edgeId = event.detail.id;
      
      // Delete from backend
      try {
        await fetch("/api/project/deleteedge", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            project_id: projectId,
            edge_id: edgeId,
          }),
        });
        
        // Update local state
        setEdges((eds) => {
          const updatedEdges = eds.filter((edge) => edge.id !== edgeId);
          // Save project structure
          saveProjectStructure(nodes, updatedEdges);
          return updatedEdges;
        });
      } catch (error) {
        console.error("Error deleting edge:", error);
      }
    };

    document.addEventListener("deleteEdge", handleDeleteEdge as EventListener);
    return () => {
      document.removeEventListener(
        "deleteEdge",
        handleDeleteEdge as EventListener
      );
    };
  }, [setEdges, projectId, nodes]);

  // 노드 데이터 업데이트 핸들러
  useEffect(() => {
    const handleUpdateNodeData = async (event: CustomEvent) => {
      const { id, data } = event.detail;
      setNodes((nds) => 
        nds.map((node) => 
          node.id === id ? { ...node, data: { ...node.data, ...data } } : node
        )
      );
      
      // Save project structure to backend
      try {
        const updatedNodes = nodes.map((node) => 
          node.id === id ? { ...node, data: { ...node.data, ...data } } : node
        );
        
        await fetch(`/api/project/save/${projectId}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            nodes: updatedNodes,
            edges: edges,
          }),
        });
      } catch (error) {
        console.error("Failed to save project structure:", error);
      }
    };

    document.addEventListener("updateNodeData", handleUpdateNodeData as EventListener);
    return () => {
      document.removeEventListener(
        "updateNodeData",
        handleUpdateNodeData as EventListener
      );
    };
  }, [setNodes, nodes, edges, projectId]);

  // MiniMap 노드 색상 함수
  const nodeColor = () => {
    return "#1e293b";
  };

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
    return (
      <div className="flex items-center justify-center w-screen h-screen bg-black">
        <div className="text-center">
          <div className="text-red-700 mb-4">
            <svg
              className="w-12 h-12 mx-auto"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">
            Failed to load project
          </h2>
          <p className="text-gray-400 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-red-800 text-white rounded hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{ width: "100vw", height: "100vh", backgroundColor: "#0a0a0a" }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        isValidConnection={isValidConnection}
        fitView
        attributionPosition="bottom-left"
        defaultEdgeOptions={{
          type: "custom",
        }}
        style={{ backgroundColor: "transparent" }}
        className="react-flow-transparent"
        deleteKeyCode={null} // Delete 키로 삭제 비활성화
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="#374151"
        />

        <Controls
          className="bg-gray-800 border-gray-700"
          showInteractive={false}
        />

        <MiniMap
          nodeColor={nodeColor}
          nodeStrokeColor="#374151"
          nodeStrokeWidth={2}
          className="bg-gray-900 border-2 border-gray-700"
          maskColor="rgba(0, 0, 0, 0.5)"
          pannable
          zoomable
        />

        <Panel
          position="top-left"
          className="bg-gray-800 p-4 rounded-lg border border-gray-700"
        >
          <div className="flex gap-3 items-center">
            <button
              onClick={() => navigate("/")}
              className="px-3 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors text-sm font-medium"
              title="Back to Projects"
            >
              ← Projects
            </button>
            <h1 className="text-white font-bold">{projectTitle}</h1>
            <button
              onClick={() => addNewNode("default")}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              + Add Node
            </button>
            <button
              onClick={() => addNewNode("numberParam")}
              className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors text-sm font-medium"
            >
              + Number Param
            </button>
            <button
              onClick={() => addNewNode("simpleAdd")}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-sm font-medium"
            >
              + Add
            </button>
            <button
              onClick={() => addNewNode("mockModel")}
              className="px-4 py-2 bg-gradient-to-r from-yellow-500 to-orange-600 text-white rounded hover:from-yellow-600 hover:to-orange-700 transition-all text-sm font-medium"
            >
              🤖 Mock Model
            </button>
            <RunPipelineButton projectId={projectId} />
            <div className="text-gray-400 text-sm">
              Nodes: {nodes.length} | Edges: {edges.length}
            </div>
          </div>
        </Panel>
      </ReactFlow>

      {/* IDE Modal */}
      <IdeModal
        isOpen={isIdeModalOpen}
        onClose={() => setIsIdeModalOpen(false)}
        projectId={projectId}
        projectTitle={projectTitle}
        nodeId={selectedNodeData.nodeId}
        nodeTitle={selectedNodeData.title}
      />
    </div>
  );
}
