/*
 * Compatibility shim.
 *
 * Some deployments still request `/solver-core.module.js` directly as a classic
 * script, which would throw if the payload contains ESM `export` statements.
 *
 * Keep this file classic-script-safe and delegate to the real module in
 * `/js/solver-core.module.js` via dynamic import.
 */
(function () {
  const modulePath = "./js/solver-core.module.js?v=20260406.2";

  if (typeof globalThis !== "undefined") {
    globalThis.__SOLVER_CORE_MODULE_PATH__ = modulePath;
  }

  Promise.resolve()
    .then(() => import(modulePath))
    .catch((err) => {
      // Surface load errors without breaking classic-script parsing.
      console.error("Failed to load solver core module:", err);
    });
})();
