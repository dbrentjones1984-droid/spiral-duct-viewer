/* Small runtime polyfills for older Android Chrome / WebView (pre-2024). pdf.js 6 needs these even in its
   "legacy" build. Imported by the main app and by the pdf.js worker wrapper. */
const P = Promise as unknown as Record<string, unknown>;
if (typeof P.withResolvers !== "function") {
  P.withResolvers = function withResolvers<T>() {
    let resolve!: (v: T | PromiseLike<T>) => void;
    let reject!: (r?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}
if (typeof P.try !== "function") {
  P.try = function tryFn(fn: (...a: unknown[]) => unknown, ...args: unknown[]) {
    return new Promise((resolve) => resolve(fn(...args)));
  };
}
for (const C of [Map, WeakMap] as unknown as { prototype: Record<string, unknown> }[]) {
  const proto = C.prototype as Record<string, unknown> & { has(k: unknown): boolean; get(k: unknown): unknown; set(k: unknown, v: unknown): unknown };
  if (typeof proto.getOrInsert !== "function") {
    proto.getOrInsert = function (this: typeof proto, key: unknown, value: unknown) {
      if (!this.has(key)) this.set(key, value);
      return this.get(key);
    };
  }
  if (typeof proto.getOrInsertComputed !== "function") {
    proto.getOrInsertComputed = function (this: typeof proto, key: unknown, fn: (k: unknown) => unknown) {
      if (!this.has(key)) this.set(key, fn(key));
      return this.get(key);
    };
  }
}
export {};
