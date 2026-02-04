async function Q(e, t = {}, n) {
  return window.__TAURI_INTERNALS__.invoke(e, t, n);
}
const Z = "Request canceled";
async function ot(e, t) {
  const n = t == null ? void 0 : t.signal;
  if (n != null && n.aborted)
    throw new Error(Z);
  const r = t == null ? void 0 : t.maxRedirections, o = t == null ? void 0 : t.connectTimeout, i = t == null ? void 0 : t.proxy;
  t && (delete t.maxRedirections, delete t.connectTimeout, delete t.proxy);
  const s = t != null && t.headers ? t.headers instanceof Headers ? t.headers : new Headers(t.headers) : new Headers(), c = new Request(e, t), f = await c.arrayBuffer(), l = f.byteLength !== 0 ? Array.from(new Uint8Array(f)) : null;
  for (const [y, w] of c.headers)
    s.get(y) || s.set(y, w);
  const E = (s instanceof Headers ? Array.from(s.entries()) : Array.isArray(s) ? s : Object.entries(s)).map(([y, w]) => [
    y,
    // we need to ensure we have all header values as strings
    // eslint-disable-next-line
    typeof w == "string" ? w : w.toString()
  ]);
  if (n != null && n.aborted)
    throw new Error(Z);
  const R = await Q("plugin:http|fetch", {
    clientConfig: {
      method: c.method,
      url: c.url,
      headers: E,
      data: l,
      maxRedirections: r,
      connectTimeout: o,
      proxy: i
    }
  }), A = () => Q("plugin:http|fetch_cancel", { rid: R });
  if (n != null && n.aborted)
    throw A(), new Error(Z);
  n == null || n.addEventListener("abort", () => void A());
  const { status: d, statusText: h, url: p, headers: O, rid: _ } = await Q("plugin:http|fetch_send", {
    rid: R
  }), m = await Q("plugin:http|fetch_read_body", {
    rid: _
  }), S = new Response(m instanceof ArrayBuffer && m.byteLength !== 0 ? m : m instanceof Array && m.length > 0 ? new Uint8Array(m) : null, {
    status: d,
    statusText: h
  });
  console.log('amogus', O)
  console.log('amogus', new Headers(O))
  return Object.defineProperty(S, "url", { value: p }), Object.defineProperty(S, "headers", {
    value: new Headers(O)
  }), Object.defineProperty(S, "raw-headers", {
    value: O
  }), S;
}
function Be(e, t) {
  return function() {
    return e.apply(t, arguments);
  };
}
const { toString: it } = Object.prototype, { getPrototypeOf: de } = Object, W = /* @__PURE__ */ ((e) => (t) => {
  const n = it.call(t);
  return e[n] || (e[n] = n.slice(8, -1).toLowerCase());
})(/* @__PURE__ */ Object.create(null)), L = (e) => (e = e.toLowerCase(), (t) => W(t) === e), v = (e) => (t) => typeof t === e, { isArray: M } = Array, q = v("undefined");
function st(e) {
  return e !== null && !q(e) && e.constructor !== null && !q(e.constructor) && D(e.constructor.isBuffer) && e.constructor.isBuffer(e);
}
const Me = L("ArrayBuffer");
function at(e) {
  let t;
  return typeof ArrayBuffer < "u" && ArrayBuffer.isView ? t = ArrayBuffer.isView(e) : t = e && e.buffer && Me(e.buffer), t;
}
const ct = v("string"), D = v("function"), Ce = v("number"), J = (e) => e !== null && typeof e == "object", lt = (e) => e === !0 || e === !1, V = (e) => {
  if (W(e) !== "object")
    return !1;
  const t = de(e);
  return (t === null || t === Object.prototype || Object.getPrototypeOf(t) === null) && !(Symbol.toStringTag in e) && !(Symbol.iterator in e);
}, ut = L("Date"), ft = L("File"), Et = L("Blob"), dt = L("FileList"), pt = (e) => J(e) && D(e.pipe), ht = (e) => {
  let t;
  return e && (typeof FormData == "function" && e instanceof FormData || D(e.append) && ((t = W(e)) === "formdata" || // detect form-data instance
  t === "object" && D(e.toString) && e.toString() === "[object FormData]"));
}, Tt = L("URLSearchParams"), [mt, Rt, Ot, At] = ["ReadableStream", "Request", "Response", "Headers"].map(L), _t = (e) => e.trim ? e.trim() : e.replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, "");
function k(e, t, { allOwnKeys: n = !1 } = {}) {
  if (e === null || typeof e > "u")
    return;
  let r, o;
  if (typeof e != "object" && (e = [e]), M(e))
    for (r = 0, o = e.length; r < o; r++)
      t.call(null, e[r], r, e);
  else {
    const i = n ? Object.getOwnPropertyNames(e) : Object.keys(e), s = i.length;
    let c;
    for (r = 0; r < s; r++)
      c = i[r], t.call(null, e[c], c, e);
  }
}
function He(e, t) {
  t = t.toLowerCase();
  const n = Object.keys(e);
  let r = n.length, o;
  for (; r-- > 0; )
    if (o = n[r], t === o.toLowerCase())
      return o;
  return null;
}
const F = typeof globalThis < "u" ? globalThis : typeof self < "u" ? self : typeof window < "u" ? window : global, qe = (e) => !q(e) && e !== F;
function oe() {
  const { caseless: e } = qe(this) && this || {}, t = {}, n = (r, o) => {
    const i = e && He(t, o) || o;
    V(t[i]) && V(r) ? t[i] = oe(t[i], r) : V(r) ? t[i] = oe({}, r) : M(r) ? t[i] = r.slice() : t[i] = r;
  };
  for (let r = 0, o = arguments.length; r < o; r++)
    arguments[r] && k(arguments[r], n);
  return t;
}
const Nt = (e, t, n, { allOwnKeys: r } = {}) => (k(t, (o, i) => {
  n && D(o) ? e[i] = Be(o, n) : e[i] = o;
}, { allOwnKeys: r }), e), yt = (e) => (e.charCodeAt(0) === 65279 && (e = e.slice(1)), e), wt = (e, t, n, r) => {
  e.prototype = Object.create(t.prototype, r), e.prototype.constructor = e, Object.defineProperty(e, "super", {
    value: t.prototype
  }), n && Object.assign(e.prototype, n);
}, bt = (e, t, n, r) => {
  let o, i, s;
  const c = {};
  if (t = t || {}, e == null) return t;
  do {
    for (o = Object.getOwnPropertyNames(e), i = o.length; i-- > 0; )
      s = o[i], (!r || r(s, e, t)) && !c[s] && (t[s] = e[s], c[s] = !0);
    e = n !== !1 && de(e);
  } while (e && (!n || n(e, t)) && e !== Object.prototype);
  return t;
}, It = (e, t, n) => {
  e = String(e), (n === void 0 || n > e.length) && (n = e.length), n -= t.length;
  const r = e.indexOf(t, n);
  return r !== -1 && r === n;
}, St = (e) => {
  if (!e) return null;
  if (M(e)) return e;
  let t = e.length;
  if (!Ce(t)) return null;
  const n = new Array(t);
  for (; t-- > 0; )
    n[t] = e[t];
  return n;
}, Dt = /* @__PURE__ */ ((e) => (t) => e && t instanceof e)(typeof Uint8Array < "u" && de(Uint8Array)), Ut = (e, t) => {
  const r = (e && e[Symbol.iterator]).call(e);
  let o;
  for (; (o = r.next()) && !o.done; ) {
    const i = o.value;
    t.call(e, i[0], i[1]);
  }
}, Lt = (e, t) => {
  let n;
  const r = [];
  for (; (n = e.exec(t)) !== null; )
    r.push(n);
  return r;
}, gt = L("HTMLFormElement"), Pt = (e) => e.toLowerCase().replace(
  /[-_\s]([a-z\d])(\w*)/g,
  function(n, r, o) {
    return r.toUpperCase() + o;
  }
), Ae = (({ hasOwnProperty: e }) => (t, n) => e.call(t, n))(Object.prototype), Ft = L("RegExp"), ke = (e, t) => {
  const n = Object.getOwnPropertyDescriptors(e), r = {};
  k(n, (o, i) => {
    let s;
    (s = t(o, i, e)) !== !1 && (r[i] = s || o);
  }), Object.defineProperties(e, r);
}, xt = (e) => {
  ke(e, (t, n) => {
    if (D(e) && ["arguments", "caller", "callee"].indexOf(n) !== -1)
      return !1;
    const r = e[n];
    if (D(r)) {
      if (t.enumerable = !1, "writable" in t) {
        t.writable = !1;
        return;
      }
      t.set || (t.set = () => {
        throw Error("Can not rewrite read-only method '" + n + "'");
      });
    }
  });
}, Bt = (e, t) => {
  const n = {}, r = (o) => {
    o.forEach((i) => {
      n[i] = !0;
    });
  };
  return M(e) ? r(e) : r(String(e).split(t)), n;
}, Mt = () => {
}, Ct = (e, t) => e != null && Number.isFinite(e = +e) ? e : t, ee = "abcdefghijklmnopqrstuvwxyz", _e = "0123456789", je = {
  DIGIT: _e,
  ALPHA: ee,
  ALPHA_DIGIT: ee + ee.toUpperCase() + _e
}, Ht = (e = 16, t = je.ALPHA_DIGIT) => {
  let n = "";
  const { length: r } = t;
  for (; e--; )
    n += t[Math.random() * r | 0];
  return n;
};
function qt(e) {
  return !!(e && D(e.append) && e[Symbol.toStringTag] === "FormData" && e[Symbol.iterator]);
}
const kt = (e) => {
  const t = new Array(10), n = (r, o) => {
    if (J(r)) {
      if (t.indexOf(r) >= 0)
        return;
      if (!("toJSON" in r)) {
        t[o] = r;
        const i = M(r) ? [] : {};
        return k(r, (s, c) => {
          const f = n(s, o + 1);
          !q(f) && (i[c] = f);
        }), t[o] = void 0, i;
      }
    }
    return r;
  };
  return n(e, 0);
}, jt = L("AsyncFunction"), Gt = (e) => e && (J(e) || D(e)) && D(e.then) && D(e.catch), Ge = ((e, t) => e ? setImmediate : t ? ((n, r) => (F.addEventListener("message", ({ source: o, data: i }) => {
  o === F && i === n && r.length && r.shift()();
}, !1), (o) => {
  r.push(o), F.postMessage(n, "*");
}))(`axios@${Math.random()}`, []) : (n) => setTimeout(n))(
  typeof setImmediate == "function",
  D(F.postMessage)
), Qt = typeof queueMicrotask < "u" ? queueMicrotask.bind(F) : typeof process < "u" && process.nextTick || Ge, a = {
  isArray: M,
  isArrayBuffer: Me,
  isBuffer: st,
  isFormData: ht,
  isArrayBufferView: at,
  isString: ct,
  isNumber: Ce,
  isBoolean: lt,
  isObject: J,
  isPlainObject: V,
  isReadableStream: mt,
  isRequest: Rt,
  isResponse: Ot,
  isHeaders: At,
  isUndefined: q,
  isDate: ut,
  isFile: ft,
  isBlob: Et,
  isRegExp: Ft,
  isFunction: D,
  isStream: pt,
  isURLSearchParams: Tt,
  isTypedArray: Dt,
  isFileList: dt,
  forEach: k,
  merge: oe,
  extend: Nt,
  trim: _t,
  stripBOM: yt,
  inherits: wt,
  toFlatObject: bt,
  kindOf: W,
  kindOfTest: L,
  endsWith: It,
  toArray: St,
  forEachEntry: Ut,
  matchAll: Lt,
  isHTMLForm: gt,
  hasOwnProperty: Ae,
  hasOwnProp: Ae,
  // an alias to avoid ESLint no-prototype-builtins detection
  reduceDescriptors: ke,
  freezeMethods: xt,
  toObjectSet: Bt,
  toCamelCase: Pt,
  noop: Mt,
  toFiniteNumber: Ct,
  findKey: He,
  global: F,
  isContextDefined: qe,
  ALPHABET: je,
  generateString: Ht,
  isSpecCompliantForm: qt,
  toJSONObject: kt,
  isAsyncFn: jt,
  isThenable: Gt,
  setImmediate: Ge,
  asap: Qt
};
function T(e, t, n, r, o) {
  Error.call(this), Error.captureStackTrace ? Error.captureStackTrace(this, this.constructor) : this.stack = new Error().stack, this.message = e, this.name = "AxiosError", t && (this.code = t), n && (this.config = n), r && (this.request = r), o && (this.response = o, this.status = o.status ? o.status : null);
}
a.inherits(T, Error, {
  toJSON: function() {
    return {
      // Standard
      message: this.message,
      name: this.name,
      // Microsoft
      description: this.description,
      number: this.number,
      // Mozilla
      fileName: this.fileName,
      lineNumber: this.lineNumber,
      columnNumber: this.columnNumber,
      stack: this.stack,
      // Axios
      config: a.toJSONObject(this.config),
      code: this.code,
      status: this.status
    };
  }
});
const Qe = T.prototype, Ve = {};
[
  "ERR_BAD_OPTION_VALUE",
  "ERR_BAD_OPTION",
  "ECONNABORTED",
  "ETIMEDOUT",
  "ERR_NETWORK",
  "ERR_FR_TOO_MANY_REDIRECTS",
  "ERR_DEPRECATED",
  "ERR_BAD_RESPONSE",
  "ERR_BAD_REQUEST",
  "ERR_CANCELED",
  "ERR_NOT_SUPPORT",
  "ERR_INVALID_URL"
  // eslint-disable-next-line func-names
].forEach((e) => {
  Ve[e] = { value: e };
});
Object.defineProperties(T, Ve);
Object.defineProperty(Qe, "isAxiosError", { value: !0 });
T.from = (e, t, n, r, o, i) => {
  const s = Object.create(Qe);
  return a.toFlatObject(e, s, function(f) {
    return f !== Error.prototype;
  }, (c) => c !== "isAxiosError"), T.call(s, e.message, t, n, r, o), s.cause = e, s.name = e.name, i && Object.assign(s, i), s;
};
const Vt = null;
function ie(e) {
  return a.isPlainObject(e) || a.isArray(e);
}
function ze(e) {
  return a.endsWith(e, "[]") ? e.slice(0, -2) : e;
}
function Ne(e, t, n) {
  return e ? e.concat(t).map(function(o, i) {
    return o = ze(o), !n && i ? "[" + o + "]" : o;
  }).join(n ? "." : "") : t;
}
function zt(e) {
  return a.isArray(e) && !e.some(ie);
}
const Yt = a.toFlatObject(a, {}, null, function(t) {
  return /^is[A-Z]/.test(t);
});
function K(e, t, n) {
  if (!a.isObject(e))
    throw new TypeError("target must be an object");
  t = t || new FormData(), n = a.toFlatObject(n, {
    metaTokens: !0,
    dots: !1,
    indexes: !1
  }, !1, function(h, p) {
    return !a.isUndefined(p[h]);
  });
  const r = n.metaTokens, o = n.visitor || u, i = n.dots, s = n.indexes, f = (n.Blob || typeof Blob < "u" && Blob) && a.isSpecCompliantForm(t);
  if (!a.isFunction(o))
    throw new TypeError("visitor must be a function");
  function l(d) {
    if (d === null) return "";
    if (a.isDate(d))
      return d.toISOString();
    if (!f && a.isBlob(d))
      throw new T("Blob is not supported. Use a Buffer instead.");
    return a.isArrayBuffer(d) || a.isTypedArray(d) ? f && typeof Blob == "function" ? new Blob([d]) : Buffer.from(d) : d;
  }
  function u(d, h, p) {
    let O = d;
    if (d && !p && typeof d == "object") {
      if (a.endsWith(h, "{}"))
        h = r ? h : h.slice(0, -2), d = JSON.stringify(d);
      else if (a.isArray(d) && zt(d) || (a.isFileList(d) || a.endsWith(h, "[]")) && (O = a.toArray(d)))
        return h = ze(h), O.forEach(function(m, S) {
          !(a.isUndefined(m) || m === null) && t.append(
            // eslint-disable-next-line no-nested-ternary
            s === !0 ? Ne([h], S, i) : s === null ? h : h + "[]",
            l(m)
          );
        }), !1;
    }
    return ie(d) ? !0 : (t.append(Ne(p, h, i), l(d)), !1);
  }
  const E = [], R = Object.assign(Yt, {
    defaultVisitor: u,
    convertValue: l,
    isVisitable: ie
  });
  function A(d, h) {
    if (!a.isUndefined(d)) {
      if (E.indexOf(d) !== -1)
        throw Error("Circular reference detected in " + h.join("."));
      E.push(d), a.forEach(d, function(O, _) {
        (!(a.isUndefined(O) || O === null) && o.call(
          t,
          O,
          a.isString(_) ? _.trim() : _,
          h,
          R
        )) === !0 && A(O, h ? h.concat(_) : [_]);
      }), E.pop();
    }
  }
  if (!a.isObject(e))
    throw new TypeError("data must be an object");
  return A(e), t;
}
function ye(e) {
  const t = {
    "!": "%21",
    "'": "%27",
    "(": "%28",
    ")": "%29",
    "~": "%7E",
    "%20": "+",
    "%00": "\0"
  };
  return encodeURIComponent(e).replace(/[!'()~]|%20|%00/g, function(r) {
    return t[r];
  });
}
function pe(e, t) {
  this._pairs = [], e && K(e, this, t);
}
const Ye = pe.prototype;
Ye.append = function(t, n) {
  this._pairs.push([t, n]);
};
Ye.toString = function(t) {
  const n = t ? function(r) {
    return t.call(this, r, ye);
  } : ye;
  return this._pairs.map(function(o) {
    return n(o[0]) + "=" + n(o[1]);
  }, "").join("&");
};
function $t(e) {
  return encodeURIComponent(e).replace(/%3A/gi, ":").replace(/%24/g, "$").replace(/%2C/gi, ",").replace(/%20/g, "+").replace(/%5B/gi, "[").replace(/%5D/gi, "]");
}
function he(e, t, n) {
  if (!t)
    return e;
  const r = n && n.encode || $t, o = n && n.serialize;
  let i;
  if (o ? i = o(t, n) : i = a.isURLSearchParams(t) ? t.toString() : new pe(t, n).toString(r), i) {
    const s = e.indexOf("#");
    s !== -1 && (e = e.slice(0, s)), e += (e.indexOf("?") === -1 ? "?" : "&") + i;
  }
  return e;
}
function Wt(e) {
  return /^([a-z][a-z\d+\-.]*:)?\/\//i.test(e);
}
function vt(e, t) {
  return t ? e.replace(/\/?\/$/, "") + "/" + t.replace(/^\/+/, "") : e;
}
function Te(e, t) {
  return e && !Wt(t) ? vt(e, t) : t;
}
var se;
(function(e) {
  e[e.CONTINUE = 100] = "CONTINUE", e[e.SWITCHING_PROTOCOLS = 101] = "SWITCHING_PROTOCOLS", e[e.PROCESSING = 102] = "PROCESSING", e[e.EARLY_HINTS = 103] = "EARLY_HINTS", e[e.OK = 200] = "OK", e[e.CREATED = 201] = "CREATED", e[e.ACCEPTED = 202] = "ACCEPTED", e[e.NON_AUTHORITATIVE_INFORMATION = 203] = "NON_AUTHORITATIVE_INFORMATION", e[e.NO_CONTENT = 204] = "NO_CONTENT", e[e.RESET_CONTENT = 205] = "RESET_CONTENT", e[e.PARTIAL_CONTENT = 206] = "PARTIAL_CONTENT", e[e.MULTI_STATUS = 207] = "MULTI_STATUS", e[e.MULTIPLE_CHOICES = 300] = "MULTIPLE_CHOICES", e[e.MOVED_PERMANENTLY = 301] = "MOVED_PERMANENTLY", e[e.MOVED_TEMPORARILY = 302] = "MOVED_TEMPORARILY", e[e.SEE_OTHER = 303] = "SEE_OTHER", e[e.NOT_MODIFIED = 304] = "NOT_MODIFIED", e[e.USE_PROXY = 305] = "USE_PROXY", e[e.TEMPORARY_REDIRECT = 307] = "TEMPORARY_REDIRECT", e[e.PERMANENT_REDIRECT = 308] = "PERMANENT_REDIRECT", e[e.BAD_REQUEST = 400] = "BAD_REQUEST", e[e.UNAUTHORIZED = 401] = "UNAUTHORIZED", e[e.PAYMENT_REQUIRED = 402] = "PAYMENT_REQUIRED", e[e.FORBIDDEN = 403] = "FORBIDDEN", e[e.NOT_FOUND = 404] = "NOT_FOUND", e[e.METHOD_NOT_ALLOWED = 405] = "METHOD_NOT_ALLOWED", e[e.NOT_ACCEPTABLE = 406] = "NOT_ACCEPTABLE", e[e.PROXY_AUTHENTICATION_REQUIRED = 407] = "PROXY_AUTHENTICATION_REQUIRED", e[e.REQUEST_TIMEOUT = 408] = "REQUEST_TIMEOUT", e[e.CONFLICT = 409] = "CONFLICT", e[e.GONE = 410] = "GONE", e[e.LENGTH_REQUIRED = 411] = "LENGTH_REQUIRED", e[e.PRECONDITION_FAILED = 412] = "PRECONDITION_FAILED", e[e.REQUEST_TOO_LONG = 413] = "REQUEST_TOO_LONG", e[e.REQUEST_URI_TOO_LONG = 414] = "REQUEST_URI_TOO_LONG", e[e.UNSUPPORTED_MEDIA_TYPE = 415] = "UNSUPPORTED_MEDIA_TYPE", e[e.REQUESTED_RANGE_NOT_SATISFIABLE = 416] = "REQUESTED_RANGE_NOT_SATISFIABLE", e[e.EXPECTATION_FAILED = 417] = "EXPECTATION_FAILED", e[e.IM_A_TEAPOT = 418] = "IM_A_TEAPOT", e[e.INSUFFICIENT_SPACE_ON_RESOURCE = 419] = "INSUFFICIENT_SPACE_ON_RESOURCE", e[e.METHOD_FAILURE = 420] = "METHOD_FAILURE", e[e.MISDIRECTED_REQUEST = 421] = "MISDIRECTED_REQUEST", e[e.UNPROCESSABLE_ENTITY = 422] = "UNPROCESSABLE_ENTITY", e[e.LOCKED = 423] = "LOCKED", e[e.FAILED_DEPENDENCY = 424] = "FAILED_DEPENDENCY", e[e.UPGRADE_REQUIRED = 426] = "UPGRADE_REQUIRED", e[e.PRECONDITION_REQUIRED = 428] = "PRECONDITION_REQUIRED", e[e.TOO_MANY_REQUESTS = 429] = "TOO_MANY_REQUESTS", e[e.REQUEST_HEADER_FIELDS_TOO_LARGE = 431] = "REQUEST_HEADER_FIELDS_TOO_LARGE", e[e.UNAVAILABLE_FOR_LEGAL_REASONS = 451] = "UNAVAILABLE_FOR_LEGAL_REASONS", e[e.INTERNAL_SERVER_ERROR = 500] = "INTERNAL_SERVER_ERROR", e[e.NOT_IMPLEMENTED = 501] = "NOT_IMPLEMENTED", e[e.BAD_GATEWAY = 502] = "BAD_GATEWAY", e[e.SERVICE_UNAVAILABLE = 503] = "SERVICE_UNAVAILABLE", e[e.GATEWAY_TIMEOUT = 504] = "GATEWAY_TIMEOUT", e[e.HTTP_VERSION_NOT_SUPPORTED = 505] = "HTTP_VERSION_NOT_SUPPORTED", e[e.INSUFFICIENT_STORAGE = 507] = "INSUFFICIENT_STORAGE", e[e.NETWORK_AUTHENTICATION_REQUIRED = 511] = "NETWORK_AUTHENTICATION_REQUIRED";
})(se || (se = {}));
var ae;
(function(e) {
  e.ACCEPTED = "Accepted", e.BAD_GATEWAY = "Bad Gateway", e.BAD_REQUEST = "Bad Request", e.CONFLICT = "Conflict", e.CONTINUE = "Continue", e.CREATED = "Created", e.EXPECTATION_FAILED = "Expectation Failed", e.FAILED_DEPENDENCY = "Failed Dependency", e.FORBIDDEN = "Forbidden", e.GATEWAY_TIMEOUT = "Gateway Timeout", e.GONE = "Gone", e.HTTP_VERSION_NOT_SUPPORTED = "HTTP Version Not Supported", e.IM_A_TEAPOT = "I'm a teapot", e.INSUFFICIENT_SPACE_ON_RESOURCE = "Insufficient Space on Resource", e.INSUFFICIENT_STORAGE = "Insufficient Storage", e.INTERNAL_SERVER_ERROR = "Internal Server Error", e.LENGTH_REQUIRED = "Length Required", e.LOCKED = "Locked", e.METHOD_FAILURE = "Method Failure", e.METHOD_NOT_ALLOWED = "Method Not Allowed", e.MOVED_PERMANENTLY = "Moved Permanently", e.MOVED_TEMPORARILY = "Moved Temporarily", e.MULTI_STATUS = "Multi-Status", e.MULTIPLE_CHOICES = "Multiple Choices", e.NETWORK_AUTHENTICATION_REQUIRED = "Network Authentication Required", e.NO_CONTENT = "No Content", e.NON_AUTHORITATIVE_INFORMATION = "Non Authoritative Information", e.NOT_ACCEPTABLE = "Not Acceptable", e.NOT_FOUND = "Not Found", e.NOT_IMPLEMENTED = "Not Implemented", e.NOT_MODIFIED = "Not Modified", e.OK = "OK", e.PARTIAL_CONTENT = "Partial Content", e.PAYMENT_REQUIRED = "Payment Required", e.PERMANENT_REDIRECT = "Permanent Redirect", e.PRECONDITION_FAILED = "Precondition Failed", e.PRECONDITION_REQUIRED = "Precondition Required", e.PROCESSING = "Processing", e.EARLY_HINTS = "Early Hints", e.UPGRADE_REQUIRED = "Upgrade Required", e.PROXY_AUTHENTICATION_REQUIRED = "Proxy Authentication Required", e.REQUEST_HEADER_FIELDS_TOO_LARGE = "Request Header Fields Too Large", e.REQUEST_TIMEOUT = "Request Timeout", e.REQUEST_TOO_LONG = "Request Entity Too Large", e.REQUEST_URI_TOO_LONG = "Request-URI Too Long", e.REQUESTED_RANGE_NOT_SATISFIABLE = "Requested Range Not Satisfiable", e.RESET_CONTENT = "Reset Content", e.SEE_OTHER = "See Other", e.SERVICE_UNAVAILABLE = "Service Unavailable", e.SWITCHING_PROTOCOLS = "Switching Protocols", e.TEMPORARY_REDIRECT = "Temporary Redirect", e.TOO_MANY_REQUESTS = "Too Many Requests", e.UNAUTHORIZED = "Unauthorized", e.UNAVAILABLE_FOR_LEGAL_REASONS = "Unavailable For Legal Reasons", e.UNPROCESSABLE_ENTITY = "Unprocessable Entity", e.UNSUPPORTED_MEDIA_TYPE = "Unsupported Media Type", e.USE_PROXY = "Use Proxy", e.MISDIRECTED_REQUEST = "Misdirected Request";
})(ae || (ae = {}));
class we {
  constructor() {
    this.handlers = [];
  }
  /**
   * Add a new interceptor to the stack
   *
   * @param {Function} fulfilled The function to handle `then` for a `Promise`
   * @param {Function} rejected The function to handle `reject` for a `Promise`
   *
   * @return {Number} An ID used to remove interceptor later
   */
  use(t, n, r) {
    return this.handlers.push({
      fulfilled: t,
      rejected: n,
      synchronous: r ? r.synchronous : !1,
      runWhen: r ? r.runWhen : null
    }), this.handlers.length - 1;
  }
  /**
   * Remove an interceptor from the stack
   *
   * @param {Number} id The ID that was returned by `use`
   *
   * @returns {Boolean} `true` if the interceptor was removed, `false` otherwise
   */
  eject(t) {
    this.handlers[t] && (this.handlers[t] = null);
  }
  /**
   * Clear all interceptors from the stack
   *
   * @returns {void}
   */
  clear() {
    this.handlers && (this.handlers = []);
  }
  /**
   * Iterate over all the registered interceptors
   *
   * This method is particularly useful for skipping over any
   * interceptors that may have become `null` calling `eject`.
   *
   * @param {Function} fn The function to call for each interceptor
   *
   * @returns {void}
   */
  forEach(t) {
    a.forEach(this.handlers, function(r) {
      r !== null && t(r);
    });
  }
}
const $e = {
  silentJSONParsing: !0,
  forcedJSONParsing: !0,
  clarifyTimeoutError: !1
}, Jt = typeof URLSearchParams < "u" ? URLSearchParams : pe, Kt = typeof FormData < "u" ? FormData : null, Xt = typeof Blob < "u" ? Blob : null, Zt = {
  isBrowser: !0,
  classes: {
    URLSearchParams: Jt,
    FormData: Kt,
    Blob: Xt
  },
  protocols: ["http", "https", "file", "blob", "url", "data"]
}, me = typeof window < "u" && typeof document < "u", ce = typeof navigator == "object" && navigator || void 0, en = me && (!ce || ["ReactNative", "NativeScript", "NS"].indexOf(ce.product) < 0), tn = typeof WorkerGlobalScope < "u" && // eslint-disable-next-line no-undef
self instanceof WorkerGlobalScope && typeof self.importScripts == "function", nn = me && window.location.href || "http://localhost", rn = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  hasBrowserEnv: me,
  hasStandardBrowserEnv: en,
  hasStandardBrowserWebWorkerEnv: tn,
  navigator: ce,
  origin: nn
}, Symbol.toStringTag, { value: "Module" })), b = {
  ...rn,
  ...Zt
};
function on(e, t) {
  return K(e, new b.classes.URLSearchParams(), Object.assign({
    visitor: function(n, r, o, i) {
      return b.isNode && a.isBuffer(n) ? (this.append(r, n.toString("base64")), !1) : i.defaultVisitor.apply(this, arguments);
    }
  }, t));
}
function sn(e) {
  return a.matchAll(/\w+|\[(\w*)]/g, e).map((t) => t[0] === "[]" ? "" : t[1] || t[0]);
}
function an(e) {
  const t = {}, n = Object.keys(e);
  let r;
  const o = n.length;
  let i;
  for (r = 0; r < o; r++)
    i = n[r], t[i] = e[i];
  return t;
}
function We(e) {
  function t(n, r, o, i) {
    let s = n[i++];
    if (s === "__proto__") return !0;
    const c = Number.isFinite(+s), f = i >= n.length;
    return s = !s && a.isArray(o) ? o.length : s, f ? (a.hasOwnProp(o, s) ? o[s] = [o[s], r] : o[s] = r, !c) : ((!o[s] || !a.isObject(o[s])) && (o[s] = []), t(n, r, o[s], i) && a.isArray(o[s]) && (o[s] = an(o[s])), !c);
  }
  if (a.isFormData(e) && a.isFunction(e.entries)) {
    const n = {};
    return a.forEachEntry(e, (r, o) => {
      t(sn(r), o, n, 0);
    }), n;
  }
  return null;
}
function cn(e, t, n) {
  if (a.isString(e))
    try {
      return (t || JSON.parse)(e), a.trim(e);
    } catch (r) {
      if (r.name !== "SyntaxError")
        throw r;
    }
  return (0, JSON.stringify)(e);
}
const j = {
  transitional: $e,
  adapter: ["xhr", "http", "fetch"],
  transformRequest: [function(t, n) {
    const r = n.getContentType() || "", o = r.indexOf("application/json") > -1, i = a.isObject(t);
    if (i && a.isHTMLForm(t) && (t = new FormData(t)), a.isFormData(t))
      return o ? JSON.stringify(We(t)) : t;
    if (a.isArrayBuffer(t) || a.isBuffer(t) || a.isStream(t) || a.isFile(t) || a.isBlob(t) || a.isReadableStream(t))
      return t;
    if (a.isArrayBufferView(t))
      return t.buffer;
    if (a.isURLSearchParams(t))
      return n.setContentType("application/x-www-form-urlencoded;charset=utf-8", !1), t.toString();
    let c;
    if (i) {
      if (r.indexOf("application/x-www-form-urlencoded") > -1)
        return on(t, this.formSerializer).toString();
      if ((c = a.isFileList(t)) || r.indexOf("multipart/form-data") > -1) {
        const f = this.env && this.env.FormData;
        return K(
          c ? { "files[]": t } : t,
          f && new f(),
          this.formSerializer
        );
      }
    }
    return i || o ? (n.setContentType("application/json", !1), cn(t)) : t;
  }],
  transformResponse: [function(t) {
    const n = this.transitional || j.transitional, r = n && n.forcedJSONParsing, o = this.responseType === "json";
    if (a.isResponse(t) || a.isReadableStream(t))
      return t;
    if (t && a.isString(t) && (r && !this.responseType || o)) {
      const s = !(n && n.silentJSONParsing) && o;
      try {
        return JSON.parse(t);
      } catch (c) {
        if (s)
          throw c.name === "SyntaxError" ? T.from(c, T.ERR_BAD_RESPONSE, this, null, this.response) : c;
      }
    }
    return t;
  }],
  /**
   * A timeout in milliseconds to abort a request. If set to 0 (default) a
   * timeout is not created.
   */
  timeout: 0,
  xsrfCookieName: "XSRF-TOKEN",
  xsrfHeaderName: "X-XSRF-TOKEN",
  maxContentLength: -1,
  maxBodyLength: -1,
  env: {
    FormData: b.classes.FormData,
    Blob: b.classes.Blob
  },
  validateStatus: function(t) {
    return t >= 200 && t < 300;
  },
  headers: {
    common: {
      Accept: "application/json, text/plain, */*",
      "Content-Type": void 0
    }
  }
};
a.forEach(["delete", "get", "head", "post", "put", "patch"], (e) => {
  j.headers[e] = {};
});
const ln = a.toObjectSet([
  "age",
  "authorization",
  "content-length",
  "content-type",
  "etag",
  "expires",
  "from",
  "host",
  "if-modified-since",
  "if-unmodified-since",
  "last-modified",
  "location",
  "max-forwards",
  "proxy-authorization",
  "referer",
  "retry-after",
  "user-agent"
]), un = (e) => {
  const t = {};
  let n, r, o;
  return e && e.split(`
`).forEach(function(s) {
    o = s.indexOf(":"), n = s.substring(0, o).trim().toLowerCase(), r = s.substring(o + 1).trim(), !(!n || t[n] && ln[n]) && (n === "set-cookie" ? t[n] ? t[n].push(r) : t[n] = [r] : t[n] = t[n] ? t[n] + ", " + r : r);
  }), t;
}, be = Symbol("internals");
function H(e) {
  return e && String(e).trim().toLowerCase();
}
function z(e) {
  return e === !1 || e == null ? e : a.isArray(e) ? e.map(z) : String(e);
}
function fn(e) {
  const t = /* @__PURE__ */ Object.create(null), n = /([^\s,;=]+)\s*(?:=\s*([^,;]+))?/g;
  let r;
  for (; r = n.exec(e); )
    t[r[1]] = r[2];
  return t;
}
const En = (e) => /^[-_a-zA-Z0-9^`|~,!#$%&'*+.]+$/.test(e.trim());
function te(e, t, n, r, o) {
  if (a.isFunction(r))
    return r.call(this, t, n);
  if (o && (t = n), !!a.isString(t)) {
    if (a.isString(r))
      return t.indexOf(r) !== -1;
    if (a.isRegExp(r))
      return r.test(t);
  }
}
function dn(e) {
  return e.trim().toLowerCase().replace(/([a-z\d])(\w*)/g, (t, n, r) => n.toUpperCase() + r);
}
function pn(e, t) {
  const n = a.toCamelCase(" " + t);
  ["get", "set", "has"].forEach((r) => {
    Object.defineProperty(e, r + n, {
      value: function(o, i, s) {
        return this[r].call(this, t, o, i, s);
      },
      configurable: !0
    });
  });
}
let I = class {
  constructor(t) {
    t && this.set(t);
  }
  set(t, n, r) {
    const o = this;
    function i(c, f, l) {
      const u = H(f);
      if (!u)
        throw new Error("header name must be a non-empty string");
      const E = a.findKey(o, u);
      (!E || o[E] === void 0 || l === !0 || l === void 0 && o[E] !== !1) && (o[E || f] = z(c));
    }
    const s = (c, f) => a.forEach(c, (l, u) => i(l, u, f));
    if (a.isPlainObject(t) || t instanceof this.constructor)
      s(t, n);
    else if (a.isString(t) && (t = t.trim()) && !En(t))
      s(un(t), n);
    else if (a.isHeaders(t))
      for (const [c, f] of t.entries())
        i(f, c, r);
    else
      t != null && i(n, t, r);
    return this;
  }
  get(t, n) {
    if (t = H(t), t) {
      const r = a.findKey(this, t);
      if (r) {
        const o = this[r];
        if (!n)
          return o;
        if (n === !0)
          return fn(o);
        if (a.isFunction(n))
          return n.call(this, o, r);
        if (a.isRegExp(n))
          return n.exec(o);
        throw new TypeError("parser must be boolean|regexp|function");
      }
    }
  }
  has(t, n) {
    if (t = H(t), t) {
      const r = a.findKey(this, t);
      return !!(r && this[r] !== void 0 && (!n || te(this, this[r], r, n)));
    }
    return !1;
  }
  delete(t, n) {
    const r = this;
    let o = !1;
    function i(s) {
      if (s = H(s), s) {
        const c = a.findKey(r, s);
        c && (!n || te(r, r[c], c, n)) && (delete r[c], o = !0);
      }
    }
    return a.isArray(t) ? t.forEach(i) : i(t), o;
  }
  clear(t) {
    const n = Object.keys(this);
    let r = n.length, o = !1;
    for (; r--; ) {
      const i = n[r];
      (!t || te(this, this[i], i, t, !0)) && (delete this[i], o = !0);
    }
    return o;
  }
  normalize(t) {
    const n = this, r = {};
    return a.forEach(this, (o, i) => {
      const s = a.findKey(r, i);
      if (s) {
        n[s] = z(o), delete n[i];
        return;
      }
      const c = t ? dn(i) : String(i).trim();
      c !== i && delete n[i], n[c] = z(o), r[c] = !0;
    }), this;
  }
  concat(...t) {
    return this.constructor.concat(this, ...t);
  }
  toJSON(t) {
    const n = /* @__PURE__ */ Object.create(null);
    return a.forEach(this, (r, o) => {
      r != null && r !== !1 && (n[o] = t && a.isArray(r) ? r.join(", ") : r);
    }), n;
  }
  [Symbol.iterator]() {
    return Object.entries(this.toJSON())[Symbol.iterator]();
  }
  toString() {
    return Object.entries(this.toJSON()).map(([t, n]) => t + ": " + n).join(`
`);
  }
  get [Symbol.toStringTag]() {
    return "AxiosHeaders";
  }
  static from(t) {
    return t instanceof this ? t : new this(t);
  }
  static concat(t, ...n) {
    const r = new this(t);
    return n.forEach((o) => r.set(o)), r;
  }
  static accessor(t) {
    const r = (this[be] = this[be] = {
      accessors: {}
    }).accessors, o = this.prototype;
    function i(s) {
      const c = H(s);
      r[c] || (pn(o, s), r[c] = !0);
    }
    return a.isArray(t) ? t.forEach(i) : i(t), this;
  }
};
I.accessor(["Content-Type", "Content-Length", "Accept", "Accept-Encoding", "User-Agent", "Authorization"]);
a.reduceDescriptors(I.prototype, ({ value: e }, t) => {
  let n = t[0].toUpperCase() + t.slice(1);
  return {
    get: () => e,
    set(r) {
      this[n] = r;
    }
  };
});
a.freezeMethods(I);
function ne(e, t) {
  const n = this || j, r = t || n, o = I.from(r.headers);
  let i = r.data;
  return a.forEach(e, function(c) {
    i = c.call(n, i, o.normalize(), t ? t.status : void 0);
  }), o.normalize(), i;
}
function ve(e) {
  return !!(e && e.__CANCEL__);
}
function C(e, t, n) {
  T.call(this, e ?? "canceled", T.ERR_CANCELED, t, n), this.name = "CanceledError";
}
a.inherits(C, T, {
  __CANCEL__: !0
});
function Je(e, t, n) {
  const r = n.config.validateStatus;
  !n.status || !r || r(n.status) ? e(n) : t(new T(
    "Request failed with status code " + n.status,
    [T.ERR_BAD_REQUEST, T.ERR_BAD_RESPONSE][Math.floor(n.status / 100) - 4],
    n.config,
    n.request,
    n
  ));
}
function hn(e) {
  const t = /^([-+\w]{1,25})(:?\/\/|:)/.exec(e);
  return t && t[1] || "";
}
function Tn(e, t) {
  e = e || 10;
  const n = new Array(e), r = new Array(e);
  let o = 0, i = 0, s;
  return t = t !== void 0 ? t : 1e3, function(f) {
    const l = Date.now(), u = r[i];
    s || (s = l), n[o] = f, r[o] = l;
    let E = i, R = 0;
    for (; E !== o; )
      R += n[E++], E = E % e;
    if (o = (o + 1) % e, o === i && (i = (i + 1) % e), l - s < t)
      return;
    const A = u && l - u;
    return A ? Math.round(R * 1e3 / A) : void 0;
  };
}
function mn(e, t) {
  let n = 0, r = 1e3 / t, o, i;
  const s = (l, u = Date.now()) => {
    n = u, o = null, i && (clearTimeout(i), i = null), e.apply(null, l);
  };
  return [(...l) => {
    const u = Date.now(), E = u - n;
    E >= r ? s(l, u) : (o = l, i || (i = setTimeout(() => {
      i = null, s(o);
    }, r - E)));
  }, () => o && s(o)];
}
const Y = (e, t, n = 3) => {
  let r = 0;
  const o = Tn(50, 250);
  return mn((i) => {
    const s = i.loaded, c = i.lengthComputable ? i.total : void 0, f = s - r, l = o(f), u = s <= c;
    r = s;
    const E = {
      loaded: s,
      total: c,
      progress: c ? s / c : void 0,
      bytes: f,
      rate: l || void 0,
      estimated: l && c && u ? (c - s) / l : void 0,
      event: i,
      lengthComputable: c != null,
      [t ? "download" : "upload"]: !0
    };
    e(E);
  }, n);
}, Ie = (e, t) => {
  const n = e != null;
  return [(r) => t[0]({
    lengthComputable: n,
    total: e,
    loaded: r
  }), t[1]];
}, Se = (e) => (...t) => a.asap(() => e(...t)), Rn = b.hasStandardBrowserEnv ? (
  // Standard browser envs have full support of the APIs needed to test
  // whether the request URL is of the same origin as current location.
  function() {
    const t = b.navigator && /(msie|trident)/i.test(b.navigator.userAgent), n = document.createElement("a");
    let r;
    function o(i) {
      let s = i;
      return t && (n.setAttribute("href", s), s = n.href), n.setAttribute("href", s), {
        href: n.href,
        protocol: n.protocol ? n.protocol.replace(/:$/, "") : "",
        host: n.host,
        search: n.search ? n.search.replace(/^\?/, "") : "",
        hash: n.hash ? n.hash.replace(/^#/, "") : "",
        hostname: n.hostname,
        port: n.port,
        pathname: n.pathname.charAt(0) === "/" ? n.pathname : "/" + n.pathname
      };
    }
    return r = o(window.location.href), function(s) {
      const c = a.isString(s) ? o(s) : s;
      return c.protocol === r.protocol && c.host === r.host;
    };
  }()
) : (
  // Non standard browser envs (web workers, react-native) lack needed support.
  /* @__PURE__ */ function() {
    return function() {
      return !0;
    };
  }()
), On = b.hasStandardBrowserEnv ? (
  // Standard browser envs support document.cookie
  {
    write(e, t, n, r, o, i) {
      const s = [e + "=" + encodeURIComponent(t)];
      a.isNumber(n) && s.push("expires=" + new Date(n).toGMTString()), a.isString(r) && s.push("path=" + r), a.isString(o) && s.push("domain=" + o), i === !0 && s.push("secure"), document.cookie = s.join("; ");
    },
    read(e) {
      const t = document.cookie.match(new RegExp("(^|;\\s*)(" + e + ")=([^;]*)"));
      return t ? decodeURIComponent(t[3]) : null;
    },
    remove(e) {
      this.write(e, "", Date.now() - 864e5);
    }
  }
) : (
  // Non-standard browser env (web workers, react-native) lack needed support.
  {
    write() {
    },
    read() {
      return null;
    },
    remove() {
    }
  }
), De = (e) => e instanceof I ? { ...e } : e;
function B(e, t) {
  t = t || {};
  const n = {};
  function r(l, u, E) {
    return a.isPlainObject(l) && a.isPlainObject(u) ? a.merge.call({ caseless: E }, l, u) : a.isPlainObject(u) ? a.merge({}, u) : a.isArray(u) ? u.slice() : u;
  }
  function o(l, u, E) {
    if (a.isUndefined(u)) {
      if (!a.isUndefined(l))
        return r(void 0, l, E);
    } else return r(l, u, E);
  }
  function i(l, u) {
    if (!a.isUndefined(u))
      return r(void 0, u);
  }
  function s(l, u) {
    if (a.isUndefined(u)) {
      if (!a.isUndefined(l))
        return r(void 0, l);
    } else return r(void 0, u);
  }
  function c(l, u, E) {
    if (E in t)
      return r(l, u);
    if (E in e)
      return r(void 0, l);
  }
  const f = {
    url: i,
    method: i,
    data: i,
    baseURL: s,
    transformRequest: s,
    transformResponse: s,
    paramsSerializer: s,
    timeout: s,
    timeoutMessage: s,
    withCredentials: s,
    withXSRFToken: s,
    adapter: s,
    responseType: s,
    xsrfCookieName: s,
    xsrfHeaderName: s,
    onUploadProgress: s,
    onDownloadProgress: s,
    decompress: s,
    maxContentLength: s,
    maxBodyLength: s,
    beforeRedirect: s,
    transport: s,
    httpAgent: s,
    httpsAgent: s,
    cancelToken: s,
    socketPath: s,
    responseEncoding: s,
    validateStatus: c,
    headers: (l, u) => o(De(l), De(u), !0)
  };
  return a.forEach(Object.keys(Object.assign({}, e, t)), function(u) {
    const E = f[u] || o, R = E(e[u], t[u], u);
    a.isUndefined(R) && E !== c || (n[u] = R);
  }), n;
}
const Ke = (e) => {
  const t = B({}, e);
  let { data: n, withXSRFToken: r, xsrfHeaderName: o, xsrfCookieName: i, headers: s, auth: c } = t;
  t.headers = s = I.from(s), t.url = he(Te(t.baseURL, t.url), e.params, e.paramsSerializer), c && s.set(
    "Authorization",
    "Basic " + btoa((c.username || "") + ":" + (c.password ? unescape(encodeURIComponent(c.password)) : ""))
  );
  let f;
  if (a.isFormData(n)) {
    if (b.hasStandardBrowserEnv || b.hasStandardBrowserWebWorkerEnv)
      s.setContentType(void 0);
    else if ((f = s.getContentType()) !== !1) {
      const [l, ...u] = f ? f.split(";").map((E) => E.trim()).filter(Boolean) : [];
      s.setContentType([l || "multipart/form-data", ...u].join("; "));
    }
  }
  if (b.hasStandardBrowserEnv && (r && a.isFunction(r) && (r = r(t)), r || r !== !1 && Rn(t.url))) {
    const l = o && i && On.read(i);
    l && s.set(o, l);
  }
  return t;
}, An = typeof XMLHttpRequest < "u", _n = An && function(e) {
  return new Promise(function(n, r) {
    const o = Ke(e);
    let i = o.data;
    const s = I.from(o.headers).normalize();
    let { responseType: c, onUploadProgress: f, onDownloadProgress: l } = o, u, E, R, A, d;
    function h() {
      A && A(), d && d(), o.cancelToken && o.cancelToken.unsubscribe(u), o.signal && o.signal.removeEventListener("abort", u);
    }
    let p = new XMLHttpRequest();
    p.open(o.method.toUpperCase(), o.url, !0), p.timeout = o.timeout;
    function O() {
      if (!p)
        return;
      const m = I.from(
        "getAllResponseHeaders" in p && p.getAllResponseHeaders()
      ), y = {
        data: !c || c === "text" || c === "json" ? p.responseText : p.response,
        status: p.status,
        statusText: p.statusText,
        headers: m,
        config: e,
        request: p
      };
      Je(function(P) {
        n(P), h();
      }, function(P) {
        r(P), h();
      }, y), p = null;
    }
    "onloadend" in p ? p.onloadend = O : p.onreadystatechange = function() {
      !p || p.readyState !== 4 || p.status === 0 && !(p.responseURL && p.responseURL.indexOf("file:") === 0) || setTimeout(O);
    }, p.onabort = function() {
      p && (r(new T("Request aborted", T.ECONNABORTED, e, p)), p = null);
    }, p.onerror = function() {
      r(new T("Network Error", T.ERR_NETWORK, e, p)), p = null;
    }, p.ontimeout = function() {
      let S = o.timeout ? "timeout of " + o.timeout + "ms exceeded" : "timeout exceeded";
      const y = o.transitional || $e;
      o.timeoutErrorMessage && (S = o.timeoutErrorMessage), r(new T(
        S,
        y.clarifyTimeoutError ? T.ETIMEDOUT : T.ECONNABORTED,
        e,
        p
      )), p = null;
    }, i === void 0 && s.setContentType(null), "setRequestHeader" in p && a.forEach(s.toJSON(), function(S, y) {
      p.setRequestHeader(y, S);
    }), a.isUndefined(o.withCredentials) || (p.withCredentials = !!o.withCredentials), c && c !== "json" && (p.responseType = o.responseType), l && ([R, d] = Y(l, !0), p.addEventListener("progress", R)), f && p.upload && ([E, A] = Y(f), p.upload.addEventListener("progress", E), p.upload.addEventListener("loadend", A)), (o.cancelToken || o.signal) && (u = (m) => {
      p && (r(!m || m.type ? new C(null, e, p) : m), p.abort(), p = null);
    }, o.cancelToken && o.cancelToken.subscribe(u), o.signal && (o.signal.aborted ? u() : o.signal.addEventListener("abort", u)));
    const _ = hn(o.url);
    if (_ && b.protocols.indexOf(_) === -1) {
      r(new T("Unsupported protocol " + _ + ":", T.ERR_BAD_REQUEST, e));
      return;
    }
    p.send(i || null);
  });
}, Nn = (e, t) => {
  const { length: n } = e = e ? e.filter(Boolean) : [];
  if (t || n) {
    let r = new AbortController(), o;
    const i = function(l) {
      if (!o) {
        o = !0, c();
        const u = l instanceof Error ? l : this.reason;
        r.abort(u instanceof T ? u : new C(u instanceof Error ? u.message : u));
      }
    };
    let s = t && setTimeout(() => {
      s = null, i(new T(`timeout ${t} of ms exceeded`, T.ETIMEDOUT));
    }, t);
    const c = () => {
      e && (s && clearTimeout(s), s = null, e.forEach((l) => {
        l.unsubscribe ? l.unsubscribe(i) : l.removeEventListener("abort", i);
      }), e = null);
    };
    e.forEach((l) => l.addEventListener("abort", i));
    const { signal: f } = r;
    return f.unsubscribe = () => a.asap(c), f;
  }
}, yn = function* (e, t) {
  let n = e.byteLength;
  if (n < t) {
    yield e;
    return;
  }
  let r = 0, o;
  for (; r < n; )
    o = r + t, yield e.slice(r, o), r = o;
}, wn = async function* (e, t) {
  for await (const n of bn(e))
    yield* yn(n, t);
}, bn = async function* (e) {
  if (e[Symbol.asyncIterator]) {
    yield* e;
    return;
  }
  const t = e.getReader();
  try {
    for (; ; ) {
      const { done: n, value: r } = await t.read();
      if (n)
        break;
      yield r;
    }
  } finally {
    await t.cancel();
  }
}, Ue = (e, t, n, r) => {
  const o = wn(e, t);
  let i = 0, s, c = (f) => {
    s || (s = !0, r && r(f));
  };
  return new ReadableStream({
    async pull(f) {
      try {
        const { done: l, value: u } = await o.next();
        if (l) {
          c(), f.close();
          return;
        }
        let E = u.byteLength;
        if (n) {
          let R = i += E;
          n(R);
        }
        f.enqueue(new Uint8Array(u));
      } catch (l) {
        throw c(l), l;
      }
    },
    cancel(f) {
      return c(f), o.return();
    }
  }, {
    highWaterMark: 2
  });
}, X = typeof fetch == "function" && typeof Request == "function" && typeof Response == "function", Xe = X && typeof ReadableStream == "function", In = X && (typeof TextEncoder == "function" ? /* @__PURE__ */ ((e) => (t) => e.encode(t))(new TextEncoder()) : async (e) => new Uint8Array(await new Response(e).arrayBuffer())), Ze = (e, ...t) => {
  try {
    return !!e(...t);
  } catch {
    return !1;
  }
}, Sn = Xe && Ze(() => {
  let e = !1;
  const t = new Request(b.origin, {
    body: new ReadableStream(),
    method: "POST",
    get duplex() {
      return e = !0, "half";
    }
  }).headers.has("Content-Type");
  return e && !t;
}), Le = 64 * 1024, le = Xe && Ze(() => a.isReadableStream(new Response("").body)), $ = {
  stream: le && ((e) => e.body)
};
X && ((e) => {
  ["text", "arrayBuffer", "blob", "formData", "stream"].forEach((t) => {
    !$[t] && ($[t] = a.isFunction(e[t]) ? (n) => n[t]() : (n, r) => {
      throw new T(`Response type '${t}' is not supported`, T.ERR_NOT_SUPPORT, r);
    });
  });
})(new Response());
const Dn = async (e) => {
  if (e == null)
    return 0;
  if (a.isBlob(e))
    return e.size;
  if (a.isSpecCompliantForm(e))
    return (await new Request(b.origin, {
      method: "POST",
      body: e
    }).arrayBuffer()).byteLength;
  if (a.isArrayBufferView(e) || a.isArrayBuffer(e))
    return e.byteLength;
  if (a.isURLSearchParams(e) && (e = e + ""), a.isString(e))
    return (await In(e)).byteLength;
}, Un = async (e, t) => {
  const n = a.toFiniteNumber(e.getContentLength());
  return n ?? Dn(t);
}, Ln = X && (async (e) => {
  let {
    url: t,
    method: n,
    data: r,
    signal: o,
    cancelToken: i,
    timeout: s,
    onDownloadProgress: c,
    onUploadProgress: f,
    responseType: l,
    headers: u,
    withCredentials: E = "same-origin",
    fetchOptions: R
  } = Ke(e);
  l = l ? (l + "").toLowerCase() : "text";
  let A = Nn([o, i && i.toAbortSignal()], s), d;
  const h = A && A.unsubscribe && (() => {
    A.unsubscribe();
  });
  let p;
  try {
    if (f && Sn && n !== "get" && n !== "head" && (p = await Un(u, r)) !== 0) {
      let y = new Request(t, {
        method: "POST",
        body: r,
        duplex: "half"
      }), w;
      if (a.isFormData(r) && (w = y.headers.get("content-type")) && u.setContentType(w), y.body) {
        const [P, G] = Ie(
          p,
          Y(Se(f))
        );
        r = Ue(y.body, Le, P, G);
      }
    }
    a.isString(E) || (E = E ? "include" : "omit");
    const O = "credentials" in Request.prototype;
    d = new Request(t, {
      ...R,
      signal: A,
      method: n.toUpperCase(),
      headers: u.normalize().toJSON(),
      body: r,
      duplex: "half",
      credentials: O ? E : void 0
    });
    let _ = await fetch(d);
    const m = le && (l === "stream" || l === "response");
    if (le && (c || m && h)) {
      const y = {};
      ["status", "statusText", "headers"].forEach((Oe) => {
        y[Oe] = _[Oe];
      });
      const w = a.toFiniteNumber(_.headers.get("content-length")), [P, G] = c && Ie(
        w,
        Y(Se(c), !0)
      ) || [];
      _ = new Response(
        Ue(_.body, Le, P, () => {
          G && G(), h && h();
        }),
        y
      );
    }
    l = l || "text";
    let S = await $[a.findKey($, l) || "text"](_, e);
    return !m && h && h(), await new Promise((y, w) => {
      Je(y, w, {
        data: S,
        headers: I.from(_.headers),
        status: _.status,
        statusText: _.statusText,
        config: e,
        request: d
      });
    });
  } catch (O) {
    throw h && h(), O && O.name === "TypeError" && /fetch/i.test(O.message) ? Object.assign(
      new T("Network Error", T.ERR_NETWORK, e, d),
      {
        cause: O.cause || O
      }
    ) : T.from(O, O && O.code, e, d);
  }
}), ue = {
  http: Vt,
  xhr: _n,
  fetch: Ln
};
a.forEach(ue, (e, t) => {
  if (e) {
    try {
      Object.defineProperty(e, "name", { value: t });
    } catch {
    }
    Object.defineProperty(e, "adapterName", { value: t });
  }
});
const ge = (e) => `- ${e}`, gn = (e) => a.isFunction(e) || e === null || e === !1, et = {
  getAdapter: (e) => {
    e = a.isArray(e) ? e : [e];
    const { length: t } = e;
    let n, r;
    const o = {};
    for (let i = 0; i < t; i++) {
      n = e[i];
      let s;
      if (r = n, !gn(n) && (r = ue[(s = String(n)).toLowerCase()], r === void 0))
        throw new T(`Unknown adapter '${s}'`);
      if (r)
        break;
      o[s || "#" + i] = r;
    }
    if (!r) {
      const i = Object.entries(o).map(
        ([c, f]) => `adapter ${c} ` + (f === !1 ? "is not supported by the environment" : "is not available in the build")
      );
      let s = t ? i.length > 1 ? `since :
` + i.map(ge).join(`
`) : " " + ge(i[0]) : "as no adapter specified";
      throw new T(
        "There is no suitable adapter to dispatch the request " + s,
        "ERR_NOT_SUPPORT"
      );
    }
    return r;
  },
  adapters: ue
};
function re(e) {
  if (e.cancelToken && e.cancelToken.throwIfRequested(), e.signal && e.signal.aborted)
    throw new C(null, e);
}
function Pe(e) {
  return re(e), e.headers = I.from(e.headers), e.data = ne.call(
    e,
    e.transformRequest
  ), ["post", "put", "patch"].indexOf(e.method) !== -1 && e.headers.setContentType("application/x-www-form-urlencoded", !1), et.getAdapter(e.adapter || j.adapter)(e).then(function(r) {
    return re(e), r.data = ne.call(
      e,
      e.transformResponse,
      r
    ), r.headers = I.from(r.headers), r;
  }, function(r) {
    return ve(r) || (re(e), r && r.response && (r.response.data = ne.call(
      e,
      e.transformResponse,
      r.response
    ), r.response.headers = I.from(r.response.headers))), Promise.reject(r);
  });
}
const tt = "1.7.7", Re = {};
["object", "boolean", "number", "function", "string", "symbol"].forEach((e, t) => {
  Re[e] = function(r) {
    return typeof r === e || "a" + (t < 1 ? "n " : " ") + e;
  };
});
const Fe = {};
Re.transitional = function(t, n, r) {
  function o(i, s) {
    return "[Axios v" + tt + "] Transitional option '" + i + "'" + s + (r ? ". " + r : "");
  }
  return (i, s, c) => {
    if (t === !1)
      throw new T(
        o(s, " has been removed" + (n ? " in " + n : "")),
        T.ERR_DEPRECATED
      );
    return n && !Fe[s] && (Fe[s] = !0, console.warn(
      o(
        s,
        " has been deprecated since v" + n + " and will be removed in the near future"
      )
    )), t ? t(i, s, c) : !0;
  };
};
function Pn(e, t, n) {
  if (typeof e != "object")
    throw new T("options must be an object", T.ERR_BAD_OPTION_VALUE);
  const r = Object.keys(e);
  let o = r.length;
  for (; o-- > 0; ) {
    const i = r[o], s = t[i];
    if (s) {
      const c = e[i], f = c === void 0 || s(c, i, e);
      if (f !== !0)
        throw new T("option " + i + " must be " + f, T.ERR_BAD_OPTION_VALUE);
      continue;
    }
    if (n !== !0)
      throw new T("Unknown option " + i, T.ERR_BAD_OPTION);
  }
}
const fe = {
  assertOptions: Pn,
  validators: Re
}, g = fe.validators;
let x = class {
  constructor(t) {
    this.defaults = t, this.interceptors = {
      request: new we(),
      response: new we()
    };
  }
  /**
   * Dispatch a request
   *
   * @param {String|Object} configOrUrl The config specific for this request (merged with this.defaults)
   * @param {?Object} config
   *
   * @returns {Promise} The Promise to be fulfilled
   */
  async request(t, n) {
    try {
      return await this._request(t, n);
    } catch (r) {
      if (r instanceof Error) {
        let o;
        Error.captureStackTrace ? Error.captureStackTrace(o = {}) : o = new Error();
        const i = o.stack ? o.stack.replace(/^.+\n/, "") : "";
        try {
          r.stack ? i && !String(r.stack).endsWith(i.replace(/^.+\n.+\n/, "")) && (r.stack += `
` + i) : r.stack = i;
        } catch {
        }
      }
      throw r;
    }
  }
  _request(t, n) {
    typeof t == "string" ? (n = n || {}, n.url = t) : n = t || {}, n = B(this.defaults, n);
    const { transitional: r, paramsSerializer: o, headers: i } = n;
    r !== void 0 && fe.assertOptions(r, {
      silentJSONParsing: g.transitional(g.boolean),
      forcedJSONParsing: g.transitional(g.boolean),
      clarifyTimeoutError: g.transitional(g.boolean)
    }, !1), o != null && (a.isFunction(o) ? n.paramsSerializer = {
      serialize: o
    } : fe.assertOptions(o, {
      encode: g.function,
      serialize: g.function
    }, !0)), n.method = (n.method || this.defaults.method || "get").toLowerCase();
    let s = i && a.merge(
      i.common,
      i[n.method]
    );
    i && a.forEach(
      ["delete", "get", "head", "post", "put", "patch", "common"],
      (d) => {
        delete i[d];
      }
    ), n.headers = I.concat(s, i);
    const c = [];
    let f = !0;
    this.interceptors.request.forEach(function(h) {
      typeof h.runWhen == "function" && h.runWhen(n) === !1 || (f = f && h.synchronous, c.unshift(h.fulfilled, h.rejected));
    });
    const l = [];
    this.interceptors.response.forEach(function(h) {
      l.push(h.fulfilled, h.rejected);
    });
    let u, E = 0, R;
    if (!f) {
      const d = [Pe.bind(this), void 0];
      for (d.unshift.apply(d, c), d.push.apply(d, l), R = d.length, u = Promise.resolve(n); E < R; )
        u = u.then(d[E++], d[E++]);
      return u;
    }
    R = c.length;
    let A = n;
    for (E = 0; E < R; ) {
      const d = c[E++], h = c[E++];
      try {
        A = d(A);
      } catch (p) {
        h.call(this, p);
        break;
      }
    }
    try {
      u = Pe.call(this, A);
    } catch (d) {
      return Promise.reject(d);
    }
    for (E = 0, R = l.length; E < R; )
      u = u.then(l[E++], l[E++]);
    return u;
  }
  getUri(t) {
    t = B(this.defaults, t);
    const n = Te(t.baseURL, t.url);
    return he(n, t.params, t.paramsSerializer);
  }
};
a.forEach(["delete", "get", "head", "options"], function(t) {
  x.prototype[t] = function(n, r) {
    return this.request(B(r || {}, {
      method: t,
      url: n,
      data: (r || {}).data
    }));
  };
});
a.forEach(["post", "put", "patch"], function(t) {
  function n(r) {
    return function(i, s, c) {
      return this.request(B(c || {}, {
        method: t,
        headers: r ? {
          "Content-Type": "multipart/form-data"
        } : {},
        url: i,
        data: s
      }));
    };
  }
  x.prototype[t] = n(), x.prototype[t + "Form"] = n(!0);
});
let Fn = class nt {
  constructor(t) {
    if (typeof t != "function")
      throw new TypeError("executor must be a function.");
    let n;
    this.promise = new Promise(function(i) {
      n = i;
    });
    const r = this;
    this.promise.then((o) => {
      if (!r._listeners) return;
      let i = r._listeners.length;
      for (; i-- > 0; )
        r._listeners[i](o);
      r._listeners = null;
    }), this.promise.then = (o) => {
      let i;
      const s = new Promise((c) => {
        r.subscribe(c), i = c;
      }).then(o);
      return s.cancel = function() {
        r.unsubscribe(i);
      }, s;
    }, t(function(i, s, c) {
      r.reason || (r.reason = new C(i, s, c), n(r.reason));
    });
  }
  /**
   * Throws a `CanceledError` if cancellation has been requested.
   */
  throwIfRequested() {
    if (this.reason)
      throw this.reason;
  }
  /**
   * Subscribe to the cancel signal
   */
  subscribe(t) {
    if (this.reason) {
      t(this.reason);
      return;
    }
    this._listeners ? this._listeners.push(t) : this._listeners = [t];
  }
  /**
   * Unsubscribe from the cancel signal
   */
  unsubscribe(t) {
    if (!this._listeners)
      return;
    const n = this._listeners.indexOf(t);
    n !== -1 && this._listeners.splice(n, 1);
  }
  toAbortSignal() {
    const t = new AbortController(), n = (r) => {
      t.abort(r);
    };
    return this.subscribe(n), t.signal.unsubscribe = () => this.unsubscribe(n), t.signal;
  }
  /**
   * Returns an object that contains a new `CancelToken` and a function that, when called,
   * cancels the `CancelToken`.
   */
  static source() {
    let t;
    return {
      token: new nt(function(o) {
        t = o;
      }),
      cancel: t
    };
  }
};
function xn(e) {
  return function(n) {
    return e.apply(null, n);
  };
}
function Bn(e) {
  return a.isObject(e) && e.isAxiosError === !0;
}
const Ee = {
  Continue: 100,
  SwitchingProtocols: 101,
  Processing: 102,
  EarlyHints: 103,
  Ok: 200,
  Created: 201,
  Accepted: 202,
  NonAuthoritativeInformation: 203,
  NoContent: 204,
  ResetContent: 205,
  PartialContent: 206,
  MultiStatus: 207,
  AlreadyReported: 208,
  ImUsed: 226,
  MultipleChoices: 300,
  MovedPermanently: 301,
  Found: 302,
  SeeOther: 303,
  NotModified: 304,
  UseProxy: 305,
  Unused: 306,
  TemporaryRedirect: 307,
  PermanentRedirect: 308,
  BadRequest: 400,
  Unauthorized: 401,
  PaymentRequired: 402,
  Forbidden: 403,
  NotFound: 404,
  MethodNotAllowed: 405,
  NotAcceptable: 406,
  ProxyAuthenticationRequired: 407,
  RequestTimeout: 408,
  Conflict: 409,
  Gone: 410,
  LengthRequired: 411,
  PreconditionFailed: 412,
  PayloadTooLarge: 413,
  UriTooLong: 414,
  UnsupportedMediaType: 415,
  RangeNotSatisfiable: 416,
  ExpectationFailed: 417,
  ImATeapot: 418,
  MisdirectedRequest: 421,
  UnprocessableEntity: 422,
  Locked: 423,
  FailedDependency: 424,
  TooEarly: 425,
  UpgradeRequired: 426,
  PreconditionRequired: 428,
  TooManyRequests: 429,
  RequestHeaderFieldsTooLarge: 431,
  UnavailableForLegalReasons: 451,
  InternalServerError: 500,
  NotImplemented: 501,
  BadGateway: 502,
  ServiceUnavailable: 503,
  GatewayTimeout: 504,
  HttpVersionNotSupported: 505,
  VariantAlsoNegotiates: 506,
  InsufficientStorage: 507,
  LoopDetected: 508,
  NotExtended: 510,
  NetworkAuthenticationRequired: 511
};
Object.entries(Ee).forEach(([e, t]) => {
  Ee[t] = e;
});
function rt(e) {
  const t = new x(e), n = Be(x.prototype.request, t);
  return a.extend(n, x.prototype, t, { allOwnKeys: !0 }), a.extend(n, t, null, { allOwnKeys: !0 }), n.create = function(o) {
    return rt(B(e, o));
  }, n;
}
const N = rt(j);
N.Axios = x;
N.CanceledError = C;
N.CancelToken = Fn;
N.isCancel = ve;
N.VERSION = tt;
N.toFormData = K;
N.AxiosError = T;
N.Cancel = N.CanceledError;
N.all = function(t) {
  return Promise.all(t);
};
N.spread = xn;
N.isAxiosError = Bn;
N.mergeConfig = B;
N.AxiosHeaders = I;
N.formToJSON = (e) => We(a.isHTMLForm(e) ? new FormData(e) : e);
N.getAdapter = et.getAdapter;
N.HttpStatusCode = Ee;
N.default = N;
const {
  Axios: jn,
  AxiosError: U,
  CanceledError: Gn,
  isCancel: Qn,
  CancelToken: Vn,
  VERSION: zn,
  all: Yn,
  Cancel: $n,
  isAxiosError: Wn,
  spread: vn,
  toFormData: Jn,
  AxiosHeaders: Kn,
  HttpStatusCode: Xn,
  formToJSON: Zn,
  getAdapter: er,
  mergeConfig: tr
} = N, Mn = (e) => Buffer.from(e, "binary").toString("base64"), Cn = (e) => {
  const t = e.username || "", n = e.password ? encodeURIComponent(e.password) : "";
  return {
    Authorization: `Basic ${Mn(`${t}:${n}`)}`
  };
}, Hn = (e) => ({
  Authorization: `Bearer ${e}`
}), xe = (e, t) => {
  switch (t) {
    case "arraybuffer":
      return new Response(e).arrayBuffer();
    case "blob":
      return new Response(e).blob();
    case "formdata":
      return new Response(e).formData();
    case "json":
      return new Response(e).json();
    case "text":
      return new Response(e).text();
    default:
      throw new Error("Response type unsupported type: " + t);
  }
}, nr = (e) => new Promise((t, n) => {
  const r = he(Te(e.baseURL, e.url), e.params, e.paramsSerializer), o = {
    method: e.method,
    headers: {
      ...e.headers,
      ...e.auth && Cn(e.auth),
      ...e.jwt && Hn(e.jwt)
    },
    connectTimeout: e.timeout < 1e3 ? void 0 : e.timeout,
    maxRedirections: e.maxRedirects,
    body: e.data
  };
  ot(r, o).then((i) => {
    const s = ae[se[i.status]], c = e.responseType || "json";
    if (i.ok)
      if (i.body !== null)
        xe(i.body, c).then((f) => t({
          data: f,
          status: i.status,
          statusText: s,
          headers: {
            ...i.headers
          },
          rawHeaders: i['raw-headers'],
          config: e
        })).catch((f) => n(
          new U(f, U.ERR_BAD_RESPONSE, e, {
            url: r,
            ...o
          })
        ));
      else
        return t({
          data: i.body,
          status: i.status,
          statusText: s,
          headers: {
            ...i.headers
          },
          config: e
        });
    else if (i.body !== null)
      xe(i.body, c).then((f) => n(
        new U(
          "Request failed with status code " + i.status,
          [U.ERR_BAD_REQUEST, U.ERR_BAD_RESPONSE][Math.floor(i.status / 100) - 4],
          e,
          {
            url: r,
            ...o
          },
          {
            config: e,
            data: f,
            headers: i.headers,
            status: i.status,
            statusText: s
          }
        )
      )).catch((f) => n(
        new U(f, U.ERR_BAD_RESPONSE, e, {
          url: r,
          ...o
        })
      ));
    else
      return n(
        new U(
          "Request failed with status code " + i.status,
          [U.ERR_BAD_REQUEST, U.ERR_BAD_RESPONSE][Math.floor(i.status / 100) - 4],
          e,
          {
            url: r,
            ...o
          },
          {
            config: e,
            data: i.body,
            headers: i.headers,
            status: i.status,
            statusText: s
          }
        )
      );
  }).catch((i) => n(new U(i, U.ERR_BAD_REQUEST, e)));
});
export {
  nr as default
};
