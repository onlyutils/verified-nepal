import { requireAuth, optionalAuth, requireModAuth, ensureGuidelinesAck } from "./auth.js";

// A middleware wraps a handler `(event, opts, ...params)` and returns one with the same shape.
// compose(a, b)(h) === a(b(h)): `a` runs first on the way in.
export function compose(...middlewares) {
  return (handler) => middlewares.reduceRight((h, mw) => mw(h), handler);
}

export function withAuth(handler) {
  return async (event, opts, ...params) => handler(event, { ...opts, auth: await requireAuth(event, opts) }, ...params);
}

export function withOptionalAuth(handler) {
  return async (event, opts, ...params) => handler(event, { ...opts, auth: await optionalAuth(event, opts) }, ...params);
}

export function withModAuth(handler) {
  return async (event, opts, ...params) => handler(event, { ...opts, auth: await requireModAuth(event, opts) }, ...params);
}

export function withGuidelinesAck(handler) {
  return (event, opts, ...params) => {
    ensureGuidelinesAck(opts.auth);
    return handler(event, opts, ...params);
  };
}
