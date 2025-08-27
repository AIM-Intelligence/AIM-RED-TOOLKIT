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
  toastMessage: string | null;
  
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
  setToastMessage: (message: string | null) => void;
}

export const useExecutionStore = create<ExecutionState>((set, get) => ({
  isExecuting: false,
  executionResults: {},
  resultNodes: {},
  executionOrder: [],
  totalExecutionTime: 0,
  runId: null,
  toastMessage: null,

  setExecuting: (isExecuting) => set({ isExecuting }),

  setExecutionResults: (results) => set((state) => ({
    executionResults: {
      ...state.executionResults,  // 기존 결과 유지
      ...results.execution_results  // 새 결과로 덮어쓰기
    },
    resultNodes: {
      ...state.resultNodes,  // 기존 result nodes 유지
      ...results.result_nodes  // 새 result nodes로 덮어쓰기
    },
    executionOrder: results.execution_order,
    totalExecutionTime: results.total_execution_time_ms,
    runId: results.run_id,
    isExecuting: false,
  })),

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

  setToastMessage: (message) => set({ toastMessage: message }),
}));