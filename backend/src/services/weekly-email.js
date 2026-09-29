/* The Monday summary of the stats dashboard. The extension sends each
   week's numbers (PUT /stats/week); this turns one into an email.
   data = { days: [{ date, browse, focus, tasks, habits, blocked }],
            top: [{ host, secs }],
            totals: { browse, focus, sessions, tasks, habits, blocked },
            streak }
   browse / secs are seconds, focus is minutes, the rest are counts. */

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const num = (v) => (Number.isFinite(Number(v)) ? Math.max(0, Math.round(Number(v))) : 0);
const hm = (mins) => {
  const m = num(mins);
  return m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? " " + (m % 60) + "m" : ""}` : `${m}m`;
};
const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function tile(label, value) {
  return `<td style="width:33%;background:#f4f2ee;border-radius:10px;padding:10px 12px">
    <div style="font-size:18px;font-weight:600;color:#1d1a16">${esc(value)}</div>
    <div style="font-size:12px;color:#6b6760">${esc(label)}</div></td>`;
}

export function weeklyEmail(user, week, data) {
  const t = (data && data.totals) || {};
  const days = Array.isArray(data && data.days) ? data.days.slice(0, 7) : [];
  const top = Array.isArray(data && data.top) ? data.top.slice(0, 5) : [];
  const from = new Date(week);
  const to = new Date(from.getTime() + 6 * 86_400_000);
  const fmt = (d) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const range = `${fmt(from)} – ${fmt(to)}`;
  const name = (user.name || "").split(" ")[0] || "there";

  const tiles = [
    ["Focused", hm(t.focus)],
    ["Focus sessions", num(t.sessions)],
    ["Tasks done", num(t.tasks)],
    ["Habits done", num(t.habits)],
    ["Browsing", hm(num(t.browse) / 60)],
    ["Sites blocked", num(t.blocked)],
  ];
  const maxFocus = Math.max(1, ...days.map((d) => num(d.focus)));
  const bars = days.map((d) => {
    const h = Math.round((num(d.focus) / maxFocus) * 80);
    const label = DAY[new Date(String(d.date) + "T00:00:00Z").getUTCDay()] || "";
    return `<td style="vertical-align:bottom;text-align:center;padding:0 3px">
      <div style="font-size:11px;color:#6b6760;margin-bottom:4px">${hm(d.focus)}</div>
      <div style="height:${Math.max(2, h)}px;background:#b8946a;border-radius:4px 4px 0 0"></div>
      <div style="font-size:11px;color:#6b6760;margin-top:4px">${label}</div></td>`;
  }).join("");
  const sites = top.map((s) => `<tr><td style="padding:4px 0;color:#2b2926">${esc(s.host)}</td>
      <td style="padding:4px 0;text-align:right;color:#6b6760">${hm(num(s.secs) / 60)}</td></tr>`).join("");
  const streak = num(data && data.streak);

  const html = `<!doctype html><html><body style="margin:0;background:#f4f2ee;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border-radius:16px;padding:28px">
    <tr><td>
      <p style="margin:0;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#8a857c">Atlas · your week</p>
      <h1 style="margin:6px 0 4px;font-size:22px;color:#1d1a16">Hi ${esc(name)}, here is ${range}</h1>
      <p style="margin:0 0 20px;color:#6b6760;font-size:14px">${streak ? `You are on a ${streak}-day focus streak. ` : ""}Keep going.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="6"><tr>
        ${tiles.slice(0, 3).map(([k, v]) => tile(k, v)).join("")}</tr><tr>
        ${tiles.slice(3).map(([k, v]) => tile(k, v)).join("")}</tr></table>
      ${days.length ? `<h2 style="margin:24px 0 10px;font-size:14px;color:#1d1a16">Focus by day</h2>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${bars}</tr></table>` : ""}
      ${sites ? `<h2 style="margin:24px 0 6px;font-size:14px;color:#1d1a16">Where your time went</h2>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px">${sites}</table>` : ""}
      <p style="margin:28px 0 0;font-size:12px;color:#8a857c">You get this because the weekly email is on in Atlas (Quick tools, Stats). Turn it off there any time.</p>
    </td></tr></table></td></tr></table></body></html>`;

  const text = [
    `Atlas: your week (${range})`,
    ...tiles.map(([k, v]) => `${k}: ${v}`),
    ...(top.length ? ["", "Top sites:", ...top.map((s) => `  ${s.host}: ${hm(num(s.secs) / 60)}`)] : []),
  ].join("\n");
  return { subject: `Your week in Atlas: ${hm(t.focus)} focused`, html, text };
}
