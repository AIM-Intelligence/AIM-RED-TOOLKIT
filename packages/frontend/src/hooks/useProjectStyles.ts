import { useEffect } from "react";

export function useProjectStyles(styleContent: string) {
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = styleContent;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, [styleContent]);
}