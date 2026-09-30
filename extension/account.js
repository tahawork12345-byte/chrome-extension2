/* ATLAS NEW TAB — account
   Sign in with Google, through the backend in backend/ (ACCOUNT_CONFIG in
   config.js). Google's sign-in page opens in a small popup window of our
   own, laid over the Customize panel (launchWebAuthFlow can't be sized),
   and hands back an ID token; the
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
  const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.readonly";
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

  /* Google's page in a popup the size of `anchor` (a DOMRect on this page,
     e.g. the Customize panel) and on top of it. Resolves with the redirect
     URL once Google sends the window there; rejects if it is closed. */
  function authWindow(url, redirect, anchor) {
    return new Promise((resolve, reject) => {
      const frameX = Math.max(0, window.outerWidth - window.innerWidth);
      const frameY = Math.max(0, window.outerHeight - window.innerHeight);
      const width = Math.round(Math.max(380, Math.min(460, anchor ? anchor.width : 420)));
      const height = Math.round(Math.max(480, Math.min(620, anchor ? anchor.height : 600)));
      const left = anchor ? window.screenX + frameX + anchor.left + (anchor.width - width) / 2 : window.screenX + (window.outerWidth - width) / 2;
      const top = anchor ? window.screenY + frameY + anchor.top + Math.max(0, (anchor.height - height) / 2) : window.screenY + (window.outerHeight - height) / 2;
      chrome.windows.create({ url, type: "popup", focused: true, width, height, left: Math.round(left), top: Math.round(top) }, (win) => {
        if (chrome.runtime.lastError || !win) return reject(new Error(chrome.runtime.lastError ? chrome.runtime.lastError.message : "no window"));
        const tabId = win.tabs && win.tabs[0] ? win.tabs[0].id : null;
        let done = false;
        const finish = (err, back) => {
          if (done) return;
          done = true;
          chrome.tabs.onUpdated.removeListener(onUpdated);
          chrome.windows.onRemoved.removeListener(onRemoved);
          if (back) chrome.windows.remove(win.id, () => void chrome.runtime.lastError);
          if (err) reject(err); else resolve(back);
        };
        const onUpdated = (id, info, tab) => {
          if (tabId !== null && id !== tabId) return;
          const u = info.url || (tab && (tab.pendingUrl || tab.url)) || "";
          if (u.startsWith(redirect)) finish(null, u);
        };
        const onRemoved = (id) => { if (id === win.id) finish(new Error("The user closed the window.")); };
        chrome.tabs.onUpdated.addListener(onUpdated);
        chrome.windows.onRemoved.addListener(onRemoved);
      });
    });
  }

  async function signIn(opts) {
    if (!configured()) throw new ApiError("Sign-in isn't set up yet (ACCOUNT_CONFIG in config.js).", 0, "not_configured");
    const nonce = crypto.randomUUID();
    const redirect = chrome.identity.getRedirectURL();
    const url = "https://accounts.google.com/o/oauth2/v2/auth?" + new URLSearchParams({
      client_id: CLIENT_ID,
      /* the calendar comes with sign-in, so Quick tools > Calendar needs
         no second Google screen (the access token is handed to calendar.js) */
      response_type: "id_token token",
      redirect_uri: redirect,
      scope: "openid email profile " + CALENDAR_SCOPE,
      include_granted_scopes: "true",
      nonce,
      prompt: "select_account", // always ask which Google account
    });
    let back;
    try {
      back = chrome.windows && chrome.tabs && chrome.tabs.onUpdated
        ? await authWindow(url, redirect, opts && opts.anchor)
        : await chrome.identity.launchWebAuthFlow({ url, interactive: true });
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
    /* Google lets the user untick the calendar box; then Calendar offers Connect */
    const access = params.get("access_token");
    if (access && String(params.get("scope") || "").split(" ").includes(CALENDAR_SCOPE) && window.AtlasCalendar) {
      await AtlasCalendar.adopt({ token: access, expiresAt: Date.now() + (Number(params.get("expires_in")) || 3600) * 1000 }, claims.email).catch(() => {});
    }
    return session.user;
  }

  /* a Google access token for extra scopes (e.g. Calendar), through the
     same client and redirect as sign-in. interactive: false tries without
     any window (prompt=none) and fails if Google needs to ask the user.
     Resolves with { token, expiresAt }. */
  async function googleToken({ scope, interactive = true, loginHint, anchor } = {}) {
    if (!configured()) throw new ApiError("Google isn't set up yet (ACCOUNT_CONFIG in config.js).", 0, "not_configured");
    const redirect = chrome.identity.getRedirectURL();
    const state = crypto.randomUUID();
    const q = { client_id: CLIENT_ID, response_type: "token", redirect_uri: redirect, scope, state, include_granted_scopes: "true" };
    if (loginHint) q.login_hint = loginHint;
    /* with a hint Google skips the account picker, and asks for consent
       only if this scope hasn't been granted yet */
    if (!interactive) q.prompt = "none";
    else if (!loginHint) q.prompt = "select_account";
    const url = "https://accounts.google.com/o/oauth2/v2/auth?" + new URLSearchParams(q);
    let back;
    try {
      back = interactive && chrome.windows && chrome.tabs && chrome.tabs.onUpdated
        ? await authWindow(url, redirect, anchor)
        : await chrome.identity.launchWebAuthFlow({ url, interactive });
    } catch (err) {
      const msg = String(err && err.message || err);
      throw new ApiError(/cancel|closed|did not approve/i.test(msg) ? "Cancelled." : "Google said no: " + msg, 0, interactive ? "cancelled" : "needs_consent");
    }
    const params = new URLSearchParams(new URL(back).hash.slice(1));
    const token = params.get("access_token");
    if (!token || params.get("state") !== state) throw new ApiError("Google said no: " + (params.get("error") || "no token"), 0, "google");
    if (!String(params.get("scope") || "").split(" ").includes(scope)) throw new ApiError("Access wasn't allowed. Tick the box on Google's page.", 0, "scope");
    return { token, expiresAt: Date.now() + (Number(params.get("expires_in")) || 3600) * 1000 };
  }

  async function signOut() {
    const rt = session && session.refreshToken;
    await setSession(null);
    if (window.AtlasCalendar) await AtlasCalendar.forget();
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
    googleToken,
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
