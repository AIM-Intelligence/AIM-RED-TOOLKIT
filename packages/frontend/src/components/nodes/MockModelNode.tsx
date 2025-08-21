import { Handle, Position } from '@xyflow/react';
import { memo, useEffect } from 'react';

interface MockModelNodeProps {
  data: {
    title?: string;
    description?: string;
    viewCode?: () => void;
  };
  id: string;
}

function MockModelNode({ data, id }: MockModelNodeProps) {
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    console.log('MockModelNode: Delete button clicked for node:', id);
    const deleteEvent = new CustomEvent('deleteNode', { 
      detail: { id },
      bubbles: true
    });
    // Use document.dispatchEvent instead of window.dispatchEvent
    document.dispatchEvent(deleteEvent);
    console.log('MockModelNode: Delete event dispatched');
  };

  return (
    <div 
      className="bg-gradient-to-br from-orange-500 to-yellow-600 rounded-lg shadow-lg p-4 min-w-[200px] relative group"
      data-testid={`mockmodel-${id}`}
      data-id={id}
    >
      {/* Delete button */}
      <button
        onClick={handleDelete}
        className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 flex items-center justify-center text-xs z-50"
        title="Delete node"
        style={{ zIndex: 1000 }}
      >
        ×
      </button>
      
      {/* View Code button */}
      <button
        onClick={data.viewCode}
        className="absolute top-1 right-1 w-5 h-5 bg-white/20 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/30 flex items-center justify-center"
        title="View code"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
        </svg>
      </button>
      
      {/* Input handles */}
      <Handle
        type="target"
        position={Position.Left}
        id="temperature"
        style={{ top: '30%', background: '#4b5563' }}
        title="Temperature input"
      />
      <Handle
        type="target"
        position={Position.Left}
        id="prompt"
        style={{ top: '70%', background: '#4b5563' }}
        title="Prompt input (optional)"
      />
      
      {/* Node content */}
      <div className="text-white">
        <div className="font-bold text-sm mb-1">
          🤖 {data.title || `Mock Model ${id}`}
        </div>
        <div className="text-xs opacity-90">
          {data.description || 'Simulates LLM generation'}
        </div>
      </div>
      
      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Right}
        style={{ background: '#10b981' }}
        title="Generated text output"
      />
    </div>
  );
}

export default memo(MockModelNode);