export const removeStyle = `
      .react-flow__renderer {
        background-color: transparent !important;
      }
      .react-flow__background {
        background-color: transparent !important;
      }
      .react-flow__pane {
        background-color: transparent !important;
      }
      .react-flow-transparent {
        background-color: transparent !important;
      }
      .react-flow-transparent .react-flow__renderer {
        background-color: transparent !important;
      }
        
      .react-flow__node.selected {
        box-shadow: none !important;
      }
      .react-flow__node-default {
        background: transparent !important;
        border: none !important;
      }

      .react-flow__node.selected .react-flow__handle {
        background: #555 !important;
        border-color: #555 !important;
      }
      .react-flow__node:focus {
        outline: none !important;
      }
      .react-flow__node:focus-visible {
        outline: none !important;
      }
    `;
