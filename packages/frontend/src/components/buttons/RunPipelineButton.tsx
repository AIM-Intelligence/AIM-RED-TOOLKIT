import { useState } from "react";

interface RunPipelineButtonProps {
  projectId: string;
  onResults?: (results: any) => void;
}

export default function RunPipelineButton({ projectId, onResults }: RunPipelineButtonProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [pipelineResults, setPipelineResults] = useState<any>(null);

  const handleRunPipeline = async () => {
    setIsRunning(true);
    setPipelineResults(null);

    try {
      const response = await fetch("/api/code/execute-pipeline", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          project_id: projectId,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Pipeline execution result:', result);
        // Log each node's output_data
        if (result.results) {
          result.results.forEach((node: any) => {
            console.log(`Node ${node.node_id} output_data:`, node.output_data);
          });
        }
        setPipelineResults(result);
        setShowResults(true);
        
        if (onResults) {
          onResults(result);
        }
      } else {
        const error = await response.text();
        setPipelineResults({
          success: false,
          error: error || "Pipeline execution failed"
        });
        setShowResults(true);
      }
    } catch (error) {
      setPipelineResults({
        success: false,
        error: `Error: ${error}`
      });
      setShowResults(true);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <>
      <button
        onClick={handleRunPipeline}
        disabled={isRunning}
        className={`px-4 py-2 ${
          isRunning 
            ? "bg-gray-600 cursor-not-allowed" 
            : "bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
        } text-white rounded-lg transition-all duration-200 flex items-center gap-2 font-medium shadow-md hover:shadow-lg`}
        aria-label="Run Pipeline"
      >
        {isRunning ? (
          <>
            <svg
              className="animate-spin h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            실행 중...
          </>
        ) : (
          <>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
            Run
          </>
        )}
      </button>

      {/* Results Modal */}
      {showResults && pipelineResults && (
        <div
          className="fixed inset-0 flex items-center justify-center z-[9999] backdrop-blur-lg bg-black/50"
          onClick={() => setShowResults(false)}
        >
          <div
            className="bg-[#0a0a0a] rounded-xl max-w-[80vw] max-h-[80vh] overflow-auto shadow-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-white">파이프라인 실행 결과</h2>
              <button
                onClick={() => setShowResults(false)}
                className="text-gray-400 hover:text-white"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              {pipelineResults.success ? (
                <>
                  <div className="text-green-400 font-medium">
                    ✅ 파이프라인 실행 성공
                  </div>
                  <div className="text-gray-300 text-sm">
                    실행 순서: {pipelineResults.execution_order?.join(" → ")}
                  </div>
                  
                  {pipelineResults.results?.map((node: any, index: number) => (
                    <div key={node.node_id} className="bg-gray-900 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-white font-medium">
                          {index + 1}. {node.node_title} (노드 {node.node_id})
                        </h3>
                        <span className={`text-xs px-2 py-1 rounded ${
                          node.exit_code === 0 ? "bg-green-900 text-green-300" : "bg-red-900 text-red-300"
                        }`}>
                          {node.exit_code === 0 ? "성공" : "실패"}
                        </span>
                      </div>
                      
                      {node.output && (
                        <div className="mb-2">
                          <div className="text-gray-400 text-xs mb-1">출력:</div>
                          <pre className="text-gray-300 text-sm bg-black/50 p-2 rounded overflow-x-auto">
                            {node.output}
                          </pre>
                        </div>
                      )}
                      
                      {node.error && (
                        <div className="mb-2">
                          <div className="text-red-400 text-xs mb-1">에러:</div>
                          <pre className="text-red-300 text-sm bg-red-900/20 p-2 rounded overflow-x-auto">
                            {node.error}
                          </pre>
                        </div>
                      )}
                      
                      {node.output_data && Object.keys(node.output_data).length > 0 && (
                        <div>
                          <div className="text-gray-400 text-xs mb-1">
                            전달 데이터 
                            {node.output_type && (
                              <span className={`ml-2 px-2 py-0.5 rounded text-xs ${
                                node.output_type === 'object' 
                                  ? 'bg-purple-900/50 text-purple-300' 
                                  : 'bg-blue-900/50 text-blue-300'
                              }`}>
                                {node.output_type === 'object' 
                                  ? `Python Object (${node.output_class || 'unknown'})`
                                  : 'JSON Data'}
                              </span>
                            )}
                          </div>
                          <pre className="text-blue-300 text-sm bg-blue-900/20 p-2 rounded overflow-x-auto">
                            {typeof node.output_data === 'object' 
                              ? JSON.stringify(node.output_data, null, 2)
                              : String(node.output_data)}
                          </pre>
                        </div>
                      )}
                    </div>
                  ))}
                </>
              ) : (
                <div className="text-red-400">
                  ❌ 파이프라인 실행 실패: {pipelineResults.error}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}