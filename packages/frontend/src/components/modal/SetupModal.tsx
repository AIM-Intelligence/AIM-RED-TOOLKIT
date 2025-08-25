import { useEffect, useState } from "react";
import X from "../buttons/modal/x";

interface SetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: {
    title: string;
    description: string;
    nodeType: "custom" | "start" | "result";
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
  const [nodeType, setNodeType] = useState<"custom" | "start" | "result">(
    "custom"
  );
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      // Prevent body scroll when modal is open
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }

    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    // For Start and Result nodes, use fixed titles
    const finalTitle =
      nodeType === "start"
        ? "Start"
        : nodeType === "result"
        ? "Result"
        : title.trim();

    const finalDescription =
      nodeType === "start"
        ? "Flow entry point"
        : nodeType === "result"
        ? "Flow result output"
        : description.trim();

    // Validation only for custom nodes
    if (nodeType === "custom" && !title.trim()) {
      setError("Node title is required");
      return;
    }

    // Check if trying to create another start node
    if (nodeType === "start" && hasStartNode) {
      setError("Only one Start node is allowed per project");
      return;
    }

    onConfirm({
      title: finalTitle,
      description: finalDescription,
      nodeType,
    });

    // Reset form
    setTitle("");
    setDescription("");
    setNodeType("custom");
    setError("");
    onClose();
  };

  const handleClose = () => {
    // Reset form on close
    setTitle("");
    setDescription("");
    setNodeType("custom");
    setError("");
    onClose();
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-[9999] backdrop-blur-lg bg-black/20 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative bg-[#0a0a0a] rounded-xl w-[50vw] h-[50vh] shadow-[0_20px_60px_rgba(0,0,0,0.8)] animate-slideUp flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with close button */}
        <div className="p-6 pb-0">
          <div className="w-full flex justify-end">
            <X onClose={onClose} />
          </div>

          <h2 className="text-xl font-semibold text-white mb-4">
            Create New Node
          </h2>

          {error && (
            <div className="mb-4 p-2 bg-red-900/50 border border-red-700 rounded text-red-300 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto px-6 pb-4">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-1">
                Node Type
              </label>
              <select
                value={nodeType}
                onChange={(e) => {
                  setNodeType(e.target.value as "custom" | "start" | "result");
                  setError("");
                }}
                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded text-white focus:outline-none focus:border-red-500"
              >
                <option value="custom">Default Node</option>
                <option value="start" disabled={hasStartNode}>
                  Start Node {hasStartNode && "(Already exists)"}
                </option>
                <option value="result">Result Node</option>
              </select>
              <p className="text-xs text-neutral-500 mt-1">
                {nodeType === "custom" && "Standard node for code execution"}
                {nodeType === "start" &&
                  "Entry point for flow execution (only one allowed)"}
                {nodeType === "result" &&
                  "Node for displaying execution results"}
              </p>
            </div>

            {/* Only show title/description for custom nodes */}
            {nodeType === "custom" ? (
              <>
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

                <div className="flex flex-col">
                  <label className="block text-sm font-medium text-neutral-300 mb-1">
                    Description
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full min-h-[200px] px-3 py-2 bg-neutral-800 border border-neutral-700 rounded text-white focus:outline-none focus:border-red-500 resize-none"
                    placeholder="Enter node description (optional)"
                    rows={3}
                  />
                </div>
              </>
            ) : (
              <div className="p-3 bg-neutral-800 rounded border border-neutral-700">
                <p className="text-sm text-neutral-300">
                  {nodeType === "start" && (
                    <>
                      <strong>Start Node</strong> will be created with:
                      <br />• Title: "Start"
                      <br />• Description: "Flow entry point"
                      <br />• No code file needed
                    </>
                  )}
                  {nodeType === "result" && (
                    <>
                      <strong>Result Node</strong> will be created with:
                      <br />• Title: "Result"
                      <br />• Description: "Flow result output"
                      <br />• No code file needed
                    </>
                  )}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Fixed footer with buttons */}
        <div className="p-6 pt-4 border-neutral-800">
          <div className="flex justify-end gap-3">
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
      </div>
    </div>
  );
}
