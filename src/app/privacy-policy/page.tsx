import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, MapPin, Phone, Mail, Globe, ShieldCheck } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Privacy Policy — SPICA SG',
  description:
    'How SPICA SG collects, uses, and protects data in the SPICA SG field representative app.',
};

const SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'collect', label: 'Information we collect' },
  { id: 'use', label: 'How we use it' },
  { id: 'thirdparty', label: 'Third-party services' },
  { id: 'sharing', label: 'Sharing & disclosure' },
  { id: 'retention', label: 'Retention' },
  { id: 'security', label: 'Security' },
  { id: 'rights', label: 'Your rights' },
  { id: 'children', label: "Children's privacy" },
  { id: 'changes', label: 'Changes' },
  { id: 'contact', label: 'Contact' },
];

const DATA_TABLE = [
  {
    category: 'Account information',
    includes: 'Name, email address, and profile photo from Google Sign-In',
    why: 'To authenticate you and identify your account within the app',
  },
  {
    category: 'Location',
    includes: 'Precise (GPS) and approximate device location',
    why: 'To record where doctor visits and field activity occur, and support location-tagged reporting',
  },
  {
    category: 'Work activity data',
    includes:
      'Doctor/client records, visit logs, presentations viewed, and product requests created in the app',
    why: "Core function of the app — syncing your field work to your organization's records",
  },
  {
    category: 'Device & network info',
    includes: 'Network connectivity state, general device/app diagnostics',
    why: 'To support offline mode and detect sync failures',
  },
];

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-white">
      <nav
        className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-200"
        style={{
          paddingTop: 'max(env(safe-area-inset-top), var(--android-inset-top, 0px))',
          minHeight: 'calc(4.5rem + max(env(safe-area-inset-top), var(--android-inset-top, 0px)))',
        }}
      >
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-[4.5rem]">
            <Link href="/" className="flex items-center gap-3 shrink-0">
              <Image
                src="/spicasg-logo.png"
                alt="SPICASG"
                width={40}
                height={40}
                className="h-9 w-9 object-contain"
                priority
              />
              <div className="leading-tight">
                <span className="block text-lg font-bold tracking-tight text-gray-900">
                  SPICA<span className="text-primary">SG</span>
                </span>
                <span className="block text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                  SG Health Pharma
                </span>
              </div>
            </Link>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-primary transition-colors"
            >
              <ArrowLeft className="h-4 w-4" /> Back to home
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <header className="border-b border-gray-100 pb-8 mb-10">
          <span className="text-xs font-semibold uppercase tracking-widest text-primary">
            Privacy Policy
          </span>
          <h1 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight text-gray-900">
            SPICA SG App Privacy Policy
          </h1>
          <p className="mt-3 text-sm text-gray-500">
            Effective date: <strong className="text-gray-700">September 16, 2026</strong>
            {' · '}Package: <strong className="text-gray-700">com.spicasg.app</strong>
          </p>
        </header>

        <nav
          aria-label="Table of contents"
          className="rounded-xl border border-gray-100 bg-gray-50 p-5 sm:p-6 mb-12"
        >
          <span className="block text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">
            On this page
          </span>
          <ol className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-sm list-decimal list-inside">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="text-gray-700 hover:text-primary hover:underline">
                  {s.label}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="space-y-12 text-gray-700 leading-relaxed">
          <section id="overview">
            <h2 className="text-xl font-bold text-gray-900 mb-3">1. Overview</h2>
            <p className="max-w-prose">
              SPICA SG (&ldquo;the App&rdquo;) is a field application built by SG Health Pharma
              for pharmaceutical sales representatives to manage doctor visits, product
              presentations, and order requests, including while offline. This policy explains
              what data the App collects, why, and how it is handled when you use it on Android.
            </p>
          </section>

          <section id="collect">
            <h2 className="text-xl font-bold text-gray-900 mb-3">2. Information we collect</h2>
            <div className="overflow-x-auto rounded-lg border border-gray-100">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
                  <tr>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">What&apos;s included</th>
                    <th className="px-4 py-3">Why it&apos;s collected</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {DATA_TABLE.map((row) => (
                    <tr key={row.category}>
                      <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                        {row.category}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{row.includes}</td>
                      <td className="px-4 py-3 text-gray-600">{row.why}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 rounded-lg border-l-4 border-primary bg-primary/5 px-4 py-3 text-sm">
              Location access can be denied in Android system settings; sign-in and visit-logging
              will still work, but location-tagged records will not be captured.
            </p>
          </section>

          <section id="use">
            <h2 className="text-xl font-bold text-gray-900 mb-3">3. How we use it</h2>
            <ul className="list-disc list-inside space-y-2 max-w-prose">
              <li>Authenticate your account and keep you signed in across sessions</li>
              <li>Sync your visit records, requests, and presentation activity to your organization&apos;s backend</li>
              <li>Enable offline access to previously loaded doctors, PDFs, and presentation content</li>
              <li>Diagnose connectivity and sync issues</li>
            </ul>
            <p className="mt-4 max-w-prose">
              We do not use your data for advertising, and we do not sell your personal
              information.
            </p>
          </section>

          <section id="thirdparty">
            <h2 className="text-xl font-bold text-gray-900 mb-3">4. Third-party services</h2>
            <p className="max-w-prose">
              The App relies on the following infrastructure providers to operate. Each processes
              data on our behalf under their own security and privacy terms:
            </p>
            <ul className="list-disc list-inside space-y-2 max-w-prose mt-3">
              <li>
                <strong>Google Sign-In &amp; Firebase</strong> (Authentication, Cloud Functions)
                &mdash; account sign-in and backend logic
              </li>
              <li>
                <strong>Supabase</strong> &mdash; storage of visit, request, and presentation
                records
              </li>
            </ul>
            <p className="mt-4 max-w-prose">
              These providers do not receive access to your data beyond what is necessary to
              provide their service to the App.
            </p>
          </section>

          <section id="sharing">
            <h2 className="text-xl font-bold text-gray-900 mb-3">5. Sharing &amp; disclosure</h2>
            <p className="max-w-prose">
              Your work activity data (visits, requests, presentations) is visible to your
              employer/organization administrators through the App&apos;s admin tools, since the
              App is designed for organizational field-force management. We do not share your
              personal data with unrelated third parties, except where required by law or to
              protect the rights and safety of our users.
            </p>
          </section>

          <section id="retention">
            <h2 className="text-xl font-bold text-gray-900 mb-3">6. Retention</h2>
            <p className="max-w-prose">
              Account and activity data is retained for as long as your account remains active
              with your organization. Data may be deleted upon request or account deactivation,
              subject to any records your organization is required to retain.
            </p>
          </section>

          <section id="security">
            <h2 className="text-xl font-bold text-gray-900 mb-3">7. Security</h2>
            <p className="max-w-prose">
              Data in transit is encrypted (HTTPS). Access to backend systems is restricted to
              authenticated accounts. No method of electronic storage or transmission is 100%
              secure, but we take reasonable, industry-standard measures to protect your
              information.
            </p>
          </section>

          <section id="rights">
            <h2 className="text-xl font-bold text-gray-900 mb-3">8. Your rights</h2>
            <ul className="list-disc list-inside space-y-2 max-w-prose">
              <li>Request a copy of the personal data we hold about you</li>
              <li>Request correction or deletion of your data</li>
              <li>Withdraw location permission at any time via Android settings</li>
            </ul>
            <p className="mt-4 max-w-prose">
              To exercise any of these, contact us using the details below.
            </p>
          </section>

          <section id="children">
            <h2 className="text-xl font-bold text-gray-900 mb-3">9. Children&apos;s privacy</h2>
            <p className="max-w-prose">
              SPICA SG is a professional tool for employed sales representatives and is not
              directed at, or knowingly used by, children under 13. We do not knowingly collect
              data from children.
            </p>
          </section>

          <section id="changes">
            <h2 className="text-xl font-bold text-gray-900 mb-3">10. Changes to this policy</h2>
            <p className="max-w-prose">
              We may update this policy as the App evolves. Material changes will be reflected by
              updating the effective date above.
            </p>
          </section>

          <section id="contact">
            <h2 className="text-xl font-bold text-gray-900 mb-3">11. Contact</h2>
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-6 space-y-3">
              <p className="flex items-center gap-2 text-sm">
                <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
                SG Health Pharma &mdash; a unit of SPICA SG
              </p>
              <p className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-primary shrink-0" />
                <a href="mailto:sghealthpharmahosur@gmail.com" className="font-semibold hover:underline">
                  sghealthpharmahosur@gmail.com
                </a>
              </p>
              <p className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-primary shrink-0" />
                9443435603, 9443077308
              </p>
              <p className="flex items-start gap-2 text-sm">
                <MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                Shivaraj Building, Ground floor, 1st Block, 39/26, 8th Cross, Koramangala,
                Bangalore - 560034
              </p>
              <p className="flex items-center gap-2 text-sm">
                <Globe className="h-4 w-4 text-primary shrink-0" />
                www.spicasg.in
              </p>
            </div>
          </section>
        </div>

        <footer className="mt-16 pt-6 border-t border-gray-100 text-xs text-gray-400">
          SPICA SG &middot; com.spicasg.app &middot; This policy applies to the SPICA SG Android
          application.
        </footer>
      </main>
    </div>
  );
}
