const COPYRIGHT = "%";
const VERSION = "%";
const HOST = "%";
const DEBUG = "%";

// Global language processor
window.__ = function(text) {
  if (typeof text !== 'string') return text;

  // Get current language from SettingsManager if available
  const language = window.settings?.getLanguage?.() || 0;

  // Handle simple split case (text||text)
  const simpleSplitRegex = /([^|(]+\|\|[^|)]+)/g;
  text = text.replace(simpleSplitRegex, match => {
    const parts = match.split('||');
    return parts[language] || parts[0];
  });

  // Handle parenthetical cases (ES|EN)
  const parenRegex = /\(([^)|]+)\|([^)]+)\)/g;
  text = text.replace(parenRegex, (match, esText, enText) => {
    return language === 0 ? esText : enText;
  });

  return text;
};

// Open external URL
window.openExternalUrl = url => {
  // Ensure URL is properly encoded
  const encodedUrl = encodeURI(url);
  
  const isCordova = typeof window.cordova != undefined;
  
  if (isCordova) {
    navigator.app.loadUrl(encodedUrl, { openExternal: true });
  } else {
    const a = document.createElement('a');
    a.href = encodedUrl;
    a.target = '_blank';
    a.click();
  }
};
