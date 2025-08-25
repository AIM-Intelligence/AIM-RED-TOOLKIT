import { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';
import '@xterm/xterm/css/xterm.css';

interface TerminalMessage {
  type: 'stdout' | 'ready' | 'exit' | 'error' | 'package_changed';
  data?: string;
  pid?: number;
  mode?: 'pkg' | 'shell';
  code?: number | null;
  signal?: string | null;
  message?: string;
  project_id?: string;
}

interface TerminalCommand {
  type: 'stdin' | 'resize' | 'heartbeat' | 'kill';
  data?: string;
  cols?: number;
  rows?: number;
}

interface ProjectTerminalProps {
  projectId: string;
  mode?: 'pkg' | 'shell';
  onExit?: (code: number | null) => void;
  onReady?: (pid: number) => void;
  onPackageChanged?: () => void;
  className?: string;
  height?: string;
}

export default function ProjectTerminal({ 
  projectId, 
  mode = 'pkg', 
  onExit, 
  onReady,
  onPackageChanged,
  className = '',
  height = '400px'
}: ProjectTerminalProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const webglRef = useRef<WebglAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [status, setStatus] = useState<'connecting' | 'ready' | 'closed' | 'reconnecting' | 'error'>('connecting');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const reconnectAttemptsRef = useRef(0);

  const sendCommand = useCallback((command: TerminalCommand) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(command));
    }
  }, []);

  const startHeartbeat = () => {
    // Clear existing heartbeat
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
    }
    
    // Send heartbeat every 30 seconds
    heartbeatRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'heartbeat' }));
      }
    }, 30000);
  };

  const stopHeartbeat = () => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  };

  const connect = useCallback(() => {
    // Clean up any existing connection
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setStatus('connecting');
    setErrorMessage('');
    
    const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
    const url = `${protocol}://${location.host}/executor/terminal?project_id=${encodeURIComponent(projectId)}&mode=${mode}`;
    
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('Terminal WebSocket connected');
      reconnectAttemptsRef.current = 0;
      startHeartbeat();
    };

    ws.onclose = (event) => {
      console.log('Terminal WebSocket closed', event.code, event.reason);
      stopHeartbeat();
      
      if (event.code === 1000) {
        // Normal closure
        setStatus('closed');
      } else if (reconnectAttemptsRef.current < 5) {
        // Attempt to reconnect with exponential backoff
        setStatus('reconnecting');
        const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 10000);
        reconnectAttemptsRef.current++;
        
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, delay);
      } else {
        setStatus('error');
        setErrorMessage('Failed to connect to terminal server');
      }
    };

    ws.onerror = (error) => {
      console.error('Terminal WebSocket error:', error);
      setStatus('error');
      setErrorMessage('WebSocket connection error');
    };

    ws.onmessage = (event) => {
      try {
        const msg: TerminalMessage = JSON.parse(event.data);
        
        switch (msg.type) {
          case 'stdout':
            if (msg.data && termRef.current) {
              termRef.current.write(msg.data);
            }
            break;
            
          case 'ready':
            setStatus('ready');
            if (msg.pid) {
              onReady?.(msg.pid);
            }
            // Fit terminal after ready
            if (fitRef.current) {
              setTimeout(() => fitRef.current?.fit(), 100);
            }
            break;
            
          case 'exit':
            setStatus('closed');
            onExit?.(msg.code ?? null);
            break;
            
          case 'error':
            setStatus('error');
            setErrorMessage(msg.message || 'Unknown error');
            if (msg.message && termRef.current) {
              termRef.current.write(`\r\n\x1b[31mError: ${msg.message}\x1b[0m\r\n`);
            }
            break;
            
          case 'package_changed':
            onPackageChanged?.();
            break;
        }
      } catch (error) {
        console.error('Failed to parse terminal message:', error);
      }
    };
  }, [projectId, mode, onExit, onReady, onPackageChanged]);

  useEffect(() => {
    if (!containerRef.current) return;

    // Create terminal instance
    const term = new Terminal({
      cursorBlink: true,
      convertEol: true,
      fontSize: 14,
      fontFamily: 'Consolas, "Courier New", monospace',
      theme: {
        background: '#1e1e1e',
        foreground: '#cccccc',
        cursor: '#ffffff',
        black: '#000000',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#2472c8',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#e5e5e5',
        brightBlack: '#666666',
        brightRed: '#f14c4c',
        brightGreen: '#23d18b',
        brightYellow: '#f5f543',
        brightBlue: '#3b8eea',
        brightMagenta: '#d670d6',
        brightCyan: '#29b8db',
        brightWhite: '#ffffff'
      }
    });

    // Create and load addons
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    
    // Try to load WebGL addon for better performance
    try {
      const webglAddon = new WebglAddon();
      webglAddon.onContextLoss(() => {
        webglAddon.dispose();
        webglRef.current = null;
      });
      term.loadAddon(webglAddon);
      webglRef.current = webglAddon;
    } catch (e) {
      console.warn('WebGL addon failed to load, using canvas renderer', e);
    }

    // Store references
    termRef.current = term;
    fitRef.current = fitAddon;

    // Open terminal in container
    term.open(containerRef.current);

    // Handle terminal input
    const onDataDisposable = term.onData((data) => {
      sendCommand({ type: 'stdin', data });
    });

    // Handle terminal resize
    const handleResize = () => {
      if (fitAddon && termRef.current) {
        fitAddon.fit();
        sendCommand({ 
          type: 'resize', 
          cols: term.cols, 
          rows: term.rows 
        });
      }
    };

    // Initial fit
    setTimeout(() => {
      fitAddon.fit();
      sendCommand({ 
        type: 'resize', 
        cols: term.cols, 
        rows: term.rows 
      });
    }, 0);

    // Add resize observer
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(containerRef.current);

    // Connect to WebSocket
    connect();

    // Cleanup
    return () => {
      // Clean up heartbeat
      stopHeartbeat();
      
      // Clean up reconnect timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      // Dispose terminal resources
      onDataDisposable.dispose();
      resizeObserver.disconnect();
      
      if (webglRef.current) {
        webglRef.current.dispose();
      }
      
      term.dispose();
      
      // Close WebSocket
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [projectId, mode]);

  const handleClear = () => {
    if (termRef.current) {
      termRef.current.clear();
    }
  };

  const handleKill = () => {
    sendCommand({ type: 'kill' });
  };

  const handleReconnect = () => {
    reconnectAttemptsRef.current = 0;
    connect();
  };

  const getStatusColor = () => {
    switch (status) {
      case 'ready': return 'text-green-500';
      case 'connecting': 
      case 'reconnecting': return 'text-yellow-500';
      case 'closed': return 'text-gray-500';
      case 'error': return 'text-red-500';
      default: return 'text-gray-400';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'ready': return `Terminal [${mode}] • Ready`;
      case 'connecting': return 'Connecting...';
      case 'reconnecting': return `Reconnecting... (${reconnectAttemptsRef.current}/5)`;
      case 'closed': return 'Terminal closed';
      case 'error': return errorMessage || 'Connection error';
      default: return 'Unknown';
    }
  };

  return (
    <div className={`flex flex-col bg-gray-900 rounded-lg border border-gray-700 ${className}`}>
      {/* Terminal Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700 bg-gray-800">
        <div className="flex items-center gap-2">
          <div className={`text-xs font-medium ${getStatusColor()}`}>
            {getStatusText()}
          </div>
          {mode === 'pkg' && (
            <span className="text-xs text-gray-500">
              (Package Console)
            </span>
          )}
        </div>
        
        <div className="flex gap-2">
          {status === 'error' && (
            <button
              className="text-xs px-2 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white transition-colors"
              onClick={handleReconnect}
            >
              Reconnect
            </button>
          )}
          <button
            className="text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
            onClick={handleClear}
            disabled={status !== 'ready'}
          >
            Clear
          </button>
          <button
            className="text-xs px-2 py-1 rounded bg-red-600 hover:bg-red-700 text-white transition-colors"
            onClick={handleKill}
            disabled={status !== 'ready'}
          >
            Kill
          </button>
        </div>
      </div>
      
      {/* Terminal Container */}
      <div 
        ref={containerRef} 
        className="flex-1 p-1"
        style={{ height, minHeight: '200px' }}
      />
    </div>
  );
}