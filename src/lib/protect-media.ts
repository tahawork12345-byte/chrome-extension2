/* Keeps the wallpapers on the page from being saved the easy ways:
   no right-click menu ("Save image as", "Copy video address", "Open in new
   tab"), no dragging them to the desktop, no picture-in-picture or cast,
   and no Ctrl+S. Anything a browser shows has been downloaded, so this
   stops casual saving, not someone with DevTools. Images inside links
   (the app bubbles) keep their menu so "Open in new tab" still works. */
const MEDIA = "img, video, .spot, .holo, .nt-body, .mini, .closing-bg";

const shielded = (t: EventTarget | null) => {
  const el = t instanceof Element ? t : null;
  return !!el && !!el.closest(MEDIA) && !el.closest("a[href]");
};

function lockVideo(v: HTMLVideoElement) {
  v.disablePictureInPicture = true;
  v.setAttribute("disablepictureinpicture", "");
  v.setAttribute("disableremoteplayback", "");
  v.setAttribute("controlslist", "nodownload noplaybackrate noremoteplayback");
}

export function protectMedia() {
  const onMenu = (e: MouseEvent) => shielded(e.target) && e.preventDefault();
  const onDrag = (e: DragEvent) => {
    const t = e.target;
    if (t instanceof HTMLImageElement || t instanceof HTMLVideoElement) e.preventDefault();
  };
  const onKey = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") e.preventDefault();
  };
  document.addEventListener("contextmenu", onMenu);
  document.addEventListener("dragstart", onDrag);
  document.addEventListener("keydown", onKey);

  document.querySelectorAll("video").forEach(lockVideo);
  const mo = new MutationObserver((list) => {
    for (const m of list)
      m.addedNodes.forEach((n) => {
        if (n instanceof HTMLVideoElement) lockVideo(n);
        else if (n instanceof Element) n.querySelectorAll("video").forEach(lockVideo);
      });
  });
  mo.observe(document.body, { childList: true, subtree: true });

  return () => {
    document.removeEventListener("contextmenu", onMenu);
    document.removeEventListener("dragstart", onDrag);
    document.removeEventListener("keydown", onKey);
    mo.disconnect();
  };
}
