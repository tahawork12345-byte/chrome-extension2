/* ATLAS NEW TAB — languages
   One list shared by the page translator (translate.js, on every site),
   voice typing and the assistant's voice (voice.js). `code` is what the
   translator takes, `speech` the BCP-47 tag for speech recognition and
   text-to-speech.                                                          */

(() => {
  "use strict";
  if (window.AtlasLangs) return;

  const LIST = [
    ["en", "English", "English", "en-US"],
    ["ur", "Urdu", "اردو", "ur-PK"],
    ["hi", "Hindi", "हिन्दी", "hi-IN"],
    ["ar", "Arabic", "العربية", "ar-SA"],
    ["bn", "Bengali", "বাংলা", "bn-BD"],
    ["pa", "Punjabi", "ਪੰਜਾਬੀ", "pa-IN"],
    ["fa", "Persian", "فارسی", "fa-IR"],
    ["ps", "Pashto", "پښتو", "ps-AF"],
    ["tr", "Turkish", "Türkçe", "tr-TR"],
    ["es", "Spanish", "Español", "es-ES"],
    ["fr", "French", "Français", "fr-FR"],
    ["de", "German", "Deutsch", "de-DE"],
    ["it", "Italian", "Italiano", "it-IT"],
    ["pt", "Portuguese", "Português", "pt-BR"],
    ["nl", "Dutch", "Nederlands", "nl-NL"],
    ["ru", "Russian", "Русский", "ru-RU"],
    ["uk", "Ukrainian", "Українська", "uk-UA"],
    ["pl", "Polish", "Polski", "pl-PL"],
    ["sv", "Swedish", "Svenska", "sv-SE"],
    ["el", "Greek", "Ελληνικά", "el-GR"],
    ["zh-CN", "Chinese (Simplified)", "简体中文", "zh-CN"],
    ["zh-TW", "Chinese (Traditional)", "繁體中文", "zh-TW"],
    ["ja", "Japanese", "日本語", "ja-JP"],
    ["ko", "Korean", "한국어", "ko-KR"],
    ["id", "Indonesian", "Bahasa Indonesia", "id-ID"],
    ["ms", "Malay", "Bahasa Melayu", "ms-MY"],
    ["vi", "Vietnamese", "Tiếng Việt", "vi-VN"],
    ["th", "Thai", "ไทย", "th-TH"],
    ["fil", "Filipino", "Filipino", "fil-PH"],
    ["ta", "Tamil", "தமிழ்", "ta-IN"],
    ["te", "Telugu", "తెలుగు", "te-IN"],
    ["mr", "Marathi", "मराठी", "mr-IN"],
    ["gu", "Gujarati", "ગુજરાતી", "gu-IN"],
    ["sw", "Swahili", "Kiswahili", "sw-KE"],
    ["he", "Hebrew", "עברית", "he-IL"],
  ].map(([code, name, native, speech]) => ({ code, name, native, speech }));

  const find = (code) => {
    if (!code) return null;
    const c = String(code).toLowerCase();
    return LIST.find((l) => l.code.toLowerCase() === c) ||
      LIST.find((l) => l.code.split("-")[0].toLowerCase() === c.split("-")[0]) || null;
  };

  window.AtlasLangs = {
    list: LIST,
    find,
    /* "Urdu — اردو" */
    label: (l) => (l.native && l.native !== l.name ? l.name + " — " + l.native : l.name),
    /* the speech tag for a translator code, or the browser's own */
    speech: (code) => {
      const l = find(code);
      return l ? l.speech : navigator.language || "en-US";
    },
  };
})();
