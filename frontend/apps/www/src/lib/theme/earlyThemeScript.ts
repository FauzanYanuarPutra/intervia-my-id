export const EARLY_THEME_SCRIPT = `
  (function() {
    try {
      var raw = localStorage.getItem('lajukan_theme');
      var parsed = raw ? JSON.parse(raw) : {};
      var themePreset = parsed.themePreset || 'default';
      var legacyColor = parsed.colorblindMode && parsed.colorblindMode !== 'none'
        ? 'colorblind'
        : null;
      var colorVision = parsed.colorVision || legacyColor || 'none';
      var root = document.documentElement;

      root.classList.remove('dark');
      root.setAttribute('data-theme', themePreset);
      root.setAttribute('data-color-vision', colorVision);
    } catch (error) {}
  })();
`;
