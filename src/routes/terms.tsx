import { createFileRoute, Link } from "@tanstack/react-router";
import { DocPage } from "@/components/site/layout";
import { CONTACT_EMAIL } from "@/lib/site";

export const Route = createFileRoute("/terms")({
  head: () => ({ meta: [{ title: "Terms — Atlas" }] }),
  component: Terms,
});

function Terms() {
  return (
    <DocPage title="Terms of service" updated="October 2, 2026">
      <p>
        These terms cover your use of the Atlas New Tab browser extension, this website and the Atlas Pro subscription.
        By installing Atlas or buying Pro you agree to them.
      </p>

      <h2>1. The extension</h2>
      <p>
        Atlas is free to install and use. We may add, change or remove features over time. You may not resell Atlas,
        or use it to break the law or abuse the services it connects to.
      </p>

      <h2>2. Atlas Pro</h2>
      <p>
        Pro is a subscription billed monthly or yearly, in advance, until you cancel. New accounts may get a free trial;
        when it ends, Pro features stop unless you subscribe. Our order process is conducted by our online reseller
        Paddle.com. Paddle.com is the Merchant of Record for all our orders. Paddle provides all customer service
        inquiries and handles returns.
      </p>
      <p>
        You can cancel at any time from Customize › Account › Manage subscription. Cancelling stops future renewals; you
        keep Pro until the end of the period you've paid for. Prices may change; we'll tell you before a change affects
        your renewal. Refunds are covered by our <Link to="/refunds">refund policy</Link>.
      </p>

      <h2>3. Your account and data</h2>
      <p>
        You're responsible for your Google account and for what you store in Atlas. You can delete your Atlas account
        at any time. How we handle data is described in the <Link to="/privacy">privacy policy</Link>.
      </p>

      <h2>4. The assistant</h2>
      <p>
        The assistant's answers are generated automatically and can be wrong. Don't rely on them for medical, legal,
        financial or other important decisions. Daily message limits apply.
      </p>

      <h2>5. No warranty</h2>
      <p>
        Atlas is provided "as is". To the extent the law allows, we aren't liable for indirect or consequential losses,
        and our total liability is limited to what you paid us in the 12 months before the claim.
      </p>

      <h2>6. Changes</h2>
      <p>We may update these terms. If a change is significant, we'll say so in the extension or by email.</p>

      <h2>7. Contact</h2>
      <p>
        <a href={"mailto:" + CONTACT_EMAIL}>{CONTACT_EMAIL}</a>
      </p>
    </DocPage>
  );
}
