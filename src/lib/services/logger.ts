import { writable, get } from 'svelte/store';
import { safeInvoke } from '../api/tauri';

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  message: string;
}

const MAX_STORED_LOGS = 500;

function createLogger() {
  const { subscribe, set, update } = writable<LogEntry[]>([]);

  let isInitialized = false;

  function addEntry(level: 'INFO' | 'WARN' | 'ERROR', message: string, rawTimestamp?: string) {
    const now = rawTimestamp || new Date().toISOString().replace('T', ' ').substring(0, 23);
    const entry: LogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      timestamp: now,
      level,
      message
    };

    update(logs => {
      const next = [...logs, entry];
      if (next.length > MAX_STORED_LOGS) {
        return next.slice(next.length - MAX_STORED_LOGS);
      }
      return next;
    });

    // Envia de forma assíncrona para persistir no pulsar.log no disco
    safeInvoke('write_client_log', { level, message }).catch(() => {});
  }

  return {
    subscribe,

    init() {
      if (isInitialized) return;
      isInitialized = true;

      // Interceptar console nativo
      if (typeof window !== 'undefined') {
        const origLog = console.log;
        const origWarn = console.warn;
        const origError = console.error;

        console.log = (...args: any[]) => {
          origLog.apply(console, args);
          const msg = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
          addEntry('INFO', msg);
        };

        console.warn = (...args: any[]) => {
          origWarn.apply(console, args);
          const msg = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
          addEntry('WARN', msg);
        };

        console.error = (...args: any[]) => {
          origError.apply(console, args);
          const msg = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
          addEntry('ERROR', msg);
        };

        // Capturar erros globais da janela
        window.addEventListener('error', (event) => {
          addEntry('ERROR', `[Uncaught] ${event.message} (${event.filename}:${event.lineno})`);
        });

        window.addEventListener('unhandledrejection', (event) => {
          addEntry('ERROR', `[UnhandledPromise] ${event.reason}`);
        });

        // Carregar histórico inicial de logs do Rust
        this.syncBackendLogs();
      }
    },

    info(msg: string) {
      console.log(msg);
    },

    warn(msg: string) {
      console.warn(msg);
    },

    error(msg: string) {
      console.error(msg);
    },

    clear() {
      set([]);
    },

    async syncBackendLogs() {
      try {
        const rawBackendLogs = await safeInvoke<string[]>('get_system_logs');
        if (Array.isArray(rawBackendLogs) && rawBackendLogs.length > 0) {
          const parsed: LogEntry[] = rawBackendLogs.map(line => {
            // Formato: [2026-09-11 19:30:00.123] [INFO] Mensagem
            const match = line.match(/^\[(.*?)\]\s+\[(INFO|WARN|ERROR)\]\s+(.*)$/);
            if (match) {
              return {
                id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                timestamp: match[1],
                level: match[2] as 'INFO' | 'WARN' | 'ERROR',
                message: match[3]
              };
            }
            return {
              id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
              timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
              level: 'INFO',
              message: line
            };
          });

          // Unir evitando duplicações
          update(current => {
            const combined = [...parsed, ...current];
            const unique = Array.from(new Map(combined.map(e => [e.timestamp + e.message, e])).values());
            return unique.slice(-MAX_STORED_LOGS);
          });
        }
      } catch (err) {
        // Ignora silenciosamente se o backend ainda não responder
      }
    },

    async openLogFolder() {
      await safeInvoke('open_logs_folder');
    },

    async copyLogsToClipboard(): Promise<boolean> {
      const logs = get(this);
      const text = logs.map(l => `[${l.timestamp}] [${l.level}] ${l.message}`).join('\n');
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        return false;
      }
    }
  };
}

export const logger = createLogger();
