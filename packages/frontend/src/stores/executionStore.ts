import { create } from 'zustand';

interface ExecutionResult {
  status: 'success' | 'error' | 'skipped';
  output?: unknown;
  error?: string;
  execution_time_ms?: number;
  logs?: string;
}

interface ExecutionState {
  isExecuting: boolean;
  executionResults: Record<string, ExecutionResult>;
  resultNodes: Record<string, unknown>;
  executionOrder: string[];
  totalExecutionTime: number;
  runId: string | null;
  
  // Actions
  setExecuting: (isExecuting: boolean) => void;
  setExecutionResults: (results: {
    execution_results: Record<string, ExecutionResult>;
    result_nodes: Record<string, unknown>;
    execution_order: string[];
    total_execution_time_ms: number;
    run_id: string;
  }) => void;
  clearResults: () => void;
  getNodeResult: (nodeId: string) => unknown;
}

export const useExecutionStore = create<ExecutionState>((set, get) => ({
  isExecuting: false,
  executionResults: {},
  resultNodes: {},
  executionOrder: [],
  totalExecutionTime: 0,
  runId: null,

  setExecuting: (isExecuting) => set({ isExecuting }),

  setExecutionResults: (results) => set({
    executionResults: results.execution_results,
    resultNodes: results.result_nodes,
    executionOrder: results.execution_order,
    totalExecutionTime: results.total_execution_time_ms,
    runId: results.run_id,
    isExecuting: false,
  }),

  clearResults: () => set({
    executionResults: {},
    resultNodes: {},
    executionOrder: [],
    totalExecutionTime: 0,
    runId: null,
  }),

  getNodeResult: (nodeId) => {
    const state = get();
    // First check if it's a result node
    if (state.resultNodes[nodeId] !== undefined) {
      return state.resultNodes[nodeId];
    }
    // Then check execution results
    if (state.executionResults[nodeId]) {
      return state.executionResults[nodeId].output;
    }
    return null;
  },
}));