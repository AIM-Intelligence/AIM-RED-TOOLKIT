import { useNavigate } from "react-router-dom";

interface ProjectPanelProps {
  projectTitle: string;
  onAddNodeClick: () => void;
  nodeCount: number;
  edgeCount: number;
}

export default function ProjectPanel({
  projectTitle,
  onAddNodeClick,
  nodeCount,
  edgeCount,
}: ProjectPanelProps) {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col gap-3 items-center">
      <button
        className="flex flex-row items-center w-full justify-start hover:cursor-pointer"
        onClick={() => navigate("/")}
      >
        <img
          src="/arrow-back.svg"
          alt="back"
          className="flex items-center justify-center w-5 h-5"
        />
        <h2 className="text-white text-lg text-center mb-0.5">Home</h2>
      </button>
      <h1 className="text-white text-2xl font-semibold mt-4 mb-2">
        {projectTitle}
      </h1>
      <button
        onClick={onAddNodeClick}
        className="px-4 py-2 bg-red-700 text-white rounded hover:bg-red-800 transition-colors text-sm font-medium"
      >
        + Add Node
      </button>
      <div className="text-gray-400 text-sm">
        Nodes: {nodeCount} | Edges: {edgeCount}
      </div>
    </div>
  );
}
