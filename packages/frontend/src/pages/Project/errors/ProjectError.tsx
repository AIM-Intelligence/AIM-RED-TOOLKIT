interface ProjectErrorProps {
  error: string;
  onRetry: () => void;
}

export default function ProjectError({ error, onRetry }: ProjectErrorProps) {
  return (
    <div className="flex items-center justify-center w-screen h-screen bg-black">
      <div className="text-center">
        <div className="text-red-800 mb-4">
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
          onClick={onRetry}
          className="px-4 py-2 bg-red-800 text-white rounded hover:bg-red-700 transition-colors"
        >
          Retry
        </button>
      </div>
    </div>
  );
}
