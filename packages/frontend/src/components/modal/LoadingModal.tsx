import React, { useEffect } from "react";
import { createPortal } from "react-dom";

interface Notice {
  loading: string;
  success: string;
  error: string;
  errorDetails?: string;
}

interface LoadingModalProps {
  isOpen: boolean;
  status: "loading" | "success" | "error";
  onClose: () => void;
  notice: Notice;
}

export default function LoadingModal({
  isOpen,
  status,
  onClose,
  notice,
}: LoadingModalProps) {
  useEffect(() => {
    if (isOpen && status === "success") {
      const timer = setTimeout(() => {
        onClose();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isOpen, status, onClose]);

  if (!isOpen) return null;

  const handleBackgroundClick = (e: React.MouseEvent) => {
    // Always stop propagation to prevent closing IDE modal
    e.stopPropagation();

    // Only close SaveStatusModal if not loading and clicked on background
    if (status !== "loading" && e.target === e.currentTarget) {
      onClose();
    }
  };

  const modalContent = (
    <div
      className="fixed inset-0 flex items-center justify-center z-[10000] backdrop-blur-sm bg-black/30 animate-fadeIn"
      onClick={handleBackgroundClick}
    >
      <div
        className={`bg-neutral-900 rounded-xl p-8 shadow-[0_20px_60px_rgba(0,0,0,0.8)] animate-slideUp ${
          status === "error" && notice.errorDetails
            ? "max-w-2xl max-h-[80vh] overflow-auto"
            : ""
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {status === "loading" && (
          <div className="flex flex-col items-center">
            <img
              src="/aim-red.png"
              alt="Loading"
              className="w-12 h-12 animate-spin-reverse"
            />
            <span className="text-white text-lg mt-4 font-semibold">
              {notice.loading}
            </span>
          </div>
        )}

        {status === "success" && (
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center mb-4">
              <svg
                className="w-8 h-8 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <span className="text-white text-lg font-semibold">
              {notice.success}
            </span>
          </div>
        )}

        {status === "error" && (
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-red-500 flex items-center justify-center mb-4">
              <svg
                className="w-8 h-8 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <span className="text-white text-lg font-semibold mb-4">
              {notice.error}
            </span>
            {notice.errorDetails && (
              <div className="w-full">
                <div className="border-t border-neutral-700 mt-2 pt-4">
                  <p className="text-neutral-400 text-sm mb-2 font-semibold">
                    Error Details:
                  </p>
                  <pre className="bg-black/50 rounded-lg p-4 text-xs text-neutral-300 overflow-x-auto whitespace-pre-wrap break-words">
                    {notice.errorDetails}
                  </pre>
                </div>
                <button
                  onClick={onClose}
                  className="mt-4 w-full bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  // Use portal to render modal at document root level
  return createPortal(modalContent, document.body);
}
