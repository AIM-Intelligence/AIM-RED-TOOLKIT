// API utility functions using the defined interfaces

import type {
  CreateProjectRequest,
  CreateProjectResponse,
  GetAllProjectsResponse,
  GetProjectResponse,
  DeleteProjectRequest,
  DeleteProjectResponse,
  CreateNodeRequest,
  CreateNodeResponse,
  DeleteNodeRequest,
  DeleteNodeResponse,
  CreateEdgeRequest,
  CreateEdgeResponse,
  DeleteEdgeRequest,
  DeleteEdgeResponse,
  CodeExecutionRequest,
  CodeExecutionResponse,
  GetNodeCodeRequest,
  GetNodeCodeResponse,
  SaveNodeCodeRequest,
  SaveNodeCodeResponse,
  ErrorResponse,
} from "../types";

const API_BASE_URL = "/api";

// Helper function for API calls
async function apiCall<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const error: ErrorResponse = await response.json();
    throw new Error(error.detail || `API Error: ${response.statusText}`);
  }

  return response.json();
}

// ==================== Project APIs ====================

export const projectApi = {
  // Get all projects
  async getAllProjects(): Promise<GetAllProjectsResponse> {
    return apiCall<GetAllProjectsResponse>("/project/");
  },

  // Get single project
  async getProject(projectId: string): Promise<GetProjectResponse> {
    return apiCall<GetProjectResponse>(`/project/${projectId}`);
  },

  // Create project
  async createProject(
    data: CreateProjectRequest
  ): Promise<CreateProjectResponse> {
    return apiCall<CreateProjectResponse>("/project/make", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  // Delete project
  async deleteProject(
    data: DeleteProjectRequest
  ): Promise<DeleteProjectResponse> {
    return apiCall<DeleteProjectResponse>("/project/delete", {
      method: "DELETE",
      body: JSON.stringify(data),
    });
  },

  // Create node
  async createNode(data: CreateNodeRequest): Promise<CreateNodeResponse> {
    return apiCall<CreateNodeResponse>("/project/makenode", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  // Delete node
  async deleteNode(data: DeleteNodeRequest): Promise<DeleteNodeResponse> {
    return apiCall<DeleteNodeResponse>("/project/deletenode", {
      method: "DELETE",
      body: JSON.stringify(data),
    });
  },

  // Create edge
  async createEdge(data: CreateEdgeRequest): Promise<CreateEdgeResponse> {
    return apiCall<CreateEdgeResponse>("/project/makeedge", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  // Delete edge
  async deleteEdge(data: DeleteEdgeRequest): Promise<DeleteEdgeResponse> {
    return apiCall<DeleteEdgeResponse>("/project/deleteedge", {
      method: "DELETE",
      body: JSON.stringify(data),
    });
  },
};

// ==================== Code APIs ====================

export const codeApi = {
  // Execute code
  async executeCode(
    data: CodeExecutionRequest
  ): Promise<CodeExecutionResponse> {
    return apiCall<CodeExecutionResponse>("/code/execute", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  // Get node code
  async getNodeCode(data: GetNodeCodeRequest): Promise<GetNodeCodeResponse> {
    return apiCall<GetNodeCodeResponse>("/code/getcode", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  // Save node code
  async saveNodeCode(data: SaveNodeCodeRequest): Promise<SaveNodeCodeResponse> {
    return apiCall<SaveNodeCodeResponse>("/code/savecode", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
};

// Export all API functions
export default {
  project: projectApi,
  code: codeApi,
};
