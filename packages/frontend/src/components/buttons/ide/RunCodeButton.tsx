import type { editor } from "monaco-editor";
import { useState, MutableRefObject } from "react";

interface RunCodeButtonProps {
  editorRef: MutableRefObject<editor.IStandaloneCodeEditor | null>;
}

export default function RunCodeButton({ editorRef }: RunCodeButtonProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [output, setOutput] = useState<string>("");
  const [notification, setNotification] = useState<{message: string, type: string} | null>(null);

  const showNotification = (message: string, type: string = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleRunCode = async () => {
    if (!editorRef.current) {
      return;
    }

    const code = editorRef.current.getValue();
    
    setIsRunning(true);
    setOutput("");

    try {
      const response = await fetch("/api/code/execute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code: code,
          language: "python",
          timeout: 30,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        
        const outputText = result.output || "";
        const errorText = result.error || "";
        const fullOutput = outputText + (errorText ? `\nError: ${errorText}` : "");
        
        setOutput(fullOutput);
        
        // 토스트 스타일 알림 (3초 후 자동 사라짐)
        showNotification(fullOutput || "실행 완료");
      } else {
        const error = await response.text();
        showNotification(`실행 실패: ${error}`, "error");
      }
    } catch (error) {
      showNotification(`실행 중 오류 발생: ${error}`, "error");
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <>
      <button
        onClick={handleRunCode}
        disabled={isRunning}
        className={`px-4 py-2 ${
          isRunning 
            ? "bg-gray-600 cursor-not-allowed" 
            : "bg-green-600 hover:bg-green-700 hover:cursor-pointer"
        } text-white rounded-lg transition-colors duration-200 flex items-center gap-2`}
        aria-label="Run code"
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
          Running...
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

      {/* Notification Toast */}
      {notification && (
        <div className={`fixed bottom-4 right-4 px-4 py-3 rounded-lg shadow-lg z-50 transition-all duration-300 ${
          notification.type === 'error' 
            ? 'bg-red-600 text-white' 
            : 'bg-green-600 text-white'
        }`}>
          <div className="flex items-center gap-2">
            {notification.type === 'error' ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            <span className="text-sm max-w-xs overflow-hidden text-ellipsis">{notification.message.split('\n')[0]}</span>
          </div>
        </div>
      )}
    </>
  );
}
