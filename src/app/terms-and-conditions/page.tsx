import { StaticLayout } from '@/components/layout';
import { StaticBodyText, StaticHeading, StaticTitle } from '@/components/ui';

export default function TermsAndConditionsPage() {
  return (
    <StaticLayout>
      <main className="responsive-container pb-12">
        <div className="space-y-3">
          <StaticTitle>Terms &amp; Conditions</StaticTitle>
          <StaticBodyText size="lg" className="text-slate-600">
            Last Updated: January 4, 2026
          </StaticBodyText>
        </div>

        <div className="mt-10 space-y-10">
          <section className="space-y-4">
            <StaticHeading>1. Acceptance of Terms</StaticHeading>
            <StaticBodyText size="lg">
              By using the The Chiroport Worldwide LLC (&quot;The Chiroport&quot;) website or
              services, including submitting information through our website forms, you agree
              to these Terms &amp; Conditions.
            </StaticBodyText>
          </section>

          <section className="space-y-4">
            <StaticHeading>2. Services</StaticHeading>
            <StaticBodyText size="lg">
              The Chiroport provides chiropractic, bodywork, and wellness services.
              Information provided on this website is for general informational purposes and
              does not replace professional medical advice.
            </StaticBodyText>
          </section>

          <section className="space-y-4">
            <StaticHeading>3. SMS Terms</StaticHeading>
            <StaticBodyText size="lg">
              By providing your phone number and checking the consent box on our website, you
              agree to receive SMS messages related to your visit (such as visit status
              updates, reminders, or service notifications).
            </StaticBodyText>

            <ul className="list-disc pl-6 space-y-2">
              <StaticBodyText as="li" size="lg">
                Message frequency varies
              </StaticBodyText>
              <StaticBodyText as="li" size="lg">
                Message &amp; data rates may apply
              </StaticBodyText>
              <StaticBodyText as="li" size="lg">
                Reply STOP to unsubscribe at any time
              </StaticBodyText>
              <StaticBodyText as="li" size="lg">
                Reply HELP for assistance
              </StaticBodyText>
            </ul>

            <StaticBodyText size="lg">
              Consent to receive SMS messages is not required to receive services.
            </StaticBodyText>
          </section>

          <section className="space-y-4">
            <StaticHeading>4. No Guarantee of Message Delivery</StaticHeading>
            <StaticBodyText size="lg">
              SMS delivery is subject to mobile carrier availability and network conditions.
              The Chiroport is not responsible for delayed or undelivered messages.
            </StaticBodyText>
          </section>

          <section className="space-y-4">
            <StaticHeading>5. User Responsibilities</StaticHeading>
            <StaticBodyText size="lg">
              You agree to provide accurate information when submitting forms and to use the
              website in a lawful manner.
            </StaticBodyText>
          </section>

          <section className="space-y-4">
            <StaticHeading>6. Limitation of Liability</StaticHeading>
            <StaticBodyText size="lg">
              To the fullest extent permitted by law, The Chiroport is not liable for any
              indirect, incidental, or consequential damages arising from use of the website
              or SMS communications.
            </StaticBodyText>
          </section>

          <section className="space-y-4">
            <StaticHeading>7. Changes to Terms</StaticHeading>
            <StaticBodyText size="lg">
              We may update these Terms &amp; Conditions at any time. Changes will be effective
              upon posting to this page.
            </StaticBodyText>
          </section>

          <section className="space-y-4">
            <StaticHeading>8. Contact Information</StaticHeading>
            <StaticBodyText size="lg">
              For questions regarding these Terms &amp; Conditions, please contact us:
            </StaticBodyText>

            <div className="rounded-xl border border-white/10 bg-white/5 p-5">
              <div className="space-y-3">
                <div>
                  <StaticBodyText size="lg" className="text-slate-600">
                    Email
                  </StaticBodyText>
                  <a
                    href="mailto:info@thechiroport.com"
                    className="text-lg text-blue-700 underline underline-offset-4 hover:text-blue-800"
                  >
                    info@thechiroport.com
                  </a>
                </div>

                <div>
                  <StaticBodyText size="lg" className="text-slate-600">
                    Phone
                  </StaticBodyText>
                  <a
                    href="tel:+16125681224"
                    className="text-lg text-blue-700 underline underline-offset-4 hover:text-blue-800"
                  >
                    (612) 568-1224
                  </a>
                </div>

                <div>
                  <StaticBodyText size="lg" className="text-slate-600">
                    Website
                  </StaticBodyText>
                  <a
                    href="https://www.thechiroport.com"
                    target="_blank"
                    rel="noreferrer"
                    className="text-lg text-blue-700 underline underline-offset-4 hover:text-blue-800"
                  >
                    https://www.thechiroport.com
                  </a>
                </div>

                <div className="pt-2">
                  <StaticBodyText size="lg" className="text-slate-600">
                    Legal Business Name
                  </StaticBodyText>
                  <StaticBodyText size="lg">The Chiroport Worldwide LLC</StaticBodyText>
                </div>

                <div>
                  <StaticBodyText size="lg" className="text-slate-600">
                    Brand Name
                  </StaticBodyText>
                  <StaticBodyText size="lg">The Chiroport</StaticBodyText>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
    </StaticLayout>
  );
}