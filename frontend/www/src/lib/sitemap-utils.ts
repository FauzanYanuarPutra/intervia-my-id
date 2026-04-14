import { RouteConfig, Role } from './routes';

export function collectPublicPaths(
  routes: RouteConfig[],
  parentPath = '',
): string[] {
  let paths: string[] = [];

  for (const route of routes) {
    // Skip dynamic & context route
    if (route.path.includes(':')) continue;

    const fullPath = route.path.startsWith('/')
      ? route.path
      : `${parentPath}/${route.path}`;

    const isPublic =
      route.shared === true || route.access?.includes(Role.GUEST);

    if (isPublic) {
      paths.push(fullPath);
    }

    if (route.children) {
      paths = paths.concat(collectPublicPaths(route.children, fullPath));
    }
  }

  return paths;
}
