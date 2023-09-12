import { useMemo as w, useSyncExternalStore as m, useRef as D, useEffect as P, useState as T } from "react";
let k = 0;
function h({
  onSubscribe: t,
  getVersion: n
} = {}) {
  let e = 0, r = 0, s;
  const i = k++, u = /* @__PURE__ */ new Map(), c = {
    getId() {
      return i;
    },
    notify() {
      r += 1;
      for (const o of u)
        o[1](c);
    },
    subscribe(o) {
      const f = e++;
      u.size === 0 && (s = t == null ? void 0 : t()), u.set(f, o);
      let l = !1;
      return () => {
        l || (u.delete(f), l = !0, u.size === 0 && typeof s == "function" && (s == null || s(), s = void 0));
      };
    },
    getVersion: n ?? (() => r)
  };
  return c;
}
function a(t) {
  const n = a.current.signals;
  try {
    const e = /* @__PURE__ */ new Set();
    a.current.signals = e;
    const r = t();
    return a.current.signals = n, { value: r, signals: e };
  } catch (e) {
    throw a.current.signals = n, e;
  }
}
a.current = {
  signals: null,
  register(t) {
    t && a.current.signals && a.current.signals.add(t);
  }
};
function v(t) {
  let n = t;
  const e = h();
  return {
    get() {
      return a.current.register(e), n;
    },
    set(r) {
      Object.is(r, n) || (n = r, e.notify());
    }
  };
}
function S(t, n = {}) {
  const e = /* @__PURE__ */ new Map();
  function r(s, i) {
    const u = { data: t(...i) };
    if (n.inertia == null)
      return u;
    u.signal = h({
      onSubscribe() {
        return f(), o;
      }
    });
    let c;
    function o() {
      clearTimeout(c), c = setTimeout(l, n.inertia);
    }
    function f() {
      clearTimeout(c), c = void 0;
    }
    function l() {
      var d;
      e.delete(s), (d = u.signal) == null || d.notify();
    }
    return o(), u;
  }
  return {
    get(...s) {
      const i = M(s);
      let u = e.get(i);
      return e.has(i) || (u = r(i, s), e.set(i, u)), u.signal && a.current.register(u.signal), u.data;
    },
    getAll() {
      const s = /* @__PURE__ */ new Set();
      for (const i of e.values())
        s.add(i.data);
      return s;
    }
  };
}
function M(t) {
  return JSON.stringify(
    t,
    (n, e) => z(e) ? Object.keys(e).sort().reduce((r, s) => (r[s] = e[s], r), {}) : e
  );
}
function z(t) {
  if (!p(t))
    return !1;
  const n = t.constructor;
  if (typeof n > "u")
    return !0;
  const e = n.prototype;
  return !(!p(e) || !e.hasOwnProperty("isPrototypeOf"));
}
function p(t) {
  return Object.prototype.toString.call(t) === "[object Object]";
}
function O(t) {
  let n = !1;
  const e = /* @__PURE__ */ new Map();
  return {
    hasChanged(r = new Set(e.keys())) {
      var s, i;
      if (!n || e.size !== r.size)
        return !0;
      for (const u of r)
        if (((s = e.get(u)) == null ? void 0 : s.version) !== ((i = u.getVersion) == null ? void 0 : i.call(u)))
          return !0;
      return !1;
    },
    update(r) {
      var s, i;
      for (const u of r) {
        let c = e.get(u);
        c || (c = {}, e.set(u, c)), c.version = (s = u.getVersion) == null ? void 0 : s.call(u);
      }
      for (const [u, c] of e)
        e.has(u) || ((i = c.unsubscribe) == null || i.call(c), e.delete(u));
      n = !0;
    },
    subscribe() {
      for (const [r, s] of e)
        s.unsubscribe || (s.unsubscribe = r.subscribe(t));
    },
    unsubscribe() {
      var r;
      for (const s of e.values())
        (r = s.unsubscribe) == null || r.call(s), s.unsubscribe = void 0;
    }
  };
}
function _(t) {
  const n = S(
    (...e) => E(() => t(...e))
  );
  return {
    get(...e) {
      return n.get(...e)();
    }
  };
}
function E(t) {
  const n = O(s), e = v({ value: null, version: 0 }), r = { isSubscribed: !1, hasAnyDependencyChanged: !1 };
  function s() {
    r.hasAnyDependencyChanged = !0, u.notify();
  }
  function i() {
    if (r.isSubscribed && !r.hasAnyDependencyChanged || !r.isSubscribed && !n.hasChanged())
      return;
    const { value: c, signals: o } = a(t);
    n.update(o), r.isSubscribed && n.subscribe(), e.set({ value: c, version: e.get().version + 1 }), r.hasAnyDependencyChanged = !1;
  }
  const u = h({
    onSubscribe() {
      if (r.isSubscribed = !0, n.hasChanged()) {
        const { value: c, signals: o } = a(t);
        n.update(o), e.set({ value: c, version: e.get().version + 1 });
      }
      return n.subscribe(), r.hasAnyDependencyChanged = !1, () => {
        r.isSubscribed = !1, n.unsubscribe();
      };
    },
    getVersion() {
      return i(), e.get().version;
    }
  });
  return u.isDependencies = !0, () => (a.current.register(u), i(), e.get().value);
}
function H(t, n = {}) {
  const e = S(
    (...r) => j(() => t(...r))
  );
  return {
    get(...r) {
      return e.get(...r).get();
    },
    fetch(...r) {
      return e.get(...r).fetch();
    },
    getAll() {
      return e.getAll();
    }
  };
}
function j(t, n) {
  let e = null;
  const r = v(g(
    "idle"
    /* IDLE */
  )), s = h({
    onSubscribe: () => void setTimeout(i, 0)
    // set timeout to avoid "The result of getSnapshot should be cached"
  });
  function i() {
    const u = t();
    e = u;
    const c = r.get();
    return r.set(g("loading", c.data, c.error)), u.then(
      (o) => {
        u === e && r.set(g("success", o));
      },
      (o) => {
        u === e && r.set(g("error", void 0, o));
      }
    ), u;
  }
  return {
    get() {
      return a.current.register(s), r.get();
    },
    fetch: i
  };
}
function g(t, n, e) {
  return {
    ...{
      idle: b("idle", !0, !1, !1, !1),
      loading: b("loading", !1, !0, !1, !1),
      success: b("success", !1, !1, !0, !1),
      error: b("error", !1, !1, !1, !0)
    }[t],
    data: n,
    error: e
  };
}
function b(t, n, e, r, s) {
  return { status: t, isIdle: n, isLoading: e, isSuccess: r, isError: s };
}
function A(t) {
  return t && t.__esModule && Object.prototype.hasOwnProperty.call(t, "default") ? t.default : t;
}
var I = function(n, e, r, s) {
  var i = r ? r.call(s, n, e) : void 0;
  if (i !== void 0)
    return !!i;
  if (n === e)
    return !0;
  if (typeof n != "object" || !n || typeof e != "object" || !e)
    return !1;
  var u = Object.keys(n), c = Object.keys(e);
  if (u.length !== c.length)
    return !1;
  for (var o = Object.prototype.hasOwnProperty.bind(e), f = 0; f < u.length; f++) {
    var l = u[f];
    if (!o(l))
      return !1;
    var d = n[l], y = e[l];
    if (i = r ? r.call(s, d, y, l) : void 0, i === !1 || i === void 0 && d !== y)
      return !1;
  }
  return !0;
};
const U = /* @__PURE__ */ A(I);
function R(t) {
  return C(t);
}
function V(t) {
  return C(t);
}
function q() {
  let t, n = O(() => t()), e;
  return {
    subscribe(r) {
      return t = r, n.subscribe(), () => {
        n == null || n.unsubscribe(), t = null;
      };
    },
    getSnapshot(r) {
      const { value: s, signals: i } = a(r);
      return n.update(i), t && n.subscribe(), !Object.is(e, s) && !U(e, s) && (e = s), e;
    }
  };
}
function C(t) {
  const n = w(q, []);
  return m(
    n.subscribe,
    () => n.getSnapshot(t)
  );
}
function F(t, n) {
  const e = D(t);
  return P(() => {
    n && (e.current = t);
  }, [n, t]), n ? t : e.current;
}
function J(t) {
  const [n, e] = T({
    status: "idle",
    result: void 0,
    error: void 0
  });
  function r() {
  }
  return { ...n, execute: r };
}
export {
  S as createCollection,
  _ as createComputed,
  H as createQuery,
  h as createSignal,
  v as createState,
  a as execute,
  V as useActions,
  R as useData,
  J as useMutation,
  F as useStaleWhileRevalidate
};
