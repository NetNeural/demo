import type { Metadata } from 'next'
import Link from 'next/link'
import { Shield, ArrowLeft } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Privacy Policy — Sentinel by NetNeural',
  description: 'Privacy Policy for the NetNeural Sentinel IoT Platform',
}

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-300">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Back link */}
        <Link
          href="/auth/login"
          className="mb-8 inline-flex items-center gap-1 text-sm text-gray-500 transition-colors hover:text-cyan-400"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to login
        </Link>

        {/* Header */}
        <div className="mb-8 flex items-center gap-3">
          <Shield className="h-8 w-8 text-cyan-400" />
          <h1 className="text-3xl font-bold text-white">Privacy Policy</h1>
        </div>
        <p className="mb-8 text-sm text-gray-500">
          Last updated: February 28, 2026
        </p>

        {/* Sections */}
        <div className="space-y-8 text-sm leading-relaxed">
          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">
              1. Introduction
            </h2>
            <p>
              NetNeural, Inc. (&quot;NetNeural,&quot; &quot;we,&quot;
              &quot;us,&quot; or &quot;our&quot;) operates the Sentinel IoT
              Platform (&quot;Platform&quot;). This Privacy Policy explains how
              we collect, use, disclose, and safeguard your information when you
              use our Platform. By accessing or using the Platform, you consent
              to the practices described in this policy.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">
              2. Information We Collect
            </h2>
            <h3 className="mb-2 font-medium text-gray-200">
              2.1 Account Information
            </h3>
            <p className="mb-3">
              When you create an account, we collect your name, email address,
              and organization affiliation. If you sign in via Single Sign-On
              (SSO), we receive the identity attributes provided by your identity
              provider.
            </p>
            <h3 className="mb-2 font-medium text-gray-200">
              2.2 Device & Sensor Data
            </h3>
            <p className="mb-3">
              The Platform receives telemetry data from IoT devices registered to
              your organization, including temperature readings, humidity levels,
              battery status, signal strength, and device health metrics. This
              data is associated with your organization, not individual users.
            </p>
            <h3 className="mb-2 font-medium text-gray-200">
              2.3 Usage & Analytics Data
            </h3>
            <p>
              We collect anonymized usage analytics such as pages visited,
              features used, and session duration to improve the Platform. We use
              Sentry for error monitoring and performance tracking. No
              personally identifiable information is sent to third-party
              analytics services.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">
              3. How We Use Your Information
            </h2>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong className="text-gray-200">Platform Operation:</strong>{' '}
                To authenticate users, manage devices, process alerts, and
                deliver real-time monitoring.
              </li>
              <li>
                <strong className="text-gray-200">
                  Notifications & Alerts:
                </strong>{' '}
                To send email and SMS alerts when device thresholds are exceeded
                or system events occur.
              </li>
              <li>
                <strong className="text-gray-200">
                  AI & Predictive Insights:
                </strong>{' '}
                To provide anomaly detection, predictive failure analysis, and
                operational intelligence using anonymized device telemetry.
              </li>
              <li>
                <strong className="text-gray-200">
                  Compliance & Auditing:
                </strong>{' '}
                To maintain audit logs for regulatory compliance (HACCP, food
                safety) as required by your organization.
              </li>
              <li>
                <strong className="text-gray-200">
                  Platform Improvement:
                </strong>{' '}
                To analyze usage patterns and improve features, performance, and
                reliability.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">
              4. Data Storage & Security
            </h2>
            <p className="mb-3">
              All data is stored in Supabase (PostgreSQL) with encryption at rest
              and in transit (TLS 1.2+). We implement Row-Level Security (RLS)
              policies to ensure organizations can only access their own data.
            </p>
            <ul className="list-disc space-y-2 pl-5">
              <li>256-bit AES encryption at rest</li>
              <li>TLS 1.2+ encryption in transit</li>
              <li>
                Row-Level Security (RLS) for multi-tenant data isolation
              </li>
              <li>Audit logging of all administrative actions</li>
              <li>Regular security assessments and updates</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">
              5. Data Sharing & Third Parties
            </h2>
            <p className="mb-3">
              We do not sell your personal information. We share data only with:
            </p>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong className="text-gray-200">Supabase:</strong> Database
                hosting and authentication services
              </li>
              <li>
                <strong className="text-gray-200">Twilio:</strong> SMS alert
                delivery (phone numbers only, when SMS alerts are configured)
              </li>
              <li>
                <strong className="text-gray-200">OpenAI:</strong> AI-powered
                insights (anonymized telemetry data only, no PII)
              </li>
              <li>
                <strong className="text-gray-200">Sentry:</strong> Error
                monitoring (anonymized technical data only)
              </li>
              <li>
                <strong className="text-gray-200">GitHub Pages:</strong> Static
                hosting of the web application
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">
              6. Data Retention
            </h2>
            <p>
              Telemetry data is retained according to your subscription tier:
              Starter (90 days), Professional (1 year), Enterprise (unlimited).
              Account information is retained for the duration of your active
              account. Audit logs are retained for a minimum of 3 years. You may
              request data export or deletion at any time.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">
              7. Your Rights
            </h2>
            <p className="mb-3">
              Depending on your jurisdiction, you may have the following rights:
            </p>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong className="text-gray-200">Access:</strong> Request a
                copy of the personal data we hold about you
              </li>
              <li>
                <strong className="text-gray-200">Correction:</strong> Request
                correction of inaccurate personal data
              </li>
              <li>
                <strong className="text-gray-200">Deletion:</strong> Request
                deletion of your personal data (Right to Erasure / GDPR Art. 17)
              </li>
              <li>
                <strong className="text-gray-200">Portability:</strong> Request
                your data in a machine-readable format (CSV export)
              </li>
              <li>
                <strong className="text-gray-200">Objection:</strong> Object to
                processing of your data for specific purposes
              </li>
            </ul>
            <p className="mt-3">
              To exercise these rights, contact us at{' '}
              <a
                href="mailto:privacy@netneural.ai"
                className="text-cyan-400 underline hover:text-cyan-300"
              >
                privacy@netneural.ai
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">
              8. Cookies & Local Storage
            </h2>
            <p>
              The Platform uses browser local storage for authentication tokens
              and user preferences (theme, temperature unit). We do not use
              third-party tracking cookies. Essential cookies are used only for
              session management via Supabase Auth.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">
              9. Changes to This Policy
            </h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify
              you of material changes via email or a notice on the Platform.
              Continued use of the Platform after changes constitutes acceptance
              of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">
              10. Contact
            </h2>
            <p>
              For privacy-related inquiries, contact us at:{' '}
              <a
                href="mailto:privacy@netneural.ai"
                className="text-cyan-400 underline hover:text-cyan-300"
              >
                privacy@netneural.ai
              </a>
            </p>
            <p className="mt-2">
              NetNeural, Inc.
              <br />
              Sentinel IoT Platform
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className="mt-12 border-t border-gray-800 pt-6 text-center text-xs text-gray-600">
          &copy; {new Date().getFullYear()} NetNeural, Inc. All rights reserved.
        </div>
      </div>
    </div>
  )
}
