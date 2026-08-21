import { NextResponse } from 'next/server';
import {
  readStackStartupState,
  type StackStartupState,
} from '@/lib/system/startupState';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HEALTH_ENDPOINTS = [
  {
    service: 'identity_service',
    url: `${process.env.INTERNAL_API_URL || 'http://identity_service:8080'}/health`,
  },
  {
    service: 'marketplace_service',
    url: `${process.env.INTERNAL_MARKETPLACE_URL || 'http://marketplace_service:8081'}/health`,
  },
  {
    service: 'community_service',
    url: `${process.env.INTERNAL_COMMUNITY_URL || 'http://community_service:8082'}/health`,
  },
  {
    service: 'chat_service',
    url: `${process.env.INTERNAL_CHAT_URL || 'http://chat_service:4000'}/api/health`,
  },
];

async function probeDependencyState(): Promise<StackStartupState | null> {
  if (process.env.STACK_STARTUP_PROBE_DEPS !== 'true') return null;

  const results = await Promise.all(
    HEALTH_ENDPOINTS.map(async endpoint => {
      try {
        const response = await fetch(endpoint.url, {
          cache: 'no-store',
          signal: AbortSignal.timeout(1200),
        });
        return {
          service: endpoint.service,
          ok: response.ok,
        };
      } catch {
        return {
          service: endpoint.service,
          ok: false,
        };
      }
    }),
  );
  const unavailable = results
    .filter(result => !result.ok)
    .map(result => result.service);

  if (unavailable.length === 0) return null;

  const now = new Date().toISOString();
  return {
    active: true,
    status: 'starting_services',
    phase: 'waiting_for_services',
    message: 'Waiting for Docker services to become healthy.',
    script: 'docker-compose',
    services: unavailable,
    updatedAt: now,
  };
}

export async function GET() {
  const fileState = readStackStartupState();
  // Only use live dependency probing while startup is explicitly active.
  // This prevents the maintenance screen from reappearing forever just because
  // one backend health endpoint is temporarily unavailable after startup.
  const state = fileState.active
    ? (await probeDependencyState()) || fileState
    : fileState;

  return NextResponse.json(state, {
    headers: {
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}
