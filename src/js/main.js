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

// fetch() polyfill for file protocol 
(function() {
  'use strict';
  
  // Only apply polyfill if running in file protocol
  if (window.location.protocol !== 'file:') {
    return;
  }

  // Check if we need to polyfill
  const originalFetch = window.fetch;

  async function fileProtocolFetch(input, init = {}) {
    // Handle Request object if passed
    let url = input;
    let options = { ...init };

    if (input instanceof Request) {
      url = input.url;
      options = {
        method: input.method,
        headers: input.headers,
        body: input.body,
        mode: input.mode,
        credentials: input.credentials,
        cache: input.cache,
        redirect: input.redirect,
        referrer: input.referrer,
        integrity: input.integrity,
        ...init
      };
    }

    // Parse URL to determine if it's relative or absolute
    let fullUrl;
    try {
      fullUrl = new URL(url, window.location.href);
    } catch (e) {
      fullUrl = new URL(url);
    }

    // For absolute URLs with different protocol, use original fetch if available
    if (fullUrl.protocol !== 'file:' && fullUrl.protocol !== 'about:' && originalFetch) {
      return originalFetch(input, init);
    }

    // Handle file:// or relative paths
    const filePath = fullUrl.href.replace(/^file:\/\//, '').replace(/^\//, '');
    
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      
      // Determine method
      const method = (options.method || 'GET').toUpperCase();
      
      xhr.open(method, fullUrl.href, true);
      
      // Set headers
      if (options.headers) {
        if (options.headers instanceof Headers) {
          options.headers.forEach((value, key) => {
            xhr.setRequestHeader(key, value);
          });
        } else if (Array.isArray(options.headers)) {
          options.headers.forEach(([key, value]) => {
            xhr.setRequestHeader(key, value);
          });
        } else if (typeof options.headers === 'object') {
          Object.entries(options.headers).forEach(([key, value]) => {
            xhr.setRequestHeader(key, value);
          });
        }
      }
      
      // Set response type for blob/buffer/etc
      if (options.responseType) {
        xhr.responseType = options.responseType;
      }
      
      // Handle credentials
      xhr.withCredentials = options.credentials === 'include';
      
      // Handle timeout
      if (options.timeout) {
        xhr.timeout = options.timeout;
      }
      
      // Create Response object
      function createResponse(xhr) {
        const headers = new Headers();
        const responseHeaders = xhr.getAllResponseHeaders();
        responseHeaders.split('\r\n').forEach(line => {
          const [key, value] = line.split(': ');
          if (key && value) {
            headers.append(key, value);
          }
        });
        
        let body = xhr.response;
        
        // Handle different response types
        if (xhr.responseType === '' || xhr.responseType === 'text') {
          body = xhr.responseText;
        }
        
        const responseInit = {
          status: xhr.status,
          statusText: xhr.statusText,
          headers: headers
        };
        
        return new Response(body, responseInit);
      }
      
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(createResponse(xhr));
        } else {
          reject(new TypeError(`Failed to fetch: ${xhr.status} ${xhr.statusText}`));
        }
      };
      
      xhr.onerror = () => {
        reject(new TypeError('Failed to fetch: Network error'));
      };
      
      xhr.ontimeout = () => {
        reject(new TypeError('Failed to fetch: Timeout'));
      };
      
      // Send request
      if (options.body) {
        xhr.send(options.body);
      } else {
        xhr.send();
      }
    });
  }

  // Override fetch
  window.fetch = fileProtocolFetch;
  
  // Also polyfill window.fetch if needed for older browsers
  if (!window.Promise) {
    console.warn('Promise polyfill required for fetch polyfill');
  }
})();