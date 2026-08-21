'use client';

import { useEffect } from 'react';

const HIDE_DELAY_MS = 1100;

export default function AutoHideScrollbars() {
  useEffect(() => {
    const elementTimers = new WeakMap<Element, number>();
    let documentTimer = 0;

    const markDocument = () => {
      document.documentElement.classList.add('is-scrolling');
      window.clearTimeout(documentTimer);
      documentTimer = window.setTimeout(() => {
        document.documentElement.classList.remove('is-scrolling');
      }, HIDE_DELAY_MS);
    };

    const markElement = (element: Element) => {
      element.classList.add('is-scrolling');

      const existingTimer = elementTimers.get(element);
      if (existingTimer) {
        window.clearTimeout(existingTimer);
      }

      const nextTimer = window.setTimeout(() => {
        element.classList.remove('is-scrolling');
        elementTimers.delete(element);
      }, HIDE_DELAY_MS);

      elementTimers.set(element, nextTimer);
    };

    const handleScroll = (event: Event) => {
      markDocument();

      if (event.target instanceof Element) {
        markElement(event.target);
      }
    };

    window.addEventListener('scroll', handleScroll, true);

    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      window.clearTimeout(documentTimer);
      document.documentElement.classList.remove('is-scrolling');
    };
  }, []);

  return null;
}
