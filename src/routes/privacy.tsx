import { createFileRoute } from "@tanstack/react-router";
import { DocPage } from "@/components/site/layout";
import { seo } from "@/lib/seo";
import { CONTACT_EMAIL } from "@/lib/site";

export const Route = createFileRoute("/privacy")({
  head: () => seo({ path: "/privacy", title: "Privacy policy — Atlas New Tab", description: "What Atlas New Tab stores, what it sends and to whom." }),
  component: Privacy,
});

function Privacy() {
  return (
    <DocPage title="Privacy policy" updated="October 12, 2026">
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

      <h2>3. Google user data</h2>
      <p>
        This section describes exactly how Atlas accesses, uses, shares, protects, keeps and deletes data it receives
        from your Google account. Atlas only asks for Google access when you choose to sign in or connect your calendar.
      </p>

      <h3>Data Atlas accesses</h3>
      <ul>
        <li>
          <b>Basic profile</b> (scopes <code>openid</code>, <code>email</code>, <code>profile</code>): your Google
          account ID, email address, name and profile picture.
        </li>
        <li>
          <b>Google Calendar, read-only</b> (scopes <code>calendar.events.readonly</code> and{" "}
          <code>calendar.calendarlist.readonly</code>, only if you allow it): the list of
          calendars you have selected in Google Calendar (ID and colour), and for today and the next 7 days each event's
          title, start and end time, whether it's all-day, location, link to the event, Google Meet link, and whether
          you declined it. Atlas never creates, edits or deletes calendar events and doesn't read event descriptions,
          attachments or other guests' details.
        </li>
      </ul>

      <h3>How Atlas uses it</h3>
      <ul>
        <li>Your profile is used only to create and identify your Atlas account, show who's signed in, and send the emails you ask for (such as the weekly summary).</li>
        <li>Calendar events are used only to show your agenda inside the extension and, when you ask, to let the day planner build a schedule around your meetings.</li>
        <li>
          Google user data is not used for advertising, is not sold, is not used to build user profiles, and is not used
          to train AI or machine-learning models.
        </li>
      </ul>

      <h3>Sharing, transfer and disclosure</h3>
      <ul>
        <li>We don't sell, rent or share Google user data with advertisers, data brokers or any other third party.</li>
        <li>
          Your profile (email, name, picture, Google ID) is stored by our service providers that host Atlas: Vercel
          (server) and Supabase (database). Your email address is given to Resend only to deliver emails you turned on.
        </li>
        <li>
          Calendar events are fetched directly from Google into your browser and are not sent to our server, except when
          you press "Plan my day": then only the title and start/end times of that day's events are sent to our server,
          which passes them to Google's Gemini API to produce the plan. They aren't stored or logged by us.
        </li>
        <li>We may disclose data only if required by law, or as part of a merger or acquisition with your notice.</li>
      </ul>

      <h3>AI processing of Google user data</h3>
      <p>
        The day planner uses one AI provider: Google's Gemini API (a Gemini Flash model), called directly from our server
        on Google's paid API tier. No aggregator, gateway or other AI provider is involved, and no self-hosted model is used.
      </p>
      <ul>
        <li>Only the title and start/end time of the events on the day being planned are sent, and only when you press "Plan my day".</li>
        <li>
          Under the paid Gemini API terms, Google does not use these prompts or responses to train or improve its models.
          We don't store them, and we never use Google user data, raw, aggregated, anonymized or derived, to create, train
          or improve any AI or machine-learning model.
        </li>
      </ul>

      <h3>How we protect it</h3>
      <ul>
        <li>All data is sent over encrypted HTTPS (TLS) connections.</li>
        <li>
          Google access tokens are kept only in your browser's extension storage, are never sent to or stored on our
          server, and expire after one hour.
        </li>
        <li>
          Our database is encrypted at rest and only reachable by our server with restricted credentials. Your account
          is protected with signed, expiring session tokens.
        </li>
        <li>Access to production data is limited to the developer and used only to run and support the service.</li>
      </ul>

      <h3>Retention and deletion</h3>
      <ul>
        <li>
          Calendar events are cached only on your computer, refreshed about every 10 minutes and limited to the next 7
          days. They're deleted from your computer when you sign out, disconnect the calendar or uninstall Atlas.
          Disconnecting the calendar also revokes Atlas's access with Google.
        </li>
        <li>
          Your profile is kept while you have an Atlas account. Deleting your account in Customize › Account permanently
          and immediately deletes it with everything stored with it from our database.
        </li>
        <li>
          You can also remove Atlas's access at any time at{" "}
          <a href="https://myaccount.google.com/permissions">myaccount.google.com/permissions</a>, or email us to have
          your data deleted.
        </li>
      </ul>

      <h3>Limited Use</h3>
      <p>
        The use of raw or derived user data received from Google Workspace APIs (Google Calendar), and Atlas's use and
        transfer of information received from Google APIs to any other app, will adhere to the{" "}
        <a href="https://developers.google.com/terms/api-services-user-data-policy">
          Google API Services User Data Policy
        </a>
        , including the Limited Use requirements.
      </p>

      <h2>4. Payments</h2>
      <p>
        Pro subscriptions are sold by Paddle.com, our merchant of record. Paddle collects and processes your payment and
        billing details under its own privacy policy; we never see your card number. We receive your subscription status,
        plan and renewal date from Paddle and keep them with your account.
      </p>

      <h2>5. Services we send data to</h2>
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

      <h2>6. Permissions</h2>
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

      <h2>7. Children</h2>
      <p>Atlas isn't directed at children under 13, and we don't knowingly collect their personal information.</p>

      <h2>8. Changes</h2>
      <p>If this policy changes, we'll update this page and the date at the top.</p>

      <h2>9. Contact</h2>
      <p>
        Questions about privacy: <a href={"mailto:" + CONTACT_EMAIL}>{CONTACT_EMAIL}</a>
      </p>
    </DocPage>
  );
}
