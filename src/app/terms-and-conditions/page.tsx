import { StaticLayout } from '@/components/layout';
import { StaticBodyText, StaticHeading, StaticTitle } from '@/components/ui';

const linkClass =
  'font-semibold text-emerald-700 underline underline-offset-4 hover:text-emerald-800';
const sectionClass = 'space-y-4 border-t border-slate-200 pt-8';

export default function TermsAndConditionsPage() {
  return (
    <StaticLayout>
      <main className="legal-content mx-auto w-full max-w-4xl px-4 pb-12 sm:px-6">
        <div className="space-y-3">
          <StaticTitle>Terms &amp; Conditions</StaticTitle>
          <StaticBodyText size="lg" className="text-slate-600">
            Last Updated: April 28, 2026
          </StaticBodyText>
        </div>

        <div className="mt-8 rounded-lg border border-slate-200 bg-white/80 p-5 shadow-sm">
          <StaticBodyText size="lg" className="text-slate-700">
            These Terms &amp; Conditions govern your use of The Chiroport website,
            queue, check-in forms, SMS communications, and related chiropractic,
            massage, bodywork, and wellness services. Please read them carefully.
          </StaticBodyText>
        </div>

        <div className="mt-10 space-y-10">
          <section className="space-y-4">
            <StaticHeading>1. Acceptance of Terms</StaticHeading>
            <StaticBodyText size="lg">
              By using our website, joining a queue, checking in, submitting
              information, receiving services, or checking a box that references these
              Terms &amp; Conditions, you agree to these Terms and our{' '}
              <a className={linkClass} href="/privacy-policy">
                Privacy Policy
              </a>
              . If you do not agree, do not use the website, queue, or related
              services.
            </StaticBodyText>
          </section>

          <section className={sectionClass}>
            <StaticHeading>2. Services and No Emergency Care</StaticHeading>
            <StaticBodyText size="lg">
              The Chiroport provides walk-in chiropractic, massage, bodywork, and
              wellness services at airport and travel-related locations. Website
              information, wait estimates, queue messages, and service descriptions are
              provided for general information and operational convenience only. They
              are not medical advice and do not replace evaluation by a qualified
              healthcare professional.
            </StaticBodyText>
            <StaticBodyText size="lg">
              The Chiroport does not provide emergency medical services. If you have a
              medical emergency, call 911 or seek emergency care immediately.
            </StaticBodyText>
          </section>

          <section className={sectionClass}>
            <StaticHeading>3. Service Risks and Customer Responsibilities</StaticHeading>
            <StaticBodyText size="lg">
              Chiropractic, massage, stretching, bodywork, and related services may
              involve physical contact, movement, pressure, spinal or neck adjustment,
              stretching, soft-tissue work, percussion or vibration devices, and other
              hands-on techniques. Normal reactions may include temporary soreness,
              tenderness, stiffness, bruising, dizziness, fatigue, headache, or
              temporary aggravation of symptoms. Rare or unexpected reactions may also
              occur.
            </StaticBodyText>
            <StaticBodyText size="lg">
              You are responsible for giving accurate and complete information about
              your health, injuries, symptoms, medical conditions, medications,
              pregnancy status, recent surgeries, and any reason a service may be
              unsafe or uncomfortable for you. You should ask questions before
              receiving services and immediately tell the provider if you want a
              service modified or stopped. Providers may decline or stop services at
              their professional discretion.
            </StaticBodyText>
            <StaticBodyText size="lg">
              To the fullest extent permitted by law, you knowingly accept the ordinary
              and inherent risks of the services you choose to receive and release The
              Chiroport Worldwide LLC, The Chiroport, and their owners, employees,
              contractors, providers, agents, affiliates, and insurers from claims
              arising from ordinary or expected service reactions. Nothing in these
              Terms limits liability that cannot legally be limited, including liability
              for gross negligence, willful misconduct, or other non-waivable rights.
            </StaticBodyText>
          </section>

          <section className={sectionClass}>
            <StaticHeading>4. SMS and Automated Communications</StaticHeading>
            <StaticBodyText size="lg">
              By providing your phone number, joining a queue, checking in, or agreeing
              to these Terms, you authorize The Chiroport to send visit-related SMS
              messages to the number you provide. Messages may be sent using automated
              technology and may include queue confirmations, wait or status updates,
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
                For help, contact{' '}
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
              Consent to receive SMS messages is not a condition of purchase. SMS
              delivery depends on carriers, networks, and device settings. The
              Chiroport is not responsible for delayed, blocked, or undelivered
              messages.
            </StaticBodyText>
          </section>

          <section className={sectionClass}>
            <StaticHeading>5. Queue, Wait Times, and Availability</StaticHeading>
            <StaticBodyText size="lg">
              Queue positions, wait estimates, service availability, hours, locations,
              prices, and provider availability may change at any time. We may correct
              errors, refuse service, cancel entries, move entries, close a queue, or
              modify operations when reasonably necessary for safety, staffing,
              operational, legal, or business reasons.
            </StaticBodyText>
          </section>

          <section className={sectionClass}>
            <StaticHeading>6. Payments, Prices, and Programs</StaticHeading>
            <StaticBodyText size="lg">
              Prices, accepted payment methods, and third-party travel program benefits
              may vary by location and may change without notice. You are responsible
              for confirming whether any lounge, Priority Pass, Lounge Key, insurance,
              employer, membership, or other third-party benefit applies before
              receiving services. Unless a specific written policy says otherwise,
              payments are due at the time of service and refunds are handled at The
              Chiroport&apos;s discretion and subject to applicable law.
            </StaticBodyText>
          </section>

          <section className={sectionClass}>
            <StaticHeading>7. Website Use</StaticHeading>
            <StaticBodyText size="lg">
              You agree to provide accurate information, use the website lawfully, and
              avoid interfering with the website, queue, security controls, SMS systems,
              or other operations. You may not submit false information, impersonate
              another person, attempt unauthorized access, or misuse staff
              communication channels.
            </StaticBodyText>
          </section>

          <section className={sectionClass}>
            <StaticHeading>8. Disclaimers and Limitation of Liability</StaticHeading>
            <StaticBodyText size="lg">
              The website, queue, SMS systems, and online information are provided
              &quot;as is&quot; and &quot;as available&quot; without warranties of any kind,
              express or implied. To the fullest extent permitted by law, The Chiroport
              is not liable for indirect, incidental, special, consequential,
              exemplary, or punitive damages, lost profits, lost data, lost business,
              travel disruption, missed flights, missed appointments, or damages caused
              by website, queue, SMS, carrier, network, device, or third-party service
              failures.
            </StaticBodyText>
            <StaticBodyText size="lg">
              To the fullest extent permitted by law, any liability arising from or
              related to website, queue, SMS, or online service use is limited to the
              greater of the amount you paid to The Chiroport for the service giving
              rise to the claim or $100. This limitation does not apply where
              prohibited by law or to liability that cannot legally be limited.
            </StaticBodyText>
          </section>

          <section className={sectionClass}>
            <StaticHeading>9. Indemnification</StaticHeading>
            <StaticBodyText size="lg">
              To the fullest extent permitted by law, you agree to defend, indemnify,
              and hold harmless The Chiroport Worldwide LLC, The Chiroport, and their
              owners, employees, contractors, providers, agents, affiliates, and
              insurers from claims, losses, liabilities, damages, costs, and expenses
              arising from your misuse of the website or services, your false or
              incomplete information, your violation of these Terms, or your violation
              of another person&apos;s rights.
            </StaticBodyText>
          </section>

          <section className={sectionClass}>
            <StaticHeading>10. Dispute Resolution and Class Waiver</StaticHeading>
            <StaticBodyText size="lg">
              Please read this section carefully. To the fullest extent permitted by
              law, you and The Chiroport agree that disputes, claims, or controversies
              arising from or related to the website, queue, SMS communications, these
              Terms, or services will be resolved only on an individual basis and not
              as a class, collective, consolidated, representative, or private attorney
              general action.
            </StaticBodyText>
            <StaticBodyText size="lg">
              Except for matters that may be brought in small claims court or claims
              for injunctive relief, disputes will be resolved by binding individual
              arbitration under the Federal Arbitration Act and the applicable consumer
              arbitration rules of the American Arbitration Association, unless the
              parties agree otherwise in writing. You may opt out of this arbitration
              agreement within 30 days after first accepting these Terms by emailing{' '}
              <a className={linkClass} href="mailto:info@thechiroport.com">
                info@thechiroport.com
              </a>{' '}
              with the subject line &quot;Arbitration Opt-Out&quot; and your name, phone
              number, and email address.
            </StaticBodyText>
            <StaticBodyText size="lg">
              If any part of this dispute resolution section is found unenforceable,
              the remaining provisions will remain enforceable to the fullest extent
              permitted by law, except that if the class waiver is unenforceable as to a
              particular claim, that claim may proceed only in court and not in
              arbitration.
            </StaticBodyText>
          </section>

          <section className={sectionClass}>
            <StaticHeading>11. Governing Law</StaticHeading>
            <StaticBodyText size="lg">
              These Terms are governed by the laws of the State of Minnesota, without
              regard to conflict of law principles, except where another jurisdiction&apos;s
              law is required by applicable law.
            </StaticBodyText>
          </section>

          <section className={sectionClass}>
            <StaticHeading>12. Changes to Terms</StaticHeading>
            <StaticBodyText size="lg">
              We may update these Terms from time to time. Updates will be posted on
              this page with a revised date. Your continued use of the website, queue,
              SMS communications, or services after updates are posted means you accept
              the updated Terms to the extent permitted by law.
            </StaticBodyText>
          </section>

          <section className={sectionClass}>
            <StaticHeading>13. Contact Information</StaticHeading>
            <StaticBodyText size="lg">
              For questions about these Terms, contact us:
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
