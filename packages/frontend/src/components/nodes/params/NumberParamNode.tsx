import { useState, useEffect } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import clsx from "clsx";
import ParamNodeModal from "./ParamNodeModal";

export interface NumberParamData {
  title: string;
  description: string;
  paramName: string;
  paramLabel: string;
  paramDescription: string;
  value: number;
  minValue: number | null;
  maxValue: number | null;
  step: number;
  unit: string;
  precision: number;
  integerOnly: boolean;
  viewCode?: () => void;
  [key: string]: unknown; // 인덱스 시그니처 추가
}

export type NumberParamNodeType = Node<NumberParamData>;

export default function NumberParamNode(props: NodeProps<NumberParamNodeType>) {
  const [hovering, setHovering] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [inputValue, setInputValue] = useState(props.data.value.toString());

  // Add styles to disable spinner buttons
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      /* Chrome, Safari, Edge, Opera */
      input[type=number].no-spinner::-webkit-outer-spin-button,
      input[type=number].no-spinner::-webkit-inner-spin-button {
        -webkit-appearance: none;
        margin: 0;
      }
      /* Firefox */
      input[type=number].no-spinner {
        -moz-appearance: textfield;
        appearance: textfield;
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);


  const handleNodeDoubleClick = () => {
    setIsModalOpen(true);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    const deleteEvent = new CustomEvent("deleteNode", {
      detail: { id: props.id },
      bubbles: true,
    });
    e.currentTarget.dispatchEvent(deleteEvent);
  };

  const handleValueChange = (value: string) => {
    setInputValue(value);
    
    // Only update the actual value if it's a valid number
    const numValue = parseFloat(value);
    if (!isNaN(numValue)) {
      const updateEvent = new CustomEvent("updateNodeData", {
        detail: { 
          id: props.id, 
          data: { ...props.data, value: numValue }
        },
        bubbles: true,
      });
      document.dispatchEvent(updateEvent);
    }
  };

  const handleBlur = () => {
    // On blur, if empty or invalid, reset to 0
    const numValue = parseFloat(inputValue);
    if (isNaN(numValue) || inputValue === '') {
      setInputValue('0');
      const updateEvent = new CustomEvent("updateNodeData", {
        detail: { 
          id: props.id, 
          data: { ...props.data, value: 0 }
        },
        bubbles: true,
      });
      document.dispatchEvent(updateEvent);
    }
  };

  // Sync input value when props change
  useEffect(() => {
    setInputValue(props.data.value.toString());
  }, [props.data.value]);

  const formatValue = (val: number) => {
    const formattedValue = props.data.integerOnly 
      ? Math.round(val)
      : val.toFixed(props.data.precision);
    return props.data.unit 
      ? `${formattedValue} ${props.data.unit}`
      : formattedValue;
  };

  const handleModalSave = (updatedData: Partial<NumberParamData>) => {
    // Update node data - this will be handled by parent component
    const updateEvent = new CustomEvent("updateNodeData", {
      detail: { 
        id: props.id, 
        data: { ...props.data, ...updatedData }
      },
      bubbles: true,
    });
    document.dispatchEvent(updateEvent);
    setIsModalOpen(false);
  };

  return (
    <>
      <div
        className={clsx(
          "bg-gradient-to-br from-purple-900 to-purple-700 rounded-lg border-2 border-purple-500 p-2 min-w-[200px] relative transition-all",
          hovering && "border-purple-400 shadow-lg shadow-purple-500/30"
        )}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        onDoubleClick={handleNodeDoubleClick}
      >
        {/* Delete button */}
        {hovering && (
          <button
            onClick={handleDelete}
            className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600 transition-colors z-10"
          >
            ✕
          </button>
        )}

        {/* Parameter icon */}
        <div className="absolute top-2 right-2 text-purple-300">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
          </svg>
        </div>

        <div className="px-1">
          <h3 className="text-white font-semibold text-sm mb-0.5">
            {props.data.paramLabel || props.data.title || "Number Parameter"}
          </h3>
          <p className="text-purple-200 text-xs mb-1">
            {props.data.paramDescription || props.data.description || "Number value parameter"}
          </p>
          
          {/* Value editor with number input */}
          <div className="bg-purple-950/50 rounded p-1 mb-1">
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={inputValue}
                onChange={(e) => handleValueChange(e.target.value)}
                onBlur={handleBlur}
                min={props.data.minValue ?? undefined}
                max={props.data.maxValue ?? undefined}
                step={props.data.step}
                className="flex-1 px-2 py-0.5 bg-purple-900/50 text-white text-sm rounded border border-purple-700 focus:border-purple-500 focus:outline-none text-center no-spinner"
                onClick={(e) => e.stopPropagation()}
                onWheel={(e) => {
                  e.preventDefault();
                  e.currentTarget.blur();
                }}
                onMouseDown={(e) => e.stopPropagation()}
              />
              {props.data.unit && (
                <span className="text-purple-300 text-sm">{props.data.unit}</span>
              )}
            </div>
          </div>

          <button
            className="w-full text-xs bg-purple-600 text-white px-2 py-1 rounded hover:bg-purple-500 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              handleNodeDoubleClick();
            }}
          >
            ⚙️ Configure Parameters
          </button>
        </div>

        <Handle
          type="target"
          position={Position.Left}
          className="w-3 h-3 bg-purple-400"
          style={{
            left: -6,
            top: "50%",
            transform: "translateY(-50%)",
          }}
        />

        <Handle
          type="source"
          position={Position.Right}
          className="w-3 h-3 bg-purple-400"
          style={{
            right: -6,
            top: "50%",
            transform: "translateY(-50%)",
          }}
        />
      </div>

      {/* Parameter configuration modal */}
      {isModalOpen && (
        <ParamNodeModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSave={handleModalSave}
          data={props.data}
          nodeId={props.id}
        />
      )}
    </>
  );
}