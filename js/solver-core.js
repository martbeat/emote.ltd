/*
 * Compatibility entrypoint.
 *
 * This file intentionally contains no ES module syntax so it can be loaded
 * safely by legacy/non-module script tags without throwing:
 *   "Uncaught SyntaxError: Unexpected token 'export'".
 *
 * The actual solver module now lives in:
 *   ./solver-core.module.js
 */

(function () {
  if (typeof window !== "undefined") {
    window.__SOLVER_CORE_MODULE_PATH__ = "./js/solver-core.module.js?v=20260406.3";
  }
})();
