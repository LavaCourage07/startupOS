/**
 * 控制台拦截脚本 — 注入到沙箱 HTML 的 </body> 之前
 */
export const CONSOLE_BRIDGE_SCRIPT = `
(function() {
  var _origConsole = {};
  var _methods = ['log', 'warn', 'error', 'info', 'debug'];
  _methods.forEach(function(method) {
    _origConsole[method] = console[method];
    console[method] = function() {
      var args = Array.prototype.slice.call(arguments).map(function(arg) {
        try { return typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg); }
        catch(e) { return String(arg); }
      });
      try {
        window.parent.postMessage({
          type: 'sandbox-console',
          method: method,
          args: args,
          timestamp: Date.now()
        }, '*');
      } catch(e) {}
      _origConsole[method].apply(console, arguments);
    };
  });

  window.addEventListener('error', function(e) {
    try {
      window.parent.postMessage({
        type: 'sandbox-error',
        message: e.message || 'Unknown error',
        stack: e.error ? e.error.stack : undefined,
        lineno: e.lineno,
        colno: e.colno,
        timestamp: Date.now()
      }, '*');
    } catch(err) {}
  });

  window.addEventListener('unhandledrejection', function(e) {
    try {
      window.parent.postMessage({
        type: 'sandbox-error',
        message: (e.reason && e.reason.message) || String(e.reason),
        stack: e.reason ? e.reason.stack : undefined,
        timestamp: Date.now()
      }, '*');
    } catch(err) {}
  });
})();
`;
