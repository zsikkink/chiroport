import { StaticLayout } from '@/components/layout';
import { StaticBodyText, StaticHeading, StaticTitle } from '@/components/ui';

const linkClass =
  'font-semibold text-emerald-700 underline underline-offset-4 hover:text-emerald-800';
const sectionClass = 'space-y-4 border-t border-slate-200 pt-8';

export default function PrivacyPolicyPage() {
  return (
    <StaticLayout>
      <main className="legal-content mx-auto w-full max-w-4xl px-4 pb-12 sm:px-6">
        <div className="space-y-3">
          <StaticTitle>Privacy Policy</StaticTitle>
          <StaticBodyText size="lg" className="text-slate-600">
            Last Updated: April 28, 2026
          </StaticBodyText>
        </div>

        <div className="mt-8 rounded-lg border border-slate-200 bg-white/80 p-5 shadow-sm">
          <StaticBodyText size="lg" className="text-slate-700">
            This Privacy Policy explains how The Chiroport Worldwide LLC, doing
            business as The Chiroport, collects, uses, shares, and protects
            information submitted through our website, queue, check-in, and
            visit-related communication tools.
          </StaticBodyText>
        </div>

        <div className="mt-10 space-y-10">
          <section className="space-y-4">
            <StaticHeading>1. Information We Collect</StaticHeading>
            <StaticBodyText size="lg">
              We collect information you provide when you use our website, join a
              queue, request a service, or communicate with us. This may include:
            </StaticBodyText>
            <ul className="list-disc space-y-2 pl-6">
              <StaticBodyText as="li" size="lg">
                Name, phone number, and email address
              </StaticBodyText>
              <StaticBodyText as="li" size="lg">
                Airport, location, queue, service, and visit details
              </StaticBodyText>
              <StaticBodyText as="li" size="lg">
                Consent records, including consent version, acceptance time, and
                related audit information
              </StaticBodyText>
              <StaticBodyText as="li" size="lg">
                Communications with our staff, including SMS messages sent to or from
                The Chiroport
              </StaticBodyText>
              <StaticBodyText as="li" size="lg">
                Basic technical information such as browser, device, logs, and usage
                data needed to operate, secure, and improve the website
              </StaticBodyText>
            </ul>
          </section>

          <section className={sectionClass}>
            <StaticHeading>2. How We Use Information</StaticHeading>
            <StaticBodyText size="lg">We use information to:</StaticBodyText>
            <ul className="list-disc space-y-2 pl-6">
              <StaticBodyText as="li" size="lg">
                Provide chiropractic, massage, bodywork, queue, and visit services
              </StaticBodyText>
              <StaticBodyText as="li" size="lg">
                Send visit-related updates, reminders, service notifications, and
                queue messages
              </StaticBodyText>
              <StaticBodyText as="li" size="lg">
                Respond to questions, support requests, and customer communications
              </StaticBodyText>
              <StaticBodyText as="li" size="lg">
                Maintain business, safety, legal, audit, and compliance records
              </StaticBodyText>
              <StaticBodyText as="li" size="lg">
                Monitor, protect, debug, and improve our website and operations
              </StaticBodyText>
            </ul>
            <StaticBodyText size="lg">
              We do not use your mobile number to send third-party marketing messages.
            </StaticBodyText>
          </section>

          <section className={sectionClass}>
            <StaticHeading>3. SMS and Automated Messages</StaticHeading>
            <StaticBodyText size="lg">
              When you provide your phone number and agree to our Terms &amp;
              Conditions, you authorize The Chiroport to send visit-related SMS
              messages to the number provided. These messages may be sent using
              automated technology and may include queue confirmations, status updates,
              service notifications, staff replies, cancellation confirmations, and
              other operational messages related to your visit.
            </StaticBodyText>
            <ul className="list-disc space-y-2 pl-6">
              <StaticBodyText as="li" size="lg">
                Message frequency varies based on your visit activity
              </StaticBodyText>
              <StaticBodyText as="li" size="lg">
                Message and data rates may apply
              </StaticBodyText>
              <StaticBodyText as="li" size="lg">
                Reply STOP to opt out of SMS messages
              </StaticBodyText>
              <StaticBodyText as="li" size="lg">
                Reply START to opt back in where supported
              </StaticBodyText>
              <StaticBodyText as="li" size="lg">
                For help, contact us at{' '}
                <a className={linkClass} href="mailto:info@thechiroport.com">
                  info@thechiroport.com
                </a>{' '}
                or{' '}
                <a className={linkClass} href="tel:+16125681224">
                  (612) 568-1224
                </a>
              </StaticBodyText>
            </ul>
            <StaticBodyText size="lg">
              Consent to receive SMS messages is not a condition of purchase. If you
              opt out, we may send one final non-marketing message confirming your
              opt-out request where permitted by law.
            </StaticBodyText>
          </section>

          <section className={sectionClass}>
            <StaticHeading>4. Sharing of Information</StaticHeading>
            <StaticBodyText size="lg">
              We do not sell, rent, or trade personal information. We do not share
              mobile opt-in information, phone numbers, or SMS consent data with third
              parties for their marketing or promotional purposes.
            </StaticBodyText>
            <StaticBodyText size="lg">
              We may share information with service providers who help us operate our
              website, queue, analytics, communications, SMS delivery, hosting,
              security, payment, or business systems. These providers may use the
              information only to provide services to us or as otherwise required by
              law. We may also disclose information if needed to comply with law,
              enforce our agreements, protect rights and safety, investigate misuse, or
              complete a business transaction such as a merger or sale.
            </StaticBodyText>
          </section>

          <section className={sectionClass}>
            <StaticHeading>5. Data Retention and Security</StaticHeading>
            <StaticBodyText size="lg">
              We retain personal information for as long as reasonably needed to
              provide services, maintain records, resolve disputes, comply with legal
              obligations, and enforce agreements. We use reasonable administrative,
              technical, and organizational safeguards designed to protect personal
              information. No website, database, or communication system is completely
              secure, so we cannot guarantee absolute security.
            </StaticBodyText>
          </section>

          <section className={sectionClass}>
            <StaticHeading>6. Your Choices</StaticHeading>
            <StaticBodyText size="lg">
              You may opt out of SMS messages by replying STOP. You may also contact
              us to request access, correction, deletion, or other privacy assistance.
              Some requests may be limited by legal, operational, safety, or record
              retention requirements.
            </StaticBodyText>
          </section>

          <section className={sectionClass}>
            <StaticHeading>7. Children and Sensitive Information</StaticHeading>
            <StaticBodyText size="lg">
              Our website is not intended for children under 13. Do not use our website
              to submit emergency medical information or urgent health requests. For a
              medical emergency, call 911 or seek emergency care immediately.
            </StaticBodyText>
          </section>

          <section className={sectionClass}>
            <StaticHeading>8. Changes to This Policy</StaticHeading>
            <StaticBodyText size="lg">
              We may update this Privacy Policy from time to time. Updates will be
              posted on this page with a revised date. Your continued use of the
              website or services after updates are posted means you accept the updated
              policy to the extent permitted by law.
            </StaticBodyText>
          </section>

          <section className={sectionClass}>
            <StaticHeading>9. Contact Us</StaticHeading>
            <StaticBodyText size="lg">
              If you have questions about this Privacy Policy, contact us:
            </StaticBodyText>

            <div className="rounded-lg border border-slate-200 bg-white/80 p-5 shadow-sm">
              <div className="space-y-4">
                <div>
                  <StaticBodyText size="lg" className="text-slate-600">
                    Email
                  </StaticBodyText>
                  <a className={linkClass} href="mailto:info@thechiroport.com">
                    info@thechiroport.com
                  </a>
                </div>

                <div>
                  <StaticBodyText size="lg" className="text-slate-600">
                    Phone
                  </StaticBodyText>
                  <a className={linkClass} href="tel:+16125681224">
                    (612) 568-1224
                  </a>
                </div>

                <div>
                  <StaticBodyText size="lg" className="text-slate-600">
                    Legal Business Name
                  </StaticBodyText>
                  <StaticBodyText size="lg">The Chiroport Worldwide LLC</StaticBodyText>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
    </StaticLayout>
  );
}
