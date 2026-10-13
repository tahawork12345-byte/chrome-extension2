import { createFileRoute } from "@tanstack/react-router";
import { DocPage } from "@/components/site/layout";
import { seo } from "@/lib/seo";
import { CONTACT_EMAIL } from "@/lib/site";

export const Route = createFileRoute("/refunds")({
  head: () => seo({ path: "/refunds", title: "Refund policy — Atlas Pro", description: "How refunds work for Atlas Pro subscriptions bought through Paddle, and how to ask for one." }),
  component: Refunds,
});

function Refunds() {
  return (
    <DocPage title="Refund policy" updated="October 2, 2026">
      <p>
        If Atlas Pro isn't right for you, you can ask for a full refund within 14 days of your first payment, or of a
        renewal. No questions asked.
      </p>
      <h2>How to ask</h2>
      <p>
        Reply to your Paddle receipt email, or find your order at{" "}
        <a href="https://paddle.net" target="_blank" rel="noreferrer">
          paddle.net
        </a>{" "}
        and request a refund there. You can also email us at <a href={"mailto:" + CONTACT_EMAIL}>{CONTACT_EMAIL}</a> with
        the email address you paid with.
      </p>
      <h2>What happens next</h2>
      <p>
        Paddle, our merchant of record, processes the refund to your original payment method, usually within 5–10
        business days. Your subscription is cancelled and your account goes back to the free plan. Your settings stay as
        they are.
      </p>
      <h2>Cancelling instead</h2>
      <p>
        If you'd just like to stop future payments, cancel from Customize › Account › Manage subscription. You'll keep Pro
        until the end of the period you've already paid for.
      </p>
    </DocPage>
  );
}
