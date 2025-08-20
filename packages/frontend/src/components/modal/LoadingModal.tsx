import React, { useEffect } from "react";

interface Notice {
  loading: string;
  success: string;
  error: string;
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
    if (isOpen && status !== "loading") {
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

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-[10000] backdrop-blur-sm bg-black/30 animate-fadeIn"
      onClick={handleBackgroundClick}
    >
      <div
        className="bg-gray-900 rounded-xl p-8 shadow-[0_20px_60px_rgba(0,0,0,0.8)] animate-slideUp"
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
            <span className="text-white text-lg font-semibold">
              {notice.error}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
