import fs from 'node:fs';
import path from 'node:path';

export type StackStartupState = {
  active: boolean;
  status: 'idle' | 'starting' | 'building' | 'starting_services' | 'ready' | 'failed' | 'stale';
  phase: string;
  message?: string;
  script?: string;
  mode?: string;
  services?: string[];
  startedAt?: string;
  updatedAt?: string;
};

const STATE_FILENAME = 'stack-startup.json';
const DEFAULT_STALE_AFTER_MS = 1000 * 60 * 60 * 3;

const inactiveState: StackStartupState = {
  active: false,
  status: 'idle',
  phase: 'idle',
};

function getCandidateStatePaths() {
  const cwd = process.cwd();
  return [
    process.env.STACK_STARTUP_STATE_FILE,
    path.join(cwd, '.runtime', STATE_FILENAME),
    path.join(cwd, '..', '..', '.runtime', STATE_FILENAME),
    path.join('/app/www/.runtime', STATE_FILENAME),
  ].filter(Boolean) as string[];
}

function isStale(updatedAt?: string) {
  if (!updatedAt) return false;
  const updatedMs = Date.parse(updatedAt);
  if (!Number.isFinite(updatedMs)) return false;
  const staleAfterMs = Number.parseInt(
    process.env.STACK_STARTUP_STATE_STALE_AFTER_MS || '',
    10,
  );
  const maxAgeMs = Number.isFinite(staleAfterMs)
    ? staleAfterMs
    : DEFAULT_STALE_AFTER_MS;
  return Date.now() - updatedMs > maxAgeMs;
}

function readJsonFile(filePath: string): StackStartupState | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Partial<StackStartupState>;
    const state: StackStartupState = {
      active: parsed.active === true,
      status: parsed.status || (parsed.active ? 'starting' : 'idle'),
      phase: parsed.phase || (parsed.active ? 'starting' : 'idle'),
      message: parsed.message,
      script: parsed.script,
      mode: parsed.mode,
      services: Array.isArray(parsed.services)
        ? parsed.services.map(String).filter(Boolean)
        : undefined,
      startedAt: parsed.startedAt,
      updatedAt: parsed.updatedAt,
    };

    if (state.active && isStale(state.updatedAt)) {
      return {
        ...state,
        active: false,
        status: 'stale',
        phase: 'stale',
        message:
          'Startup state is stale. The app is allowed to render normally again.',
      };
    }

    return state;
  } catch {
    return null;
  }
}

export function readStackStartupState(): StackStartupState {
  for (const filePath of getCandidateStatePaths()) {
    const state = readJsonFile(filePath);
    if (state) return state;
  }

  return inactiveState;
}
