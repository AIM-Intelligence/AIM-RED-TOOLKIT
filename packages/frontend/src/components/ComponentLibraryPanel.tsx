import { useState } from "react";
import { Panel } from "@xyflow/react";
import { componentLibrary, type ComponentTemplate } from "../config/componentLibrary";

interface ComponentLibraryPanelProps {
  onComponentSelect: (component: ComponentTemplate) => void;
  isOpen: boolean;
  onToggle: () => void;
}

export default function ComponentLibraryPanel({
  onComponentSelect,
  isOpen,
  onToggle,
}: ComponentLibraryPanelProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(componentLibrary.map(cat => cat.id))
  );
  const [searchTerm, setSearchTerm] = useState("");

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
  };

  // Filter components based on search
  const filteredLibrary = componentLibrary.map(category => ({
    ...category,
    components: category.components.filter(comp =>
      comp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      comp.description.toLowerCase().includes(searchTerm.toLowerCase())
    )
  })).filter(category => category.components.length > 0);

  return (
    <>
      {/* Toggle Button */}
      <Panel position="top-left" style={{ top: "200px" }}>
        <button
          onClick={onToggle}
          className="px-4 py-2 bg-neutral-800 text-white rounded-lg hover:bg-neutral-700 transition-colors flex items-center gap-2 border border-neutral-600"
        >
          <span className="text-lg">{isOpen ? "📚" : "📖"}</span>
          <span className="font-medium">Components</span>
        </button>
      </Panel>

      {/* Library Panel */}
      {isOpen && (
        <Panel
          position="top-left" 
          className="bg-neutral-900 border border-neutral-700 rounded-lg shadow-2xl max-h-[60vh] overflow-hidden flex flex-col"
          style={{ width: "280px", top: "250px" }}
        >
          {/* Header */}
          <div className="p-3 border-b border-neutral-700">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-white font-semibold">Components</h3>
              <button
                onClick={onToggle}
                className="text-neutral-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>
            
            {/* Search */}
            <input
              type="text"
              placeholder="Search components..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-1.5 bg-neutral-800 text-white rounded border border-neutral-600 focus:border-red-500 focus:outline-none text-sm"
            />
          </div>

          {/* Categories */}
          <div className="flex-1 overflow-y-auto p-2">
            {filteredLibrary.length === 0 ? (
              <div className="text-neutral-500 text-center py-4 text-sm">
                No components found
              </div>
            ) : (
              filteredLibrary.map(category => (
                <div key={category.id} className="mb-2">
                  {/* Category Header */}
                  <button
                    onClick={() => toggleCategory(category.id)}
                    className="w-full flex items-center justify-between px-2 py-1.5 hover:bg-neutral-800 rounded transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-neutral-400 text-xs">
                        {expandedCategories.has(category.id) ? "▼" : "▶"}
                      </span>
                      <span className="text-lg">{category.icon}</span>
                      <span className="text-white text-sm font-medium">
                        {category.name}
                      </span>
                    </div>
                    <span className="text-neutral-500 text-xs">
                      {category.components.length}
                    </span>
                  </button>

                  {/* Components */}
                  {expandedCategories.has(category.id) && (
                    <div className="ml-4 mt-1">
                      {category.components.map(component => (
                        <button
                          key={component.id}
                          onClick={() => onComponentSelect(component)}
                          className="w-full flex items-start gap-2 px-2 py-2 hover:bg-neutral-800 rounded transition-colors group"
                        >
                          <span className="text-lg mt-0.5">{component.icon}</span>
                          <div className="flex-1 text-left">
                            <div className="text-white text-sm group-hover:text-red-400 transition-colors">
                              {component.name}
                            </div>
                            <div className="text-neutral-500 text-xs mt-0.5">
                              {component.description}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-2 border-t border-neutral-700">
            <div className="text-neutral-500 text-xs text-center">
              Click component to add to canvas
            </div>
          </div>
        </Panel>
      )}
    </>
  );
}