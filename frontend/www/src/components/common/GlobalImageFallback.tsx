'use client';

import { useEffect } from 'react';

const FALLBACK_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" role="img" aria-label="Gambar tidak tersedia">
  <rect width="256" height="256" fill="#e5e7eb"/>
  <rect x="54" y="62" width="148" height="116" rx="20" fill="#f8fafc" stroke="#94a3b8" stroke-width="10"/>
  <circle cx="102" cy="104" r="16" fill="#cbd5e1"/>
  <path d="M72 160l39-38 28 28 17-17 28 27" fill="none" stroke="#94a3b8" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M58 202L202 54" fill="none" stroke="#64748b" stroke-width="14" stroke-linecap="round"/>
</svg>`;

const FALLBACK_SRC = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
  FALLBACK_SVG.replace(/\s+/g, ' ').trim(),
)}`;

function applyImageFallback(image: HTMLImageElement) {
  if (image.dataset.lajukanImageFallback === 'true') return;

  image.dataset.lajukanImageFallback = 'true';
  image.removeAttribute('srcset');
  image.removeAttribute('sizes');
  image.srcset = '';
  image.src = FALLBACK_SRC;
  image.decoding = 'async';
  image.loading = image.loading || 'lazy';
}

function scanBrokenImages(root: ParentNode = document) {
  root.querySelectorAll('img').forEach(image => {
    if (!(image instanceof HTMLImageElement)) return;
    if (image.dataset.lajukanImageFallback === 'true') return;
    if (image.complete && image.naturalWidth === 0) {
      applyImageFallback(image);
    }
  });
}

export function GlobalImageFallback() {
  useEffect(() => {
    const handleImageError = (event: Event) => {
      const target = event.target;
      if (target instanceof HTMLImageElement) {
        applyImageFallback(target);
      }
    };

    window.addEventListener('error', handleImageError, true);
    scanBrokenImages();

    const observer = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach(node => {
          if (node instanceof HTMLImageElement) {
            if (node.complete && node.naturalWidth === 0) {
              applyImageFallback(node);
            }
            return;
          }
          if (node instanceof Element) {
            scanBrokenImages(node);
          }
        });
      }
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });

    return () => {
      window.removeEventListener('error', handleImageError, true);
      observer.disconnect();
    };
  }, []);

  return null;
}
