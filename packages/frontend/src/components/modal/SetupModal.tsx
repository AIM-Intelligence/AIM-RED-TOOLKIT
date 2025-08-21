import { useState } from "react";
import Modal from "./Modal";

interface SetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: {
    title: string;
    description: string;
    nodeType: "default" | "start" | "result";
  }) => void;
  hasStartNode: boolean;
}

export default function SetupModal({
  isOpen,
  onClose,
  onConfirm,
  hasStartNode,
}: SetupModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [nodeType, setNodeType] = useState<"default" | "start" | "result">("default");
  const [error, setError] = useState("");

  const handleConfirm = () => {
    // Validation
    if (!title.trim()) {
      setError("Node title is required");
      return;
    }

    // Check if trying to create another start node
    if (nodeType === "start" && hasStartNode) {
      setError("Only one Start node is allowed per project");
      return;
    }

    onConfirm({
      title: title.trim(),
      description: description.trim(),
      nodeType,
    });

    // Reset form
    setTitle("");
    setDescription("");
    setNodeType("default");
    setError("");
    onClose();
  };

  const handleClose = () => {
    // Reset form on close
    setTitle("");
    setDescription("");
    setNodeType("default");
    setError("");
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose}>
      <div className="bg-neutral-900 rounded-lg p-6 w-[400px]">
        <h2 className="text-xl font-semibold text-white mb-4">Create New Node</h2>
        
        {error && (
          <div className="mb-4 p-2 bg-red-900/50 border border-red-700 rounded text-red-300 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-1">
              Node Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setError("");
              }}
              className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded text-white focus:outline-none focus:border-red-500"
              placeholder="Enter node title"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded text-white focus:outline-none focus:border-red-500 resize-none"
              placeholder="Enter node description (optional)"
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-1">
              Node Type
            </label>
            <select
              value={nodeType}
              onChange={(e) => {
                setNodeType(e.target.value as "default" | "start" | "result");
                setError("");
              }}
              className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded text-white focus:outline-none focus:border-red-500"
            >
              <option value="default">Default Node</option>
              <option value="start" disabled={hasStartNode}>
                Start Node {hasStartNode && "(Already exists)"}
              </option>
              <option value="result">Result Node</option>
            </select>
            <p className="text-xs text-neutral-500 mt-1">
              {nodeType === "default" && "Standard node for code execution"}
              {nodeType === "start" && "Entry point for flow execution (only one allowed)"}
              {nodeType === "result" && "Node for displaying execution results"}
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={handleClose}
            className="px-4 py-2 bg-neutral-700 text-white rounded hover:bg-neutral-600 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-2 bg-red-700 text-white rounded hover:bg-red-800 transition-colors"
          >
            Create Node
          </button>
        </div>
      </div>
    </Modal>
  );
}