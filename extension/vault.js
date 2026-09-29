/* ATLAS NEW TAB — private space vault
   A password-locked workspace (sections, shortcuts and notes). Its content
   is kept encrypted in storage: the password is stretched with PBKDF2 into
   an AES-GCM key, and only the ciphertext is ever written. The key lives in
   memory while unlocked, so every new tab starts locked — unless the user
   opts to stay unlocked until Chrome closes (Customize > Privacy), which
   parks the key in chrome.storage.session (memory only, never on disk).

   This file only locks and unlocks. app.js owns the workspace itself and
   puts it on the rail while unlocked; customize.js draws the Privacy tab.  */

(() => {
  "use strict";

  const KEY = "vault";
  const SESSION_KEY = "vaultKey";
  const ITERATIONS = 310000;

  /* ---------- storage ---------- */
  const hasChrome = typeof chrome !== "undefined" && chrome.storage && chrome.storage.local;
  const hasSession = hasChrome && chrome.storage.session;
  const local = {
    get() {
      if (hasChrome) return new Promise((r) => chrome.storage.local.get([KEY], (o) => r(o[KEY])));
      try { return Promise.resolve(localStorage.getItem("atlas:" + KEY)); } catch { return Promise.resolve(null); }
    },
    set(v) {
      if (hasChrome) return new Promise((r) => chrome.storage.local.set({ [KEY]: v }, r));
      try { localStorage.setItem("atlas:" + KEY, v); } catch {}
      return Promise.resolve();
    },
    remove() {
      if (hasChrome) return new Promise((r) => chrome.storage.local.remove(KEY, r));
      try { localStorage.removeItem("atlas:" + KEY); } catch {}
      return Promise.resolve();
    },
  };
  /* outside the extension (a plain file preview) sessionStorage stands in */
  const session = {
    get() {
      if (hasSession) return chrome.storage.session.get([SESSION_KEY]).then((o) => o[SESSION_KEY], () => null);
      try { return Promise.resolve(sessionStorage.getItem("atlas:" + SESSION_KEY)); } catch { return Promise.resolve(null); }
    },
    set(v) {
      if (hasSession) return chrome.storage.session.set({ [SESSION_KEY]: v }).catch(() => {});
      try { sessionStorage.setItem("atlas:" + SESSION_KEY, v); } catch {}
      return Promise.resolve();
    },
    remove() {
      if (hasSession) return chrome.storage.session.remove(SESSION_KEY).catch(() => {});
      try { sessionStorage.removeItem("atlas:" + SESSION_KEY); } catch {}
      return Promise.resolve();
    },
  };

  /* ---------- crypto ---------- */
  const subtle = window.crypto && crypto.subtle;
  const enc = new TextEncoder();
  const dec = new TextDecoder();

  function b64(buf) {
    const bytes = new Uint8Array(buf);
    let s = "";
    /* chunked: spreading a large array into fromCharCode overflows the stack */
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }
  const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

  async function derive(password, salt, iterations) {
    const base = await subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
    /* extractable only so "stay unlocked" can park it in session storage */
    return subtle.deriveKey(
      { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
      base,
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
    );
  }
  async function seal(key, data) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(JSON.stringify(data)));
    return { iv: b64(iv), data: b64(ct) };
  }
  /* AES-GCM is authenticated, so a wrong key throws here instead of
     returning garbage — that is the password check */
  async function openBox(key, box) {
    const pt = await subtle.decrypt({ name: "AES-GCM", iv: unb64(box.iv) }, key, unb64(box.data));
    return JSON.parse(dec.decode(pt));
  }

  /* ---------- state ---------- */
  let record = null; // what is stored: { v, salt, iter, iv, data }
  let key = null;    // the CryptoKey while unlocked
  let stay = false;  // keep the key for the browser session
  let writes = Promise.resolve();

  const listeners = [];
  function emit(type, data) {
    listeners.forEach((fn) => {
      try { fn(type, data); } catch (err) { console.error("Atlas vault listener failed:", err); }
    });
  }

  function persist() {
    const snapshot = record;
    writes = writes.then(() => (snapshot ? local.set(JSON.stringify(snapshot)) : local.remove()));
    return writes;
  }

  async function remember() {
    if (!stay || !key) return session.remove();
    const raw = await subtle.exportKey("raw", key);
    return session.set(b64(raw));
  }

  const ready = local.get().then((raw) => {
    try {
      const r = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (r && r.salt && r.iv && r.data) record = r;
    } catch {}
  });

  function wrongPassword() {
    const err = new Error("Wrong password");
    err.code = "wrong";
    return err;
  }

  async function create(password, data) {
    if (!subtle) throw new Error("This browser can't encrypt here.");
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const k = await derive(password, salt, ITERATIONS);
    const box = await seal(k, data);
    record = Object.assign({ v: 1, salt: b64(salt), iter: ITERATIONS }, box);
    key = k;
    await persist();
    await remember();
    emit("unlock", data);
    return data;
  }

  async function unlock(password) {
    if (!record) throw new Error("No private space yet.");
    const k = await derive(password, unb64(record.salt), record.iter || ITERATIONS);
    let data;
    try { data = await openBox(k, record); } catch { throw wrongPassword(); }
    key = k;
    await remember();
    emit("unlock", data);
    return data;
  }

  /* re-encrypt with a fresh IV. The key is read now, not after the queue,
     so a save made just before lock() still lands. */
  function save(data) {
    const k = key;
    if (!k || !record) return Promise.resolve();
    writes = writes.then(async () => {
      const box = await seal(k, data);
      if (!record) return; // deleted meanwhile
      record = Object.assign({}, record, box);
      await local.set(JSON.stringify(record));
    }).catch((err) => console.error("Atlas vault save failed:", err));
    return writes;
  }

  function lock() {
    if (!key) return;
    emit("beforelock"); // app.js flushes unsaved edits here
    key = null;
    session.remove();
    emit("lock");
  }

  async function changePassword(current, next, data) {
    const k = await derive(current, unb64(record.salt), record.iter || ITERATIONS);
    try { await openBox(k, record); } catch { throw wrongPassword(); }
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const nk = await derive(next, salt, ITERATIONS);
    record = Object.assign({ v: 1, salt: b64(salt), iter: ITERATIONS }, await seal(nk, data));
    key = nk;
    await persist();
    await remember();
    emit("change");
  }

  async function destroy() {
    record = null;
    key = null;
    await session.remove();
    await persist();
    emit("lock");
    emit("destroy");
  }

  /* boot: pick the key back up if the user chose to stay unlocked */
  async function restore(keep) {
    stay = !!keep;
    await ready;
    if (!stay || !record || key || !subtle) return false;
    const raw = await session.get();
    if (!raw) return false;
    try {
      const k = await subtle.importKey("raw", unb64(raw), "AES-GCM", true, ["encrypt", "decrypt"]);
      const data = await openBox(k, record);
      key = k;
      emit("unlock", data);
      return true;
    } catch {
      session.remove();
      return false;
    }
  }

  function setStay(on) {
    stay = !!on;
    remember();
  }

  window.AtlasVault = {
    ready,
    supported: !!subtle,
    exists: () => !!record,
    isUnlocked: () => !!key,
    create,
    unlock,
    save,
    lock,
    changePassword,
    destroy,
    restore,
    setStay,
    on: (fn) => listeners.push(fn),
  };
})();
