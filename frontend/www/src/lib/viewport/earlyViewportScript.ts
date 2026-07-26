export const EARLY_VIEWPORT_SCRIPT = `
  (function() {
    try {
      var root = document.documentElement;

      function applyViewportHeight() {
        var viewport = window.visualViewport;
        var layoutHeight = window.innerHeight || root.clientHeight || 0;
        var visualHeight = viewport && viewport.height ? viewport.height : layoutHeight;
        var safeHeight = visualHeight > 120 ? visualHeight : layoutHeight;
        var activeElement = document.activeElement;
        var typingTarget = activeElement && (
          activeElement.tagName === 'INPUT' ||
          activeElement.tagName === 'TEXTAREA' ||
          activeElement.tagName === 'SELECT' ||
          activeElement.isContentEditable ||
          activeElement.getAttribute('role') === 'textbox'
        );
        var height = Math.round(Math.max(1, safeHeight));
        var width = Math.round(Math.max(1, viewport && viewport.width ? viewport.width : window.innerWidth || 0));
        var offsetTop = Math.round(Math.max(0, viewport && viewport.offsetTop ? viewport.offsetTop : 0));
        var offsetLeft = Math.round(Math.max(0, viewport && viewport.offsetLeft ? viewport.offsetLeft : 0));
        var scale = viewport && viewport.scale ? viewport.scale : 1;
        var rawKeyboardInset = Math.max(0, layoutHeight - height - offsetTop);
        var keyboardThreshold = Math.max(80, Math.round(layoutHeight * 0.12));
        var keyboardOpen = !!typingTarget && Math.abs(scale - 1) <= 0.06 && rawKeyboardInset >= keyboardThreshold;
        var keyboardInset = Math.round(keyboardOpen ? rawKeyboardInset : 0);

        root.style.setProperty('--app-visual-viewport-height', height + 'px');
        root.style.setProperty('--visual-viewport-height', height + 'px');
        root.style.setProperty('--app-viewport-height', height + 'px');
        root.style.setProperty('--app-viewport-dynamic-height', height + 'px');
        root.style.setProperty('--app-layout-viewport-height', Math.round(Math.max(1, layoutHeight)) + 'px');
        root.style.setProperty('--app-visual-viewport-width', width + 'px');
        root.style.setProperty('--app-viewport-offset-top', offsetTop + 'px');
        root.style.setProperty('--app-viewport-offset-left', offsetLeft + 'px');
        root.style.setProperty('--app-keyboard-inset-height', keyboardInset + 'px');
        root.style.setProperty('--app-viewport-scale', String(scale));
        root.dataset.keyboardOpen = keyboardOpen ? 'true' : 'false';
        root.dataset.viewportManaged = 'true';
      }

      applyViewportHeight();
      window.requestAnimationFrame(applyViewportHeight);
    } catch (error) {}
  })();
`;
