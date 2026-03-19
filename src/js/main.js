const COPYRIGHT = "%";
const VERSION = "%";
const HOST = "%";
const DEBUG = "%";

// Global language processor
window.__ = function(text) {
  if (typeof text !== 'string') return text;

  // Get current language from SettingsManager if available
  const language = window.settings?.getLanguage?.() || 0;

  // First handle parenthetical cases (ES|EN) - these are the highest priority
  // Matches patterns like (Hello|Hola) and replaces with the appropriate language
  const parenRegex = /\(([^|)]+)\|([^)]+)\)/g;
  text = text.replace(parenRegex, (match, enText, esText) => {
    return language === 0 ? esText : enText;
  });

  // Then handle simple split case (text||text)
  // These are lower priority and won't interfere with already processed parentheses
  const simpleSplitRegex = /([^|(]+\|\|[^|)]+)/g;
  text = text.replace(simpleSplitRegex, match => {
    const parts = match.split('||');
    return parts[language] || parts[0];
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
