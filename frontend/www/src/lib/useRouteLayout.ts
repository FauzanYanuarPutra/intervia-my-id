'use client';

import { useMemo, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation'; // 💡 Tambahkan useRouter untuk mengalihkan halaman
import { getPageMeta } from '@/config/pageMeta';

export function useRouteLayout() {
    const pathname = usePathname();
    const router = useRouter(); // 💡 Inisialisasi router Next.js

    const meta = useMemo(
        () => getPageMeta(pathname),
        [pathname],
    );

    console.log('[useRouteLayout]', {
        pathname,
        meta,
    });

    // 💡 VALIDASI GLOBAL: Jalankan efek pencegatan rute di sini
    useEffect(() => {
        if (meta?.isDisabled) {
            const matchLocale = pathname.match(/^\/([a-z]{2})(\/|$)/);
            const currentLocale = matchLocale?.[1] ?? 'id';

            const target = `/${currentLocale}/home`;

            // ❗ cegah redirect kalau sudah di target
            if (pathname !== target) {
                router.replace(target);
            }
        }
    }, [meta, pathname, router]);



    return {
        pathname,

        showTopBarMobile:
            meta.topbar?.isVisibleOnMobile ?? true,

        showTopBarDesktop:
            meta.topbar?.isVisibleOnWeb ?? true,

        showHeaderMobile:
            meta.navbar?.isVisibleOnMobile ?? true,

        showHeaderDesktop:
            meta.navbar?.isVisibleOnWeb ?? true,

        showBottomNavMobile:
            meta.bottomNav?.isVisibleOnMobile ?? true,

        showBottomNavDesktop:
            meta.bottomNav?.isVisibleOnWeb ?? false,

        showFooterMobile:
            meta.footer?.isVisibleOnMobile ?? false,

        showFooterDesktop:
            meta.footer?.isVisibleOnWeb ?? true,

        meta,
    };
}