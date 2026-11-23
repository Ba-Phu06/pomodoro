import {
  App,
  applyDocumentTheme,
  applyHostStyleVariables,
} from '@modelcontextprotocol/ext-apps';

export interface McpBridgeCallbacks {
  onInput?: (args: unknown) => void;
  onResult?: (result: unknown) => void;
}

class McpClientBridge {
  private app: App | null = null;
  private connected = false;

  public isConnected(): boolean {
    return this.connected;
  }

  public async init(callbacks?: McpBridgeCallbacks): Promise<boolean> {
    if (typeof window === 'undefined') return false;

    try {
      this.app = new App({ name: 'Pomodoro', version: '1.0.0' }, {});

      this.app.ontoolinput = ({ arguments: args }) => {
        callbacks?.onInput?.(args);
      };

      this.app.ontoolresult = (res) => {
        const payload = (res as { structuredContent?: unknown }).structuredContent ?? res;
        callbacks?.onResult?.(payload);
      };

      this.app.onhostcontextchanged = (ctx) => {
        if (ctx.theme) applyDocumentTheme(ctx.theme);
        if (ctx.styles?.variables) applyHostStyleVariables(ctx.styles.variables);
      };

      // Connect with a 1.2s timeout for graceful standalone fallback
      const connectPromise = this.app.connect();
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Standalone browser fallback')), 1200)
      );

      await Promise.race([connectPromise, timeoutPromise]);
      this.connected = true;

      const hostContext = this.app.getHostContext();
      if (hostContext?.theme) applyDocumentTheme(hostContext.theme);
      if (hostContext?.styles?.variables) applyHostStyleVariables(hostContext.styles.variables);

      return true;
    } catch {
      this.connected = false;
      return false;
    }
  }

  public async callAppTool<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
    if (!this.connected || !this.app) {
      throw new Error(`MCP host not connected. Cannot call tool ${name}`);
    }

    const res = await this.app.callServerTool({ name, arguments: args });
    if (res.isError) {
      const errDetail = JSON.stringify(res.content ?? 'Unknown error');
      throw new Error(`Server tool ${name} returned error: ${errDetail}`);
    }

    const data = (res as { structuredContent?: unknown }).structuredContent;
    return (data !== undefined ? data : res) as T;
  }
}

export const mcpBridge = new McpClientBridge();

export async function callAppTool<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  return mcpBridge.callAppTool<T>(name, args);
}
