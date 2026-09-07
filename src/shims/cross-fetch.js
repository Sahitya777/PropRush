// Safe cross-fetch shim that delegates directly to native global fetch
// avoiding the flawed "function F() { this.fetch = false; }" prototype hack
// which triggers "TypeError: Cannot assign to read only property 'fetch'" in sandboxed/strict runtimes.

const realFetch = (typeof globalThis !== 'undefined' && typeof globalThis.fetch === 'function')
  ? globalThis.fetch.bind(globalThis)
  : (typeof window !== 'undefined' && typeof window.fetch === 'function')
  ? window.fetch.bind(window)
  : function() {
      if (typeof fetch === 'function') {
        return fetch.apply(this, arguments);
      }
      throw new Error('No fetch implementation found in runtime environment');
    };

const realHeaders = (typeof globalThis !== 'undefined' && globalThis.Headers)
  ? globalThis.Headers
  : (typeof window !== 'undefined' ? window.Headers : undefined);

const realRequest = (typeof globalThis !== 'undefined' && globalThis.Request)
  ? globalThis.Request
  : (typeof window !== 'undefined' ? window.Request : undefined);

const realResponse = (typeof globalThis !== 'undefined' && globalThis.Response)
  ? globalThis.Response
  : (typeof window !== 'undefined' ? window.Response : undefined);

try {
  realFetch.fetch = realFetch;
  realFetch.default = realFetch;
  realFetch.Headers = realHeaders;
  realFetch.Request = realRequest;
  realFetch.Response = realResponse;
  realFetch.polyfill = true;
} catch {
  // Ignore
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = realFetch;
  module.exports.default = realFetch;
  module.exports.fetch = realFetch;
  module.exports.Headers = realHeaders;
  module.exports.Request = realRequest;
  module.exports.Response = realResponse;
}

export default realFetch;
export {
  realFetch as fetch,
  realHeaders as Headers,
  realRequest as Request,
  realResponse as Response,
};
