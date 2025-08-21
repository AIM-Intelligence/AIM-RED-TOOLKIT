import React, { useEffect } from "react";
import X from "../buttons/modal/x";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children?: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, children }) => {
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

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-[9999] backdrop-blur-lg bg-black/50 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative bg-[#0a0a0a] rounded-xl max-w-[75vw] max-h-[75vh] overflow-auto shadow-[0_20px_60px_rgba(0,0,0,0.8)] animate-slideUp min-w-[400px] min-h-[200px] sm:min-w-[90vw] sm:mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <X onClose={onClose} />
        <div className="p-8 text-white sm:p-6">{children}</div>
      </div>
    </div>
  );
};

export default Modal;
