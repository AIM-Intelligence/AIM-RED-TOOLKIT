interface ProjectPanelProps {
  projectTitle: string;
  addNewNode: () => void;
  nodeCount: number;
  edgeCount: number;
}

export default function ProjectPanel({
  projectTitle,
  addNewNode,
  nodeCount,
  edgeCount,
}: ProjectPanelProps) {
  return (
    <div className="flex flex-col gap-3 items-center">
      <h1 className="text-white font-semibold">{projectTitle}</h1>
      <button
        onClick={addNewNode}
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
