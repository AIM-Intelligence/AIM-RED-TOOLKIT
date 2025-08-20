import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import type { NumberParamData } from "./NumberParamNode";

interface ParamNodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<NumberParamData>) => void;
  data: NumberParamData;
  nodeId: string;
}

export default function ParamNodeModal({
  isOpen,
  onClose,
  onSave,
  data,
  nodeId,
}: ParamNodeModalProps) {
  const [formData, setFormData] = useState({
    paramName: data.paramName || "parameter",
    paramLabel: data.paramLabel || "Parameter",
    paramDescription: data.paramDescription || "",
    value: data.value ?? 0,
    minValue: data.minValue ?? null,
    maxValue: data.maxValue ?? null,
    step: data.step || 1,
    unit: data.unit || "",
    precision: data.precision ?? 2,
    integerOnly: data.integerOnly ?? false,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.paramName.trim()) {
      newErrors.paramName = "Parameter name is required";
    }

    if (!formData.paramLabel.trim()) {
      newErrors.paramLabel = "Label is required";
    }

    if (formData.minValue !== null && formData.maxValue !== null) {
      if (formData.minValue >= formData.maxValue) {
        newErrors.range = "Min value must be less than max value";
      }
    }

    if (formData.minValue !== null && formData.value < formData.minValue) {
      newErrors.value = `Value must be at least ${formData.minValue}`;
    }

    if (formData.maxValue !== null && formData.value > formData.maxValue) {
      newErrors.value = `Value must not exceed ${formData.maxValue}`;
    }

    if (formData.step <= 0) {
      newErrors.step = "Step must be greater than 0";
    }

    if (formData.precision < 0) {
      newErrors.precision = "Precision must be non-negative";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    // Save to backend
    try {
      const code = generateNodeCode();
      const response = await fetch("/api/code/savecode", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          project_id: window.location.pathname.split("/").pop(),
          node_id: nodeId,
          code: code,
        }),
      });

      if (response.ok) {
        // Update the node data with new values
        onSave({
          ...formData,
          title: formData.paramLabel, // Update node title
          description: formData.paramDescription || "Number parameter",
        });
        console.log("Parameter saved successfully!");
      } else {
        const errorText = await response.text();
        console.error("Failed to save node code:", errorText);
        alert("Failed to save parameter. Please try again.");
      }
    } catch (error) {
      console.error("Error saving node:", error);
      alert("Error saving parameter. Please try again.");
    }
  };

  const generateNodeCode = () => {
    // Generate Python code based on form data
    return `"""
NumberValue Parameter Node
This node creates a NumberValue parameter that can be passed to other nodes
"""

from aim_params import NumberValue
from aim_params.core.metadata import UIMetadata

# Parameter configuration
param_name = "${formData.paramName}"
param_label = "${formData.paramLabel}"
param_description = "${formData.paramDescription}"
value = ${formData.value}
min_value = ${formData.minValue === null ? 'None' : formData.minValue}
max_value = ${formData.maxValue === null ? 'None' : formData.maxValue}
step = ${formData.step}
unit = "${formData.unit}"
precision = ${formData.precision}
integer_only = ${formData.integerOnly ? "True" : "False"}

# Create NumberValue parameter
param = NumberValue(
    name=param_name,
    ui_metadata=UIMetadata(
        label=param_label,
        description=param_description,
        default=value,
        required=True,
        editable=True
    ),
    value=value,
    min_value=min_value if min_value is not None else None,
    max_value=max_value if max_value is not None else None,
    step=step if step > 0 else None,
    unit=unit if unit else None,
    precision=precision if precision >= 0 else None,
    integer_only=integer_only
)

# Display parameter info
print(f"Created NumberValue parameter: {param_name}")
print(f"  Label: {param_label}")
print(f"  Value: {param.format_display()}")
print(f"  Range: {min_value} - {max_value}")
print(f"  Integer only: {integer_only}")

# Pass parameter to next nodes
output_data = {
    "parameter": param,
    "name": param_name,
    "value": param.value,
    "metadata": {
        "type": "NumberValue",
        "min": min_value,
        "max": max_value,
        "step": step,
        "unit": unit,
        "integer_only": integer_only
    }
}`;
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: "" }));
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center z-[10000] backdrop-blur-lg bg-black/50 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="bg-[#0a0a0a] rounded-xl overflow-y-auto shadow-2xl p-8"
        style={{
          width: "40vw",
          maxWidth: "1200px",
          minWidth: "800px",
          maxHeight: "85vh"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-900/50 rounded-lg">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="text-purple-400">
                <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Configure Number Parameter</h2>
              <p className="text-gray-400 text-sm mt-1">Set up numerical value constraints and display options</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-all"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="bg-gray-900/50 rounded-lg p-6 space-y-4">
            <h3 className="text-purple-400 font-semibold text-lg flex items-center gap-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
              </svg>
              Basic Information
            </h3>
            
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-gray-300 text-sm mb-2 font-medium">Parameter Name</label>
                <input
                  type="text"
                  value={formData.paramName}
                  onChange={(e) => handleInputChange("paramName", e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-800 text-white rounded-lg border border-gray-700 focus:border-purple-500 focus:outline-none transition-colors"
                  placeholder="e.g., num_iterations"
                />
                {errors.paramName && <p className="text-red-400 text-xs mt-1">{errors.paramName}</p>}
              </div>

              <div>
                <label className="block text-gray-300 text-sm mb-2 font-medium">Display Label</label>
                <input
                  type="text"
                  value={formData.paramLabel}
                  onChange={(e) => handleInputChange("paramLabel", e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-800 text-white rounded-lg border border-gray-700 focus:border-purple-500 focus:outline-none transition-colors"
                  placeholder="e.g., Number of Iterations"
                />
                {errors.paramLabel && <p className="text-red-400 text-xs mt-1">{errors.paramLabel}</p>}
              </div>
            </div>

            <div>
              <label className="block text-gray-300 text-sm mb-2 font-medium">Description</label>
              <textarea
                value={formData.paramDescription}
                onChange={(e) => handleInputChange("paramDescription", e.target.value)}
                className="w-full px-4 py-2.5 bg-gray-800 text-white rounded-lg border border-gray-700 focus:border-purple-500 focus:outline-none resize-none transition-colors"
                rows={2}
                placeholder="Optional description of what this parameter controls..."
              />
            </div>
          </div>

          {/* Value Configuration */}
          <div className="bg-gray-900/50 rounded-lg p-6 space-y-4">
            <h3 className="text-purple-400 font-semibold text-lg flex items-center gap-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
              </svg>
              Value Configuration
            </h3>

            <div>
              <label className="block text-gray-300 text-sm mb-2 font-medium">
                Value
              </label>
              <input
                type="number"
                value={formData.value}
                onChange={(e) => handleInputChange("value", parseFloat(e.target.value))}
                step={formData.step}
                className="w-full px-4 py-2.5 bg-gray-800 text-white rounded-lg border border-gray-700 focus:border-purple-500 focus:outline-none transition-colors"
              />
              {errors.value && <p className="text-red-400 text-xs mt-1">{errors.value}</p>}
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-gray-300 text-sm mb-2 font-medium">Min Value</label>
                <input
                  type="number"
                  value={formData.minValue ?? ""}
                  onChange={(e) => handleInputChange("minValue", e.target.value ? parseFloat(e.target.value) : null)}
                  className="w-full px-4 py-2.5 bg-gray-800 text-white rounded-lg border border-gray-700 focus:border-purple-500 focus:outline-none transition-colors"
                  placeholder="No minimum"
                />
              </div>

              <div>
                <label className="block text-gray-300 text-sm mb-2 font-medium">Max Value</label>
                <input
                  type="number"
                  value={formData.maxValue ?? ""}
                  onChange={(e) => handleInputChange("maxValue", e.target.value ? parseFloat(e.target.value) : null)}
                  className="w-full px-4 py-2.5 bg-gray-800 text-white rounded-lg border border-gray-700 focus:border-purple-500 focus:outline-none transition-colors"
                  placeholder="No maximum"
                />
              </div>
            </div>
            {errors.range && <p className="text-red-400 text-xs">{errors.range}</p>}

            <div className="grid grid-cols-3 gap-6">
              <div>
                <label className="block text-gray-300 text-sm mb-2 font-medium">Step</label>
                <input
                  type="number"
                  value={formData.step}
                  onChange={(e) => handleInputChange("step", parseFloat(e.target.value))}
                  min="0.001"
                  step="0.001"
                  className="w-full px-4 py-2.5 bg-gray-800 text-white rounded-lg border border-gray-700 focus:border-purple-500 focus:outline-none transition-colors"
                />
                {errors.step && <p className="text-red-400 text-xs mt-1">{errors.step}</p>}
              </div>

              <div>
                <label className="block text-gray-300 text-sm mb-2 font-medium">Precision</label>
                <input
                  type="number"
                  value={formData.precision}
                  onChange={(e) => handleInputChange("precision", parseInt(e.target.value))}
                  min="0"
                  max="10"
                  className="w-full px-4 py-2.5 bg-gray-800 text-white rounded-lg border border-gray-700 focus:border-purple-500 focus:outline-none transition-colors"
                />
                {errors.precision && <p className="text-red-400 text-xs mt-1">{errors.precision}</p>}
              </div>

              <div>
                <label className="block text-gray-300 text-sm mb-2 font-medium">Unit</label>
                <input
                  type="text"
                  value={formData.unit}
                  onChange={(e) => handleInputChange("unit", e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-800 text-white rounded-lg border border-gray-700 focus:border-purple-500 focus:outline-none transition-colors"
                  placeholder="e.g., ms, %"
                />
              </div>
            </div>
          </div>

          {/* Options */}
          <div className="bg-gray-900/50 rounded-lg p-6 space-y-4">
            <h3 className="text-purple-400 font-semibold text-lg flex items-center gap-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/>
              </svg>
              Options
            </h3>

            <label className="flex items-center p-3 bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-750 transition-colors">
              <input
                type="checkbox"
                checked={formData.integerOnly}
                onChange={(e) => handleInputChange("integerOnly", e.target.checked)}
                className="mr-3 w-5 h-5 rounded bg-gray-700 border-gray-600 text-purple-500 focus:ring-purple-500 focus:ring-offset-0"
              />
              <div>
                <span className="text-white font-medium">Integer Only</span>
                <p className="text-gray-400 text-xs mt-0.5">Accept only whole numbers</p>
              </div>
            </label>
          </div>

          {/* Preview */}
          {formData.value !== null && (
            <div className="bg-gradient-to-r from-purple-900/30 to-indigo-900/30 rounded-lg p-4 border border-purple-600/50">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-300 text-sm mb-2 font-medium">Live Preview</p>
                  <p className="text-white text-2xl font-mono">
                    {formData.integerOnly 
                      ? Math.round(formData.value)
                      : formData.value.toFixed(formData.precision)}
                    {formData.unit && <span className="text-purple-300 ml-2">{formData.unit}</span>}
                  </p>
                </div>
                <div className="text-purple-400">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor" opacity="0.5">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                  </svg>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2 border-t border-gray-800">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-500 hover:to-indigo-500 transition-all font-medium shadow-lg shadow-purple-500/25"
            >
              Save Parameter
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}