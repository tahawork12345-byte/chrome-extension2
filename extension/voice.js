/* ATLAS NEW TAB — voice
   Speech in and out for the new tab: voice typing (the search bar and the
   assistant) through Chrome's speech recognition, and the assistant's
   spoken replies through the system's text-to-speech voices.

   A "voice" is a look-alike of a cursor pack: a few suggested ones below
   (a style — speed, pitch, volume — plus the kind of system voice to
   prefer, in whatever language is being spoken), or the user's own from
   Customize > Language, which can pin one exact system voice.

   Chrome's speech recognition sends the audio to Google to be written
   out; text-to-speech runs on the computer (or Google's online voices,
   which Chrome lists as "Google …").                                     */

(() => {
  "use strict";

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const synth = window.speechSynthesis || null;
  const Langs = window.AtlasLangs;

  const FEMALE = /female|woman|aria|jenny|zira|samantha|karen|libby|sonia|natasha|hazel|susan|salma|uzma|heera|swara|google uk english female|google us english/i;
  const MALE = /\bmale\b|\bman\b|guy|david|daniel|mark|ryan|davis|george|william|asad|madhur|google uk english male/i;
  const NATURAL = /natural|online|neural|google/i;

  /* the suggested voices */
  const PRESETS = [
    { id: "atlas", name: "Atlas", hint: "Calm and clear", rate: 1, pitch: 1, volume: 1, prefer: [NATURAL, FEMALE] },
    { id: "sage", name: "Sage", hint: "Slow and deep", rate: 0.88, pitch: 0.72, volume: 1, prefer: [MALE, NATURAL] },
    { id: "spark", name: "Spark", hint: "Bright and quick", rate: 1.15, pitch: 1.3, volume: 1, prefer: [FEMALE, NATURAL] },
    { id: "narrator", name: "Narrator", hint: "A steady storyteller", rate: 0.95, pitch: 0.92, volume: 1, prefer: [NATURAL, MALE] },
    { id: "soft", name: "Soft", hint: "Quiet and gentle", rate: 0.85, pitch: 1.12, volume: 0.65, prefer: [FEMALE] },
  ];

  /* ---------- system voices ---------- */
  let voiceList = [];
  const voicesReady = new Promise((resolve) => {
    if (!synth) return resolve([]);
    const take = () => {
      voiceList = synth.getVoices();
      if (voiceList.length) resolve(voiceList);
    };
    take();
    synth.addEventListener("voiceschanged", take);
    setTimeout(() => resolve(voiceList), 2500); // some systems never fire it
  });

  const primary = (tag) => String(tag || "").toLowerCase().replace("_", "-").split("-")[0];

  /* the best system voice for a language, in the order a style prefers */
  function pickVoice(speechTag, prefer) {
    const want = String(speechTag || "").toLowerCase().replace("_", "-");
    const same = voiceList.filter((v) => primary(v.lang) === primary(want));
    if (!same.length) return null;
    const exact = same.filter((v) => v.lang.toLowerCase().replace("_", "-") === want);
    const pool = exact.length ? exact : same;
    for (const re of prefer || []) {
      const hit = pool.find((v) => re.test(v.name));
      if (hit) return hit;
    }
    return pool.find((v) => v.default) || pool[0];
  }

  /* a voice setting ("atlas", or a custom voice's id) -> what to say it with.
     A custom voice keeps its exact system voice when it has one. */
  function resolve(id, custom, speechTag) {
    const own = (custom || []).find((c) => c.id === id);
    if (own) {
      const exact = own.voice && voiceList.find((v) => v.voiceURI === own.voice);
      return {
        voice: exact || pickVoice(speechTag, [NATURAL]),
        rate: own.rate, pitch: own.pitch, volume: own.volume,
        lang: exact ? exact.lang : speechTag,
      };
    }
    const p = PRESETS.find((x) => x.id === id) || PRESETS[0];
    return { voice: pickVoice(speechTag, p.prefer), rate: p.rate, pitch: p.pitch, volume: p.volume, lang: speechTag };
  }

  /* ---------- speaking ---------- */
  /* markdown and links read badly out loud */
  function plain(text) {
    return String(text || "")
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/\*\*(.+?)\*\*/g, "$1")
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/^\s*[*\-•]\s+/gm, "")
      .replace(/https?:\/\/\S+/g, "")
      .replace(/[*_~>#]/g, "")
      .replace(/\s+\n/g, "\n")
      .trim();
  }

  /* Chrome cuts long utterances off after ~15 seconds, so speak in
     sentence-sized pieces */
  function chunks(text) {
    const parts = text.split(/(?<=[.!?।۔。？！\n])\s+/);
    const out = [];
    let cur = "";
    parts.forEach((p) => {
      if (cur && (cur + " " + p).length > 180) { out.push(cur); cur = p; }
      else cur = cur ? cur + " " + p : p;
    });
    if (cur.trim()) out.push(cur);
    return out.flatMap((c) => (c.length > 260 ? c.match(/[\s\S]{1,240}(\s|$)/g) : [c])).filter((c) => c.trim());
  }

  /* no system voice for a language (Urdu, Pashto, Punjabi… on most
     computers): Chrome would read it with an English voice, which says
     nothing or garbles it. Those replies are read by Google's online voice
     instead, played as audio. */
  const ONLINE_TTS = "https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=";
  let audio = null;
  function speakOnline(pieces, how, run) {
    const tl = primary(how.lang) || "en";
    /* the online voice takes up to ~200 characters a request */
    const small = pieces.flatMap((c) => (c.length > 190 ? c.match(/[\s\S]{1,180}(\s|$)/g) : [c])).filter((c) => c.trim());
    return new Promise((done) => {
      let i = 0;
      const next = () => {
        if (run !== speakRun) return done(false);
        if (i >= small.length) { audio = null; return done(true); }
        audio = new Audio(ONLINE_TTS + encodeURIComponent(tl) + "&q=" + encodeURIComponent(small[i++].trim()));
        audio.volume = Math.min(1, Math.max(0, how.volume));
        audio.playbackRate = Math.min(2, Math.max(0.5, how.rate));
        audio.preservesPitch = true;
        audio.onended = next;
        audio.onerror = () => done(false);
        audio.play().catch(() => done(false));
      };
      next();
    });
  }

  let speakRun = 0;
  /* Chrome drops an utterance it has garbage-collected (and its onend with
     it), so the ones in flight are kept here */
  const inFlight = new Set();
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  /* speak(text, { voiceId, custom, lang, onend }) -> resolves when done
     or cut off; a new call (or stop()) cuts the old one off */
  async function speak(text, opts = {}) {
    if (!synth) return false;
    const wasBusy = synth.speaking || synth.pending || !!audio;
    stop();
    const run = ++speakRun;
    await voicesReady;
    /* speak() straight after cancel() is sometimes ignored by Chrome */
    if (wasBusy) await wait(120);
    if (run !== speakRun) return false;
    const pieces = chunks(plain(text));
    if (!pieces.length) return true;
    const how = resolve(opts.voiceId, opts.custom, opts.lang);
    const hasVoiceForLang = how.voice && primary(how.voice.lang) === primary(how.lang || how.voice.lang);
    if (!hasVoiceForLang && how.lang && primary(how.lang) !== "en") {
      const ok = await speakOnline(pieces, how, run);
      if (ok || run !== speakRun) return ok;
      /* offline, or the online voice refused: the system voice is better than silence */
    }
    return new Promise((done) => {
      let i = 0;
      let watchdog = 0;
      let keepAlive = 0;
      const finish = (v) => {
        clearTimeout(watchdog);
        clearInterval(keepAlive);
        done(v);
      };
      const next = () => {
        clearTimeout(watchdog);
        if (run !== speakRun) return finish(false);
        if (i >= pieces.length) return finish(true);
        const piece = pieces[i++];
        const u = new SpeechSynthesisUtterance(piece);
        inFlight.add(u);
        if (how.voice) u.voice = how.voice;
        u.lang = how.lang || (how.voice && how.voice.lang) || "";
        u.rate = how.rate;
        u.pitch = how.pitch;
        u.volume = how.volume;
        let ended = false;
        const end = (go) => {
          if (ended) return;
          ended = true;
          inFlight.delete(u);
          go();
        };
        u.onend = () => end(next);
        u.onerror = (e) => end(() => (e.error === "interrupted" || e.error === "canceled" ? finish(false) : next()));
        /* some voices never report the end: move on after a generous guess */
        const guess = 4000 + (piece.length * 180) / Math.max(0.5, how.rate);
        const check = () => {
          if (ended) return;
          if (!synth.speaking) end(next);
          else watchdog = setTimeout(check, 1000);
        };
        watchdog = setTimeout(check, guess);
        synth.speak(u);
      };
      /* Chrome's online voices go quiet after ~15 s unless nudged */
      keepAlive = setInterval(() => {
        if (run !== speakRun) return finish(false);
        if (synth.speaking && !synth.paused) { synth.pause(); synth.resume(); }
      }, 10000);
      next();
    });
  }
  function stop() {
    speakRun++;
    if (audio) { audio.pause(); audio = null; }
    inFlight.clear();
    if (synth) synth.cancel();
  }

  /* ---------- listening ---------- */
  /* extension pages ask for the microphone like any site; this brings up
     Chrome's prompt before recognition starts, rather than failing */
  async function micAllowed() {
    try {
      const st = await navigator.permissions.query({ name: "microphone" });
      if (st.state === "granted") return true;
      if (st.state === "denied") return false;
    } catch {}
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      return true;
    } catch {
      return false;
    }
  }

  /* listen({ lang, onText(text, isFinal), onEnd(text, error) }) -> { stop, abort }
     Stops by itself after a pause in speech. Recognition runs continuously
     with its own pause timer: Chrome's single-shot mode ends at the first
     short breath, cutting people off mid-sentence. */
  const PAUSE_MS = 1800;  // quiet this long after speaking = done
  const WAIT_MS = 9000;   // nothing said at all = give up
  function listen(opts) {
    let rec = null;
    let finalText = "";
    let error = "";
    let stopped = false;
    let aborted = false;
    const ctl = {
      stop: () => { stopped = true; if (rec) rec.stop(); },
      abort: () => { stopped = aborted = true; if (rec) rec.abort(); },
    };
    if (!SR) {
      setTimeout(() => opts.onEnd && opts.onEnd("", "unsupported"));
      return ctl;
    }
    micAllowed().then((ok) => {
      if (stopped) return opts.onEnd && opts.onEnd("", "aborted");
      if (!ok) return opts.onEnd && opts.onEnd("", "not-allowed");
      rec = new SR();
      rec.lang = opts.lang || navigator.language || "en-US";
      rec.interimResults = true;
      rec.continuous = true;
      rec.maxAlternatives = 1;
      let interim = "";
      let quiet = 0;
      const hush = (ms) => {
        clearTimeout(quiet);
        quiet = setTimeout(() => { if (rec) rec.stop(); }, ms);
      };
      rec.onresult = (e) => {
        /* rebuilt from every result each time: continuous mode resends them */
        let fin = "";
        interim = "";
        for (let i = 0; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal) fin += (fin && !/\s$/.test(fin) ? " " : "") + r[0].transcript.trim();
          else interim += r[0].transcript;
        }
        finalText = fin;
        if (opts.onText) opts.onText((finalText + " " + interim).trim(), !interim);
        hush(PAUSE_MS);
      };
      rec.onerror = (e) => { error = e.error || "error"; };
      rec.onend = () => {
        clearTimeout(quiet);
        /* stopped mid-word: what was heard so far still counts */
        const text = aborted ? "" : (finalText + " " + interim).trim();
        if (opts.onEnd) opts.onEnd(text, aborted ? "aborted" : text ? "" : error || "no-speech");
      };
      try { rec.start(); hush(WAIT_MS); } catch { opts.onEnd && opts.onEnd("", "busy"); }
    });
    return ctl;
  }

  /* what a failed listen means, in words */
  function errorText(code) {
    return ({
      "not-allowed": "Microphone is blocked for Atlas.",
      "service-not-allowed": "Microphone is blocked for Atlas.",
      "no-speech": "Didn't hear anything.",
      "audio-capture": "No microphone found.",
      network: "Voice typing needs an internet connection.",
      unsupported: "This browser can't do voice typing.",
      "language-not-supported": "Voice typing doesn't support this language.",
    })[code] || "";
  }

  /* opens a small extension page where Chrome can ask for the microphone
     (a denied prompt can't be asked again from the new tab itself) */
  function openMicSetup() {
    const url = chrome.runtime.getURL("mic.html");
    if (chrome.tabs && chrome.tabs.create) chrome.tabs.create({ url });
    else window.open(url, "_blank");
  }

  /* the language a piece of text is written in, e.g. "ur" (or null) */
  function detect(text) {
    return new Promise((res) => {
      if (!chrome.i18n || !chrome.i18n.detectLanguage) return res(null);
      chrome.i18n.detectLanguage(String(text).slice(0, 800), (r) => {
        const top = r && r.languages && r.languages[0];
        res(top && top.percentage >= 50 ? top.language : null);
      });
    });
  }

  window.AtlasVoice = {
    canListen: !!SR,
    canSpeak: !!synth,
    PRESETS,
    voices: () => voicesReady.then(() => voiceList.slice()),
    speak,
    stop,
    speaking: () => !!(synth && (synth.speaking || synth.pending)),
    listen,
    errorText,
    openMicSetup,
    detect,
    speechTag: (code) => (Langs ? Langs.speech(code) : navigator.language || "en-US"),
  };
})();
