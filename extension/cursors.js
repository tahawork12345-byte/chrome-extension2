/* ATLAS NEW TAB — cursors
   The cursor packs, the user's own uploaded cursors, and the CSS that
   applies one. Shared by the new tab (customize.js) and every website
   (cursor-apply.js), so both always draw the same cursor from the same
   settings.

   Each cursor has a normal image and a pointer image (links, buttons).
   Shapes are drawn on a 32×32 grid; hot spots are the click point on that
   grid, scaled with the size the user picks.

   Every cursor also has a "look": its colours (packs only) plus effects
   that work on any cursor — tint, hue, saturation, brightness and glow.
   Looks are kept per cursor, so switching back finds it as you left it.  */

(() => {
  "use strict";

  /* ================= SHAPES ============================================= */
  const ARROW = "M3 2 L3 25 L9 19.5 L13 28.5 L17 26.8 L13 18 L21 18 Z";
  const innerGlow = (color, r) =>
    '<defs><filter id="g" x="-50%" y="-50%" width="200%" height="200%">' +
    '<feDropShadow dx="0" dy="0" stdDeviation="' + r + '" flood-color="' + color + '"/></filter></defs>';
  const shade =
    '<path d="' + ARROW + '" fill="none" stroke="rgba(0,0,0,.35)" stroke-width="3" stroke-linejoin="round" transform="translate(.8 1)"/>';

  const arrow = (fill, stroke, glowColor) =>
    (glowColor ? innerGlow(glowColor, 1.2) : shade) +
    '<path d="' + ARROW + '" fill="' + fill + '" stroke="' + stroke + '" stroke-width="1.6" stroke-linejoin="round"' +
    (glowColor ? ' filter="url(#g)"' : "") + "/>";

  const heart = (fill, stroke) =>
    '<path d="M16 27.5 C5 20 3 12 8 8 C11.5 5.2 14.8 6.6 16 9.6 C17.2 6.6 20.5 5.2 24 8 C29 12 27 20 16 27.5 Z" fill="' +
    fill + '" stroke="' + stroke + '" stroke-width="1.6" stroke-linejoin="round"/>' +
    '<ellipse cx="10.5" cy="11.5" rx="2.2" ry="1.4" fill="#fff" opacity=".7" transform="rotate(-35 10.5 11.5)"/>';

  const flower = (fill, stroke) => {
    let p = "";
    for (let i = 0; i < 5; i++) {
      p += '<path d="M0 -1 C-5 -4 -5.5 -10 -2 -13 L0 -11 L2 -13 C5.5 -10 5 -4 0 -1 Z" fill="' + fill + '" stroke="' +
        stroke + '" stroke-width="1.1" transform="rotate(' + i * 72 + ')"/>';
    }
    return '<g transform="translate(16 16)">' + p + '<circle r="2.6" fill="#ffd966" stroke="#d99a2b" stroke-width=".8"/></g>';
  };

  const paw = (fill, stroke) =>
    '<g fill="' + fill + '" stroke="' + stroke + '" stroke-width="1.5">' +
    '<path d="M16 15.5 C11 15.5 7.5 20 8.5 24 C9.3 27 12.5 26.5 16 26.5 C19.5 26.5 22.7 27 23.5 24 C24.5 20 21 15.5 16 15.5 Z"/>' +
    '<ellipse cx="7.5" cy="12.5" rx="2.8" ry="3.4" transform="rotate(-20 7.5 12.5)"/>' +
    '<ellipse cx="12.5" cy="7.5" rx="2.8" ry="3.5" transform="rotate(-8 12.5 7.5)"/>' +
    '<ellipse cx="19.5" cy="7.5" rx="2.8" ry="3.5" transform="rotate(8 19.5 7.5)"/>' +
    '<ellipse cx="24.5" cy="12.5" rx="2.8" ry="3.4" transform="rotate(20 24.5 12.5)"/></g>';

  const star = (cx, cy, r, fill, stroke) => {
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const a = (Math.PI / 5) * i - Math.PI / 2;
      const rr = i % 2 ? r * 0.45 : r;
      pts.push((cx + Math.cos(a) * rr).toFixed(2) + "," + (cy + Math.sin(a) * rr).toFixed(2));
    }
    return '<polygon points="' + pts.join(" ") + '" fill="' + fill + '" stroke="' + stroke + '" stroke-width="1.3" stroke-linejoin="round"/>';
  };

  const wand = (fill, stroke) =>
    '<path d="M12 12 L28 28" stroke="#3b2a5a" stroke-width="4.2" stroke-linecap="round"/>' +
    '<path d="M12 12 L28 28" stroke="#b58cff" stroke-width="2.4" stroke-linecap="round"/>' +
    star(9, 9, 7.5, fill, stroke) +
    '<circle cx="21" cy="5" r="1.2" fill="#fff"/><circle cx="4" cy="20" r="1" fill="#fff"/>';

  const katana = (fill, stroke) =>
    '<path d="M2.5 2.5 L20 18 L18 20 Z" fill="' + fill + '" stroke="' + stroke + '" stroke-width="1.2" stroke-linejoin="round"/>' +
    '<path d="M4 3.5 L19.5 18.5" stroke="#fff" stroke-width=".7" opacity=".8"/>' +
    '<ellipse cx="20" cy="20" rx="4.2" ry="1.6" transform="rotate(-45 20 20)" fill="#d4a93a" stroke="#6b4e10" stroke-width="1"/>' +
    '<path d="M21.5 21.5 L28.5 28.5" stroke="#1d1d24" stroke-width="3.6" stroke-linecap="round"/>' +
    '<path d="M22.5 22.5 L27.5 27.5" stroke="#b3242f" stroke-width="1.4" stroke-dasharray="1.4 1.2"/>';

  const shuriken = (fill, stroke) =>
    '<g transform="rotate(20 16 16)"><path d="M16 1.5 L19.2 12.8 L30.5 16 L19.2 19.2 L16 30.5 L12.8 19.2 L1.5 16 L12.8 12.8 Z" fill="' +
    fill + '" stroke="' + stroke + '" stroke-width="1.4" stroke-linejoin="round"/>' +
    '<path d="M16 1.5 L19.2 12.8 L16 16 Z M30.5 16 L19.2 19.2 L16 16 Z M16 30.5 L12.8 19.2 L16 16 Z M1.5 16 L12.8 12.8 L16 16 Z" fill="#fff" opacity=".45"/>' +
    '<circle cx="16" cy="16" r="2.4" fill="' + stroke + '"/></g>';

  const ghost = (fill, stroke) =>
    '<path d="M7.5 29 V14 A8.5 8.5 0 0 1 24.5 14 V29 L21.7 26.4 L18.8 29 L16 26.4 L13.2 29 L10.3 26.4 Z" fill="' + fill +
    '" stroke="' + stroke + '" stroke-width="1.5" stroke-linejoin="round"/>' +
    '<ellipse cx="12.8" cy="14.5" rx="1.7" ry="2.3" fill="#2a2d40"/><ellipse cx="19.2" cy="14.5" rx="1.7" ry="2.3" fill="#2a2d40"/>' +
    '<ellipse cx="16" cy="20" rx="1.8" ry="1.2" fill="#ff8fb1"/>';

  const crown = (fill, stroke) =>
    '<path d="M4 25 L3 10 L10 16 L16 6 L22 16 L29 10 L28 25 Z" fill="' + fill + '" stroke="' + stroke + '" stroke-width="1.5" stroke-linejoin="round"/>' +
    '<rect x="4" y="25" width="24" height="3.5" rx="1" fill="' + fill + '" stroke="' + stroke + '" stroke-width="1.2"/>' +
    '<rect x="4" y="25" width="24" height="3.5" rx="1" fill="#000" opacity=".18"/>' +
    '<circle cx="16" cy="18.5" r="2.2" fill="#e8364f"/><circle cx="9.5" cy="20" r="1.5" fill="#3aa0ff"/><circle cx="22.5" cy="20" r="1.5" fill="#3aa0ff"/>';

  /* stair-stepped 8-bit arrow; pixel size 2 */
  const PIXEL =
    "M2 2 H4 V4 H6 V6 H8 V8 H10 V10 H12 V12 H14 V14 H16 V16 H18 V18 H12 V20 H14 V22 H16 V26 H12 V24 H10 V20 H8 V22 H6 V24 H4 V26 H2 Z";
  const pixel = (fill, stroke) =>
    '<path d="' + PIXEL + '" fill="' + fill + '" stroke="' + stroke + '" stroke-width="1.6" stroke-linejoin="miter" shape-rendering="crispEdges"/>';

  /* ================= PACKS ==============================================
     `colors` are the pack's own colours: fill / stroke for the normal
     cursor, pFill / pStroke for the pointer. "accent" follows the theme.  */
  const PACKS = [
    { id: "default", label: "System" },
    {
      id: "accent", label: "Accent",
      colors: { fill: "accent", stroke: "#ffffff", pFill: "accent", pStroke: "#ffffff" },
      normal: (c) => arrow(c.fill, c.stroke), nHot: [3, 2],
      pointer: (c) => heart(c.pFill, c.pStroke), pHot: [16, 16],
    },
    {
      id: "neon", label: "Neon",
      colors: { fill: "#0b1b2b", stroke: "#3ff4ff", pFill: "#2b0b24", pStroke: "#ff4fd8" },
      normal: (c) => arrow(c.fill, c.stroke, c.stroke), nHot: [3, 2],
      pointer: (c) => arrow(c.pFill, c.pStroke, c.pStroke), pHot: [3, 2],
    },
    {
      id: "sakura", label: "Sakura",
      colors: { fill: "#ffd1e0", stroke: "#c2416b", pFill: "#ffc4d8", pStroke: "#d9567f" },
      normal: (c) => arrow(c.fill, c.stroke), nHot: [3, 2],
      pointer: (c) => flower(c.pFill, c.pStroke), pHot: [16, 16],
    },
    {
      id: "kitty", label: "Kitty",
      colors: { fill: "#1f1f26", stroke: "#ffffff", pFill: "#ffb3c8", pStroke: "#5a2a3a" },
      normal: (c) => arrow(c.fill, c.stroke), nHot: [3, 2],
      pointer: (c) => paw(c.pFill, c.pStroke), pHot: [16, 13],
    },
    {
      id: "magic", label: "Magic",
      colors: { fill: "#8a5cff", stroke: "#f1e8ff", pFill: "#ffe066", pStroke: "#c98a00" },
      normal: (c) => arrow(c.fill, c.stroke, c.fill), nHot: [3, 2],
      pointer: (c) => wand(c.pFill, c.pStroke), pHot: [9, 9],
    },
    {
      id: "katana", label: "Katana",
      colors: { fill: "#e9eef5", stroke: "#5b6778", pFill: "#9aa4b2", pStroke: "#2c323c" },
      normal: (c) => katana(c.fill, c.stroke), nHot: [3, 3],
      pointer: (c) => shuriken(c.pFill, c.pStroke), pHot: [16, 16],
    },
    {
      id: "love", label: "Love",
      colors: { fill: "#ff5c8a", stroke: "#ffffff", pFill: "#ff3d6e", pStroke: "#ffffff" },
      normal: (c) => arrow(c.fill, c.stroke), nHot: [3, 2],
      pointer: (c) => heart(c.pFill, c.pStroke), pHot: [16, 16],
    },
    {
      id: "ghost", label: "Spooky",
      colors: { fill: "#f4f5ff", stroke: "#4a4f6a", pFill: "#f4f5ff", pStroke: "#4a4f6a" },
      normal: (c) => arrow(c.fill, c.stroke), nHot: [3, 2],
      pointer: (c) => ghost(c.pFill, c.pStroke), pHot: [16, 7],
    },
    {
      id: "pixel", label: "Pixel",
      colors: { fill: "#ffffff", stroke: "#111111", pFill: "#ffd23f", pStroke: "#111111" },
      normal: (c) => pixel(c.fill, c.stroke), nHot: [2, 2],
      pointer: (c) => pixel(c.pFill, c.pStroke), pHot: [2, 2],
    },
    {
      id: "royal", label: "Royal",
      colors: { fill: "#ffd34d", stroke: "#8a5a00", pFill: "#ffd34d", pStroke: "#8a5a00" },
      normal: (c) => arrow(c.fill, c.stroke), nHot: [3, 2],
      pointer: (c) => crown(c.pFill, c.pStroke), pHot: [16, 7],
    },
  ];
  const packById = (id) => PACKS.find((p) => p.id === id);

  /* ================= SETTINGS MODEL =====================================
     Stored settings can come from an older version, an import or another
     device, so everything is checked here before it is drawn.            */
  const HEX = /^#[0-9a-f]{6}$/i;
  /* only base64 PNGs (what the uploader makes): nothing that could close
     the attribute or the CSS string it ends up in */
  const IMG = /^data:image\/png;base64,[A-Za-z0-9+/=]+$/;
  const ID = /^c[a-z0-9]{1,16}$/;
  const MAX_CUSTOM = 24;
  const clamp = (v, lo, hi, fb) => (typeof v === "number" && isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fb);

  const defaults = () => ({
    style: "default", // a pack id, or "custom:<id>"
    size: 32,
    everywhere: true,
    custom: [],       // [{ id, name, normal, pointer, hot }]
    looks: {},        // { [pack id | custom id]: partial look }
  });

  /* the full look of a cursor: pack colours, then effects */
  function baseLook(id, accent) {
    const pack = packById(id);
    const a = HEX.test(accent) ? accent : "#d8c3a5";
    const c = (pack && pack.colors) || { fill: "#ffffff", stroke: "#111111", pFill: "#ffffff", pStroke: "#111111" };
    const col = (v) => (v === "accent" ? a : v);
    return {
      fill: col(c.fill), stroke: col(c.stroke), pFill: col(c.pFill), pStroke: col(c.pStroke),
      tintOn: false, tint: a,
      hue: 0, sat: 100, bright: 100,
      glow: 0, glowColor: "#ffffff",
    };
  }
  const LOOK_RANGE = { hue: [0, 360], sat: [0, 250], bright: [30, 200], glow: [0, 8] };

  function cleanLook(raw, base) {
    const out = {};
    if (!raw || typeof raw !== "object") return out;
    Object.keys(base).forEach((k) => {
      const v = raw[k];
      if (typeof base[k] === "string" && HEX.test(v)) out[k] = v.toLowerCase();
      else if (typeof base[k] === "boolean" && typeof v === "boolean") out[k] = v;
      else if (typeof base[k] === "number" && LOOK_RANGE[k]) {
        const n = clamp(v, LOOK_RANGE[k][0], LOOK_RANGE[k][1], null);
        if (n != null) out[k] = n;
      }
    });
    return out;
  }

  function lookFor(cfg, id, accent) {
    const base = baseLook(id, accent);
    return Object.assign(base, cleanLook(cfg && cfg.looks && cfg.looks[id], base));
  }

  function normalize(raw) {
    const out = defaults();
    if (!raw || typeof raw !== "object") return out;
    out.size = Math.round(clamp(raw.size, 16, 96, 32));
    if (typeof raw.everywhere === "boolean") out.everywhere = raw.everywhere;

    const seen = new Set();
    (Array.isArray(raw.custom) ? raw.custom : []).forEach((c) => {
      if (out.custom.length >= MAX_CUSTOM || !c || !ID.test(c.id) || seen.has(c.id) || !IMG.test(c.normal)) return;
      seen.add(c.id);
      out.custom.push({
        id: c.id,
        name: typeof c.name === "string" && c.name.trim() ? c.name.trim().slice(0, 40) : "My cursor",
        normal: c.normal,
        pointer: IMG.test(c.pointer) ? c.pointer : "",
        hot: c.hot === "center" ? "center" : "tip",
      });
    });
    /* the first version kept a single upload in flat fields */
    if (IMG.test(raw.customNormal) && !seen.has("c1") && out.custom.length < MAX_CUSTOM) {
      seen.add("c1");
      out.custom.unshift({
        id: "c1", name: "My cursor", normal: raw.customNormal,
        pointer: IMG.test(raw.customPointer) ? raw.customPointer : "",
        hot: raw.customHot === "center" ? "center" : "tip",
      });
    }

    const st = typeof raw.style === "string" ? raw.style : "default";
    if (st === "custom" && seen.has("c1")) out.style = "custom:c1";
    else if (st.startsWith("custom:") && seen.has(st.slice(7))) out.style = st;
    else if (packById(st)) out.style = st;

    if (raw.looks && typeof raw.looks === "object") {
      Object.keys(raw.looks).forEach((id) => {
        if (!packById(id) && !seen.has(id)) return;
        const l = cleanLook(raw.looks[id], baseLook(id));
        if (Object.keys(l).length) out.looks[id] = l;
      });
    }
    return out;
  }

  const newId = () => "c" + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36);

  /* ================= DRAWING ============================================ */
  /* the effect chain as one SVG filter, or "" when nothing is changed */
  function effects(L) {
    const f = [];
    if (L.tintOn) {
      f.push(
        '<feColorMatrix in="SourceGraphic" type="saturate" values="0" result="gray"/>',
        '<feFlood flood-color="' + L.tint + '" result="ink"/>',
        '<feBlend in="gray" in2="ink" mode="multiply" result="mix"/>',
        '<feComposite in="mix" in2="SourceGraphic" operator="in" result="fx"/>'
      );
    } else {
      if (L.hue) f.push('<feColorMatrix type="hueRotate" values="' + L.hue + '"/>');
      if (L.sat !== 100) f.push('<feColorMatrix type="saturate" values="' + L.sat / 100 + '"/>');
    }
    if (L.bright !== 100) {
      const s = L.bright / 100;
      f.push('<feComponentTransfer><feFuncR type="linear" slope="' + s + '"/><feFuncG type="linear" slope="' + s +
        '"/><feFuncB type="linear" slope="' + s + '"/></feComponentTransfer>');
    }
    if (L.glow) f.push('<feDropShadow dx="0" dy="0" stdDeviation="' + (L.glow * 0.45).toFixed(2) + '" flood-color="' + L.glowColor + '"/>');
    if (!f.length) return "";
    return '<filter id="fx" x="-30%" y="-30%" width="160%" height="160%" color-interpolation-filters="sRGB">' + f.join("") + "</filter>";
  }

  /* a glow needs room inside the 32px box, so the art shrinks to make it */
  function frame(inner, hot, L) {
    const filter = effects(L);
    const pad = L.glow ? Math.min(6, L.glow * 0.7) : 0;
    const k = (32 - 2 * pad) / 32;
    const g = pad ? '<g transform="translate(' + pad + " " + pad + ") scale(" + k + ')">' + inner + "</g>" : inner;
    return {
      svg: filter ? "<defs>" + filter + '</defs><g filter="url(#fx)">' + g + "</g>" : g,
      hot: [pad + hot[0] * k, pad + hot[1] * k],
    };
  }

  const image = (dataUrl) =>
    '<image href="' + dataUrl + '" x="0" y="0" width="32" height="32" preserveAspectRatio="xMidYMid meet"/>';

  /* the normal + pointer art for a style, in 32px units, or null */
  function build(cfg, style, accent) {
    if (!style || style === "default") return null;
    if (style.startsWith("custom:")) {
      const id = style.slice(7);
      const c = cfg.custom.find((x) => x.id === id);
      if (!c) return null;
      const L = lookFor(cfg, id, accent);
      const hot = c.hot === "center" ? [16, 16] : [1, 1];
      return { normal: frame(image(c.normal), hot, L), pointer: frame(image(c.pointer || c.normal), hot, L) };
    }
    const pack = packById(style);
    if (!pack || !pack.normal) return null;
    const L = lookFor(cfg, style, accent);
    return { normal: frame(pack.normal(L), pack.nHot, L), pointer: frame(pack.pointer(L), pack.pHot, L) };
  }

  const svgData = (inner, size) =>
    "data:image/svg+xml," +
    encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '" viewBox="0 0 32 32">' + inner + "</svg>");

  /* ================= CSS ================================================ */
  const POINTER_SEL = [
    "a[href]", "a[href] *", "button", "button *", "[role=button]", "[role=button] *", "[role=link]",
    "[role=tab]", "[role=menuitem]", "[role=option]", "[role=checkbox]", "[role=switch]",
    "label[for]", "select", "summary", "[onclick]",
    "input[type=button]", "input[type=submit]", "input[type=reset]", "input[type=checkbox]",
    "input[type=radio]", "input[type=file]", "input[type=color]", "input[type=range]", "input[type=image]",
  ].join(",");
  const TEXT_SEL = [
    "input:not([type])", "input[type=text]", "input[type=search]", "input[type=email]", "input[type=url]",
    "input[type=password]", "input[type=number]", "input[type=tel]", "textarea",
    "[contenteditable=\"\"]", "[contenteditable=true]",
  ].join(",");

  /* the normal cursor is set on the root and inherited, so anything a site
     gives its own cursor (grab, resize, a custom hand) still shows it */
  function css(rawCfg, accent) {
    const cfg = normalize(rawCfg);
    const art = build(cfg, cfg.style, accent);
    if (!art) return "";
    const size = cfg.size;
    const k = size / 32;
    const decl = (a, fallback) => {
      const x = Math.min(size - 1, Math.round(a.hot[0] * k));
      const y = Math.min(size - 1, Math.round(a.hot[1] * k));
      return 'cursor:url("' + svgData(a.svg, size) + '") ' + x + " " + y + "," + fallback + "!important";
    };
    return (
      "html,body{" + decl(art.normal, "auto") + "}" +
      POINTER_SEL + "{" + decl(art.pointer, "pointer") + "}" +
      TEXT_SEL + "{cursor:text!important}" +
      "button:disabled,button:disabled *,[aria-disabled=true]{" + decl(art.normal, "default") + "}"
    );
  }

  /* a small picture of any style for the Customize panel */
  function preview(rawCfg, style, accent, state) {
    const cfg = normalize(rawCfg);
    const art = build(cfg, style, accent);
    return art ? svgData((state === "pointer" ? art.pointer : art.normal).svg, 32) : "";
  }

  (typeof window !== "undefined" ? window : self).AtlasCursors = {
    PACKS: PACKS.map(({ id, label }) => ({ id, label })),
    MAX_CUSTOM,
    defaults,
    normalize,
    lookFor,
    newId,
    css,
    preview,
  };
})();
