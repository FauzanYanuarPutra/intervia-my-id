export function logSuperAppEvent(event: string, payload: Record<string, unknown>) {
  console.info(
    JSON.stringify({
      ts: new Date().toISOString(),
      scope: 'super_app',
      event,
      ...payload,
    }),
  );
}

