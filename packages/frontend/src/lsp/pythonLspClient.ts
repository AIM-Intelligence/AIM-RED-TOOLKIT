import * as monaco from 'monaco-editor';
import {
  MonacoLanguageClient,
  CloseAction,
  ErrorAction,
  MessageTransports,
} from 'monaco-languageclient';
import {
  toSocket,
  WebSocketMessageReader,
  WebSocketMessageWriter,
} from 'vscode-ws-jsonrpc';

export type LspType = 'pyright' | 'ruff';
export type LspStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'error';

export interface LspConnectionStatus {
  pyright: LspStatus;
  ruff: LspStatus;
}

export interface LSPConnection {
  dispose: () => void;
  restart: () => Promise<void>;
  getStatus: () => LspConnectionStatus;
}

interface ReconnectConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  jitter: number;
}

class LspClientConnection {
  private client: MonacoLanguageClient | null = null;
  private webSocket: WebSocket | null = null;
  private status: LspStatus = 'disconnected';
  private reconnectAttempt = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isDisposed = false;
  
  constructor(
    private lspType: LspType,
    private projectId: string,
    private onStatusChange: (status: LspStatus) => void,
    private reconnectConfig: ReconnectConfig = {
      maxAttempts: 10,
      baseDelay: 1000,
      maxDelay: 30000,
      jitter: 0.3
    }
  ) {}

  async connect(): Promise<void> {
    if (this.isDisposed) return;
    
    this.setStatus('connecting');
    
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const host = window.location.hostname;
    const port = window.location.port || (window.location.protocol === 'https:' ? '443' : '80');
    const endpoint = this.lspType === 'pyright' ? 'python' : 'ruff';
    const wsUrl = `${protocol}://${host}:${port}/api/lsp/${endpoint}?project_id=${encodeURIComponent(this.projectId)}`;

    try {
      this.webSocket = new WebSocket(wsUrl);
      
      // Handle WebSocket events
      this.webSocket.onclose = (event) => this.handleClose(event);
      this.webSocket.onerror = (error) => this.handleError(error);
      
      // Wait for connection
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Connection timeout')), 10000);
        
        this.webSocket!.onopen = () => {
          clearTimeout(timeout);
          resolve();
        };
        
        this.webSocket!.onerror = (error) => {
          clearTimeout(timeout);
          reject(error);
        };
      });

      // Create Monaco Language Client
      const socket = toSocket(this.webSocket);
      const reader = new WebSocketMessageReader(socket);
      const writer = new WebSocketMessageWriter(socket);
      const transports: MessageTransports = { reader, writer };

      this.client = new MonacoLanguageClient({
        name: `${this.lspType === 'pyright' ? 'Pyright' : 'Ruff'} Language Server`,
        clientOptions: {
          documentSelector: [{ language: 'python' }],
          errorHandler: {
            error: () => ({ action: ErrorAction.Continue }),
            closed: () => ({ action: CloseAction.DoNotRestart }), // We handle restart ourselves
          },
          synchronize: {
            fileEvents: [
              monaco.languages.createFilesystemWatcher('**/*.py'),
            ],
          },
          initializationOptions: this.getInitializationOptions(),
        },
        connectionProvider: {
          get: async () => transports,
        },
      });

      await this.client.start();
      
      this.setStatus('connected');
      this.reconnectAttempt = 0;
      console.log(`${this.lspType} LSP connected successfully`);
      
    } catch (error) {
      console.error(`Failed to connect to ${this.lspType} LSP:`, error);
      this.setStatus('error');
      this.scheduleReconnect();
    }
  }

  private getInitializationOptions(): any {
    if (this.lspType === 'pyright') {
      return {
        python: {
          analysis: {
            autoImportCompletions: true,
            autoSearchPaths: true,
            useLibraryCodeForTypes: true,
            typeCheckingMode: 'standard',
            diagnosticMode: 'workspace',
          },
        },
      };
    } else {
      return {
        settings: {
          lineLength: 88,
          // Add more Ruff configuration as needed
        },
      };
    }
  }

  private handleClose(event: CloseEvent): void {
    console.log(`${this.lspType} WebSocket closed:`, event.code, event.reason);
    
    // Check close code to determine if we should reconnect
    const shouldReconnect = 
      event.code === 4001 || // LSP restarting
      event.code === 4003 || // LSP crashed
      event.code === 1006 || // Abnormal closure
      event.code === 1001;   // Going away
    
    if (shouldReconnect && !this.isDisposed) {
      this.setStatus('reconnecting');
      this.scheduleReconnect();
    } else {
      this.setStatus('disconnected');
    }
  }

  private handleError(error: Event): void {
    console.error(`${this.lspType} WebSocket error:`, error);
    this.setStatus('error');
  }

  private scheduleReconnect(): void {
    if (this.isDisposed || this.reconnectTimer) return;
    
    if (this.reconnectAttempt >= this.reconnectConfig.maxAttempts) {
      console.error(`${this.lspType}: Max reconnection attempts reached`);
      this.setStatus('error');
      return;
    }
    
    this.reconnectAttempt++;
    
    // Calculate delay with exponential backoff and jitter
    const baseDelay = Math.min(
      this.reconnectConfig.baseDelay * Math.pow(2, this.reconnectAttempt - 1),
      this.reconnectConfig.maxDelay
    );
    const jitter = baseDelay * this.reconnectConfig.jitter * Math.random();
    const delay = baseDelay + jitter;
    
    console.log(`${this.lspType}: Scheduling reconnect attempt ${this.reconnectAttempt} in ${Math.round(delay)}ms`);
    
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private setStatus(status: LspStatus): void {
    this.status = status;
    this.onStatusChange(status);
  }

  getStatus(): LspStatus {
    return this.status;
  }

  async restart(): Promise<void> {
    this.dispose();
    this.isDisposed = false;
    this.reconnectAttempt = 0;
    await this.connect();
  }

  dispose(): void {
    this.isDisposed = true;
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    if (this.client) {
      try {
        this.client.stop();
      } catch (e) {
        console.error(`Error stopping ${this.lspType} client:`, e);
      }
      this.client = null;
    }
    
    if (this.webSocket) {
      try {
        this.webSocket.close();
      } catch (e) {
        console.error(`Error closing ${this.lspType} WebSocket:`, e);
      }
      this.webSocket = null;
    }
    
    this.setStatus('disconnected');
  }
}

class PythonLSPClient {
  private pyrightConnection: LspClientConnection | null = null;
  private ruffConnection: LspClientConnection | null = null;
  private projectId: string | null = null;
  private statusListeners: Set<(status: LspConnectionStatus) => void> = new Set();
  private currentStatus: LspConnectionStatus = {
    pyright: 'disconnected',
    ruff: 'disconnected',
  };

  /**
   * Connect to both Pyright and Ruff LSP servers with auto-reconnect
   */
  async connect(projectId: string): Promise<LSPConnection> {
    // Disconnect existing connections if any
    this.disconnect();

    this.projectId = projectId;

    // Create connections with status callbacks
    this.pyrightConnection = new LspClientConnection(
      'pyright',
      projectId,
      (status) => this.updateStatus('pyright', status)
    );

    this.ruffConnection = new LspClientConnection(
      'ruff',
      projectId,
      (status) => this.updateStatus('ruff', status)
    );

    // Start connections
    await Promise.all([
      this.pyrightConnection.connect().catch(e => 
        console.error('Pyright initial connection failed:', e)
      ),
      this.ruffConnection.connect().catch(e => 
        console.error('Ruff initial connection failed:', e)
      ),
    ]);

    return {
      dispose: () => this.disconnect(),
      restart: async () => {
        await this.restart();
      },
      getStatus: () => ({ ...this.currentStatus }),
    };
  }

  private updateStatus(lspType: 'pyright' | 'ruff', status: LspStatus): void {
    this.currentStatus[lspType] = status;
    this.notifyStatusListeners();
  }

  private notifyStatusListeners(): void {
    this.statusListeners.forEach(listener => {
      listener({ ...this.currentStatus });
    });
  }

  /**
   * Subscribe to status changes
   */
  onStatusChange(listener: (status: LspConnectionStatus) => void): () => void {
    this.statusListeners.add(listener);
    // Immediately notify with current status
    listener({ ...this.currentStatus });
    
    // Return unsubscribe function
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  /**
   * Disconnect from all LSP servers
   */
  disconnect(): void {
    if (this.pyrightConnection) {
      this.pyrightConnection.dispose();
      this.pyrightConnection = null;
    }

    if (this.ruffConnection) {
      this.ruffConnection.dispose();
      this.ruffConnection = null;
    }

    this.projectId = null;
    this.currentStatus = {
      pyright: 'disconnected',
      ruff: 'disconnected',
    };
    this.notifyStatusListeners();
  }

  /**
   * Restart LSP connections (useful after package installation)
   */
  async restart(): Promise<void> {
    if (!this.projectId) {
      throw new Error('No project ID set');
    }

    const projectId = this.projectId;
    
    // Restart connections
    await Promise.all([
      this.pyrightConnection?.restart().catch(e => 
        console.error('Pyright restart failed:', e)
      ),
      this.ruffConnection?.restart().catch(e => 
        console.error('Ruff restart failed:', e)
      ),
    ]);
  }

  /**
   * Manually restart a specific LSP server via API
   */
  async restartServer(lspType: LspType): Promise<void> {
    if (!this.projectId) {
      throw new Error('No project ID set');
    }

    try {
      const response = await fetch(`/api/lsp/restart/${lspType}?project_id=${encodeURIComponent(this.projectId)}`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(`Failed to restart ${lspType} server`);
      }

      // Wait a bit for server to restart
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Reconnect the client
      if (lspType === 'pyright' && this.pyrightConnection) {
        await this.pyrightConnection.restart();
      } else if (lspType === 'ruff' && this.ruffConnection) {
        await this.ruffConnection.restart();
      }
    } catch (error) {
      console.error(`Failed to restart ${lspType} server:`, error);
      throw error;
    }
  }

  /**
   * Get current connection status
   */
  getStatus(): LspConnectionStatus {
    return { ...this.currentStatus };
  }

  /**
   * Check if LSP is connected
   */
  isConnected(): boolean {
    return (
      this.currentStatus.pyright === 'connected' ||
      this.currentStatus.ruff === 'connected'
    );
  }
}

// Export singleton instance
export const pythonLspClient = new PythonLSPClient();