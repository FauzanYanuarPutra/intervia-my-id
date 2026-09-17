export async function loadOptionalList<T>(
  enabled: boolean,
  loader: () => Promise<T[]>,
): Promise<T[]> {
  if (!enabled) return [];

  try {
    return await loader();
  } catch {
    return [];
  }
}
