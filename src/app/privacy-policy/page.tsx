import { StaticLayout } from '@/components/layout';
import { StaticBodyText, StaticHeading, StaticTitle } from '@/components/ui';

export default function PrivacyPolicyPage() {
  return (
    <StaticLayout>
      <main className="responsive-container pb-12">
        <div className="space-y-3">
          <StaticTitle>Privacy Policy</StaticTitle>
          <StaticBodyText size="lg" className="text-white/80">
            Last Updated: January 4, 2026
          </StaticBodyText>
        </div>

        <div className="mt-10 space-y-10">
          <section className="space-y-4">
            <StaticHeading>1. Introduction</StaticHeading>
            <StaticBodyText size="lg">
              The Chiroport (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) respects your
              privacy and is committed to protecting your personal information. This
              Privacy Policy explains how we collect, use, and protect information when
              you visit our website or use our services, including SMS communications
              related to your visit.
            </StaticBodyText>
          </section>

          <section className="space-y-4">
            <StaticHeading>2. Information We Collect</StaticHeading>
            <StaticBodyText size="lg">
              We may collect the following personal information:
            </StaticBodyText>
            <ul className="list-disc pl-6 space-y-2">
              <StaticBodyText as="li" size="lg">
                Name
              </StaticBodyText>
              <StaticBodyText as="li" size="lg">
                Phone number
              </StaticBodyText>
              <StaticBodyText as="li" size="lg">
                Email address
              </StaticBodyText>
              <StaticBodyText as="li" size="lg">
                Visit and appointment details
              </StaticBodyText>
              <StaticBodyText as="li" size="lg">
                Location or service selection information submitted through our website
              </StaticBodyText>
            </ul>
            <StaticBodyText size="lg">
              We collect this information when you voluntarily provide it through our
              website forms or during the visit check-in process.
            </StaticBodyText>
          </section>

          <section className="space-y-4">
            <StaticHeading>3. How We Use Your Information</StaticHeading>
            <StaticBodyText size="lg">
              We use your information to:
            </StaticBodyText>
            <ul className="list-disc pl-6 space-y-2">
              <StaticBodyText as="li" size="lg">
                Provide bodywork services
              </StaticBodyText>
              <StaticBodyText as="li" size="lg">
                Manage visit check-in and queue updates
              </StaticBodyText>
              <StaticBodyText as="li" size="lg">
                Send SMS notifications related to your visit (e.g., status updates,
                reminders)
              </StaticBodyText>
              <StaticBodyText as="li" size="lg">
                Communicate important service-related information
              </StaticBodyText>
              <StaticBodyText as="li" size="lg">
                Improve our services and website
              </StaticBodyText>
            </ul>
            <StaticBodyText size="lg">
              We do not use your information for unsolicited marketing messages.
            </StaticBodyText>
          </section>

          <section className="space-y-4">
            <StaticHeading>4. SMS Communications</StaticHeading>
            <StaticBodyText size="lg">
              If you provide your phone number and consent, you may receive SMS messages
              related to your visit at The Chiroport.
            </StaticBodyText>
            <ul className="list-disc pl-6 space-y-2">
              <StaticBodyText as="li" size="lg">
                Message frequency varies based on visit activity
              </StaticBodyText>
              <StaticBodyText as="li" size="lg">
                Message &amp; data rates may apply
              </StaticBodyText>
              <StaticBodyText as="li" size="lg">
                You may opt out at any time by replying STOP
              </StaticBodyText>
              <StaticBodyText as="li" size="lg">
                Reply HELP for assistance
              </StaticBodyText>
            </ul>
            <StaticBodyText size="lg">
              Consent to receive SMS messages is not a condition of purchase or service.
            </StaticBodyText>
          </section>

          <section className="space-y-4">
            <StaticHeading>5. Sharing of Information</StaticHeading>
            <StaticBodyText size="lg">
              We do not sell, rent, or trade your personal information, including phone
              numbers, to third parties.
            </StaticBodyText>
            <StaticBodyText size="lg">
              We may share information only with trusted service providers (such as SMS
              or website infrastructure providers) solely for the purpose of operating
              our services and communications.
            </StaticBodyText>
          </section>

          <section className="space-y-4">
            <StaticHeading>6. Data Security</StaticHeading>
            <StaticBodyText size="lg">
              We take reasonable administrative and technical measures to protect your
              personal information against unauthorized access, loss, or misuse.
            </StaticBodyText>
          </section>

          <section className="space-y-4">
            <StaticHeading>7. Your Choices</StaticHeading>
            <StaticBodyText size="lg">
              You may:
            </StaticBodyText>
            <ul className="list-disc pl-6 space-y-2">
              <StaticBodyText as="li" size="lg">
                Opt out of SMS messages at any time by replying STOP
              </StaticBodyText>
              <StaticBodyText as="li" size="lg">
                Request access to or deletion of your personal information by contacting
                us
              </StaticBodyText>
            </ul>
          </section>

          <section className="space-y-4">
            <StaticHeading>8. Changes to This Policy</StaticHeading>
            <StaticBodyText size="lg">
              We may update this Privacy Policy from time to time. Updates will be posted
              on this page with a revised effective date.
            </StaticBodyText>
          </section>

          <section className="space-y-4">
            <StaticHeading>9. Contact Us</StaticHeading>
            <StaticBodyText size="lg">
              If you have questions about this Privacy Policy, please contact us at
            </StaticBodyText>
            <div className="space-y-2">
              <StaticBodyText size="lg">Email: info@thechiroport.com</StaticBodyText>
              <StaticBodyText size="lg">Phone: (612) 568-1224</StaticBodyText>
              <StaticBodyText size="lg">The Chiroport</StaticBodyText>
              <StaticBodyText size="lg">Website: https://www.thechiroport.com</StaticBodyText>
            </div>
          </section>
        </div>
      </main>
    </StaticLayout>
  );
}
