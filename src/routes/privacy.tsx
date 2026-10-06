import { createFileRoute } from "@tanstack/react-router";
import { DocPage } from "@/components/site/layout";
import { CONTACT_EMAIL } from "@/lib/site";

export const Route = createFileRoute("/privacy")({
  head: () => ({ meta: [{ title: "Privacy — Atlas" }, { name: "description", content: "What Atlas New Tab stores, what it sends and to whom." }] }),
  component: Privacy,
});

function Privacy() {
  return (
    <DocPage title="Privacy policy" updated="October 2, 2026">
      <p>
        Atlas New Tab ("Atlas", "the extension") replaces Chrome's new tab page with shortcuts, search, wallpapers,
        weather, a media widget, small productivity tools and an optional assistant. This page explains what data Atlas
        handles and where it goes. We don't sell your data, show ads, or use your data for advertising.
      </p>

      <h2>1. Data that stays on your device</h2>
      <p>Saved in your browser (chrome.storage, localStorage, IndexedDB) and never sent to us unless you turn on sync:</p>
      <ul>
        <li>Workspaces, shortcut cards and links</li>
        <li>Theme, appearance, cursor and search-engine choices</li>
        <li>Wallpaper choice and any image or video you upload</li>
        <li>Notes, habits, reminders, focus history and the private space</li>
        <li>A city name you enter for weather</li>
        <li>
          Screen-time stats: how long the active tab spends on each website, recorded as the site's domain only (for
          example "youtube.com", never the full address or page content) and kept for about two months
        </li>
      </ul>
      <p>Uninstalling the extension or choosing "Reset to defaults" deletes this data.</p>

      <h2>2. Your Atlas account (optional)</h2>
      <p>
        Signing in is optional and uses your Google account. When you sign in we store your email address, name,
        profile picture and Google account ID, your plan, and the number of assistant messages you've sent each day (to
        apply the daily limit). If you use backup or automatic sync, we store a copy of the settings and data listed
        above so it can be restored on your other computers; the private space stays encrypted with your password, which
        we never receive. If you turn on the weekly email (off by default), your weekly screen-time summary (time per site domain) is uploaded so we can email it to you.
      </p>
      <p>
        If you allow calendar access, Atlas reads your Google Calendar events in your browser to show them and to plan
        your day. Events are sent to our server only when you ask the assistant to plan your day, and are not stored.
      </p>
      <p>You can delete your account and everything stored with it at any time from Customize › Account.</p>

      <h2>3. Payments</h2>
      <p>
        Pro subscriptions are sold by Paddle.com, our merchant of record. Paddle collects and processes your payment and
        billing details under its own privacy policy; we never see your card number. We receive your subscription status,
        plan and renewal date from Paddle and keep them with your account.
      </p>

      <h2>4. Services we send data to</h2>
      <table>
        <thead>
          <tr>
            <th>Feature</th>
            <th>Data sent</th>
            <th>Sent to</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Assistant and day planner</td>
            <td>The messages in your current conversation (and, for planning, that day's tasks and events)</td>
            <td>Our server on Vercel, which forwards them to Google's Gemini API. We don't store conversations.</td>
          </tr>
          <tr>
            <td>Account, sync, backup</td>
            <td>Your profile and the data you choose to sync</td>
            <td>Our server (Vercel) and database (Supabase)</td>
          </tr>
          <tr>
            <td>Weekly email</td>
            <td>Your email address and weekly stats</td>
            <td>Resend, which delivers the email</td>
          </tr>
          <tr>
            <td>Weather</td>
            <td>Approximate location (only if you allow it) or the city you type</td>
            <td>Open-Meteo and BigDataCloud</td>
          </tr>
          <tr>
            <td>Online wallpapers</td>
            <td>Your search words</td>
            <td>Wallhaven, Pixabay and WallpaperWaves (some through our server)</td>
          </tr>
          <tr>
            <td>Search</td>
            <td>What you search for</td>
            <td>The search engine you picked; your browser opens it directly</td>
          </tr>
        </tbody>
      </table>
      <p>Please don't type sensitive personal information into the assistant.</p>

      <h2>5. Permissions</h2>
      <ul>
        <li>
          <b>storage</b> saves your settings on your device.
        </li>
        <li>
          <b>identity</b> lets you sign in with Google.
        </li>
        <li>
          <b>scripting and site access</b> detect media playing in your tabs for the now-playing widget, send play/pause
          and skip to it, and apply your custom cursor on web pages.
        </li>
        <li>
          <b>alarms and notifications</b> fire your reminders and focus-timer alerts.
        </li>
        <li>
          <b>declarativeNetRequest</b> blocks the distracting sites you choose, only while a focus session is running.
        </li>
        <li>
          <b>offscreen</b> plays alarm and focus sounds; <b>idle</b> pauses focus tracking while you're away.
        </li>
        <li>
          <b>management</b> (optional, asked for only if you use it) lists your installed extensions in Quick tools.
        </li>
      </ul>
      <p>
        Apart from the per-domain screen-time stats described above, Atlas does not read, collect or send page content,
        form input or your browsing history.
      </p>

      <h2>6. Children</h2>
      <p>Atlas isn't directed at children under 13, and we don't knowingly collect their personal information.</p>

      <h2>7. Changes</h2>
      <p>If this policy changes, we'll update this page and the date at the top.</p>

      <h2>8. Contact</h2>
      <p>
        Questions about privacy: <a href={"mailto:" + CONTACT_EMAIL}>{CONTACT_EMAIL}</a>
      </p>
    </DocPage>
  );
}
