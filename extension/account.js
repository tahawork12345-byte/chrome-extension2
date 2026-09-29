/* ATLAS NEW TAB — account
   Sign in with Google, through the backend in backend/ (ACCOUNT_CONFIG in
   config.js). Google's sign-in page opens in a popup
   (chrome.identity.launchWebAuthFlow) and hands back an ID token; the
   backend checks it and answers with its own session:
   { accessToken (short-lived), refreshToken (rotates on each use), user }.

   The session is kept in chrome.storage.local. Every call goes through
   api(), which refreshes an expired access token once and retries.
   Customize > Account is the screen for all of this.                    */

(() => {
  "use strict";

  const CFG = typeof ACCOUNT_CONFIG !== "undefined" ? ACCOUNT_CONFIG : {};
  const API = String(CFG.api || "").replace(/\/+$/, "");
  const CLIENT_ID = String(CFG.googleClientId || "");
  const KEY = "account:session";
  const SYNC_KEY = "account:lastSync";
  /* what "Save to account" uploads: the Customize settings and the
     shortcuts. Both are kept as the exact strings in storage. */
  const SYNC_KEYS = ["appearance", "layout"];

  const hasChrome = typeof chrome !== "undefined" && chrome.storage && chrome.storage.local;
  const get = (k) => new Promise((r) => (hasChrome ? chrome.storage.local.get([k], (o) => r(o[k])) : r(null)));
  const put = (obj) => new Promise((r) => (hasChrome ? chrome.storage.local.set(obj, r) : r()));
  const drop = (k) => new Promise((r) => (hasChrome ? chrome.storage.local.remove(k, r) : r()));

  let session = null; // { accessToken, refreshToken, user }
  const listeners = [];
  const emit = () => listeners.forEach((fn) => { try { fn(session); } catch (e) { console.error(e); } });

  async function setSession(s) {
    session = s && s.accessToken && s.refreshToken ? s : null;
    if (session) await put({ [KEY]: session });
    else await drop(KEY);
    emit();
  }

  const ready = get(KEY).then((s) => {
    session = s && s.accessToken && s.refreshToken ? s : null;
    return session;
  });

  /* another tab signed in or out */
  if (hasChrome) chrome.storage.onChanged.addListener((ch, area) => {
    if (area !== "local" || !ch[KEY]) return;
    const next = ch[KEY].newValue || null;
    if (JSON.stringify(next) === JSON.stringify(session)) return; // our own write
    session = next;
    emit();
  });

  /* ---------- talking to the backend ---------- */
  class ApiError extends Error {
    constructor(message, status, code) { super(message); this.status = status; this.code = code; }
  }

  async function request(path, { method = "GET", body, token } = {}) {
    let res;
    try {
      res = await fetch(API + path, {
        method,
        headers: Object.assign(
          body !== undefined ? { "Content-Type": "application/json" } : {},
          token ? { Authorization: "Bearer " + token } : {}),
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new ApiError("Can't reach the Atlas server. Check your connection.", 0, "offline");
    }
    if (res.status === 204) return null;
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(data.error || "The server answered " + res.status, res.status, data.code);
    return data;
  }

  /* one refresh at a time, however many calls hit an expired token */
  let refreshing = null;
  function refresh() {
    if (!refreshing) {
      const rt = session && session.refreshToken;
      refreshing = request("/auth/refresh", { method: "POST", body: { refreshToken: rt } })
        .then((s) => setSession(s))
        .catch(async (err) => {
          /* a refresh token that no longer works means signed out */
          if (err.status === 401) await setSession(null);
          throw err;
        })
        .finally(() => { refreshing = null; });
    }
    return refreshing;
  }

  async function api(path, opts = {}) {
    await ready;
    if (!session) throw new ApiError("You're signed out.", 401, "signed_out");
    try {
      return await request(path, Object.assign({}, opts, { token: session.accessToken }));
    } catch (err) {
      if (err.status !== 401) throw err;
      await refresh();
      return request(path, Object.assign({}, opts, { token: session.accessToken }));
    }
  }

  /* ---------- signing in and out ---------- */
  const configured = () => !!(API && CLIENT_ID && hasChrome && chrome.identity);

  function jwtPayload(token) {
    try {
      const b64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
      return JSON.parse(decodeURIComponent(escape(atob(b64))));
    } catch { return null; }
  }

  async function signIn() {
    if (!configured()) throw new ApiError("Sign-in isn't set up yet (ACCOUNT_CONFIG in config.js).", 0, "not_configured");
    const nonce = crypto.randomUUID();
    const url = "https://accounts.google.com/o/oauth2/v2/auth?" + new URLSearchParams({
      client_id: CLIENT_ID,
      response_type: "id_token",
      redirect_uri: chrome.identity.getRedirectURL(),
      scope: "openid email profile",
      nonce,
      prompt: "select_account", // always ask which Google account
    });
    let back;
    try {
      back = await chrome.identity.launchWebAuthFlow({ url, interactive: true });
    } catch (err) {
      const msg = String(err && err.message || err);
      throw new ApiError(/cancel|closed|did not approve/i.test(msg) ? "Sign-in was cancelled." : "Google sign-in failed: " + msg, 0, "cancelled");
    }
    const params = new URLSearchParams(new URL(back).hash.slice(1));
    const idToken = params.get("id_token");
    if (!idToken) throw new ApiError("Google sign-in failed: " + (params.get("error") || "no token"), 0, "google");
    const claims = jwtPayload(idToken);
    if (!claims || claims.nonce !== nonce) throw new ApiError("Google sign-in failed: the answer didn't match.", 0, "google");
    await setSession(await request("/auth/google", { method: "POST", body: { idToken } }));
    return session.user;
  }

  async function signOut() {
    const rt = session && session.refreshToken;
    await setSession(null);
    /* best effort: the server forgets the refresh token */
    if (rt) request("/auth/logout", { method: "POST", body: { refreshToken: rt } }).catch(() => {});
  }

  /* the fresh profile + today's assistant usage */
  async function me() {
    const data = await api("/me");
    if (session && data && data.user && JSON.stringify(data.user) !== JSON.stringify(session.user)) {
      session = Object.assign({}, session, { user: data.user });
      await put({ [KEY]: session });
    }
    return data;
  }

  async function deleteAccount() {
    await api("/me", { method: "DELETE" });
    await setSession(null);
  }

  /* ---------- settings sync ---------- */
  async function saveToAccount() {
    const o = await new Promise((r) => chrome.storage.local.get(SYNC_KEYS, r));
    const data = { v: 1, savedAt: Date.now() };
    SYNC_KEYS.forEach((k) => { if (typeof o[k] === "string") data[k] = o[k]; });
    const out = await api("/settings", { method: "PUT", body: { data } });
    await put({ [SYNC_KEY]: Date.now() });
    return out;
  }

  /* writes the saved copy over this computer's and reloads the page */
  async function restoreFromAccount() {
    const { data } = await api("/settings");
    if (!data || !SYNC_KEYS.some((k) => typeof data[k] === "string")) {
      throw new ApiError("Nothing is saved to your account yet.", 404, "empty");
    }
    const next = {};
    SYNC_KEYS.forEach((k) => { if (typeof data[k] === "string") next[k] = data[k]; });
    next[SYNC_KEY] = Date.now();
    await put(next);
    location.reload();
  }

  /* ---------- billing (Paddle, through the backend) ---------- */
  const openTab = (url) => (chrome.tabs && chrome.tabs.create ? chrome.tabs.create({ url }) : window.open(url, "_blank"));
  async function upgrade(interval) {
    const { url } = await api("/billing/checkout", { method: "POST", body: { interval } });
    openTab(url);
  }
  async function manageBilling() {
    const { url } = await api("/billing/portal", { method: "POST" });
    openTab(url);
  }

  /* Pro, as far as this computer knows (the server re-checks every Pro call).
     While everything is free (PRO_CONFIG.allFree), everyone counts as Pro. */
  const allFree = typeof PRO_CONFIG !== "undefined" && !!PRO_CONFIG.allFree;
  function isPro() {
    if (allFree) return true;
    const u = session && session.user;
    return !!(u && u.plan === "PRO" && (!u.planExpiresAt || new Date(u.planExpiresAt) > new Date()));
  }

  window.AtlasAccount = {
    ready,
    configured,
    user: () => (session ? session.user : null),
    signedIn: () => !!session,
    isPro,
    allFree,
    on: (fn) => listeners.push(fn),
    signIn,
    signOut,
    me,
    deleteAccount,
    saveToAccount,
    restoreFromAccount,
    lastSync: () => get(SYNC_KEY),
    upgrade,
    manageBilling,
    openTab,
    api,
  };
})();
