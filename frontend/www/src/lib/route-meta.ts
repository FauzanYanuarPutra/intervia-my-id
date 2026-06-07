// // src/lib/route-meta.ts
// import { routes } from '@/lib/routes';

// function matchRoute(path: string) {
//     return routes.find(r =>
//         path === r.path ||
//         path.startsWith(r.path + '/')
//     );
// }

// export function getRouteMeta(path: string) {
//     const route = matchRoute(path);

//     return route?.meta ?? {
//         navbar: { isVisibleOnWeb: true, isVisibleOnMobile: true },
//         bottomNav: { isVisibleOnWeb: true, isVisibleOnMobile: true },
//         footer: { isVisibleOnWeb: true, isVisibleOnMobile: true },
//     };
// }