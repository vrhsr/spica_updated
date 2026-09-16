import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Mail, Clock, Trash2, ShieldCheck } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Delete Account — SPICA SG',
  description: 'How to request deletion of your SPICA SG account and associated data.',
};

const RETAINED = [
  {
    kept: 'Deleted',
    items: 'Your account profile (name, email, photo), saved doctor/client records you created, visit logs, presentation activity, and product requests tied to your account.',
  },
  {
    kept: 'Retained',
    items: 'Records your employer/organization is legally required to keep for compliance (e.g. completed order/audit trails), retained under your organization\'s data policy even after your personal account is removed.',
  },
];

export default function DeleteAccountPage() {
  return (
    <div className="min-h-screen bg-white">
      <nav
        className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-200"
        style={{
          paddingTop: 'env(safe-area-inset-top)',
          minHeight: 'calc(4.5rem + env(safe-area-inset-top))',
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
            Account &amp; Data Deletion
          </span>
          <h1 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight text-gray-900">
            Delete your SPICA SG account
          </h1>
          <p className="mt-3 max-w-prose text-gray-600">
            This page explains how to request deletion of your SPICA SG account and the data
            associated with it. SPICA SG is developed and operated by SG Health Pharma.
          </p>
        </header>

        <div className="space-y-12 text-gray-700 leading-relaxed">
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">How to request deletion</h2>
            <ol className="space-y-4">
              <li className="flex gap-4 rounded-xl border border-gray-100 bg-gray-50 p-5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                  1
                </span>
                <p>
                  Send an email to{' '}
                  <a
                    href="mailto:sghealthpharmahosur@gmail.com?subject=Delete%20My%20SPICA%20SG%20Account"
                    className="font-semibold text-primary hover:underline"
                  >
                    sghealthpharmahosur@gmail.com
                  </a>{' '}
                  from the email address registered on your SPICA SG account, with the subject{' '}
                  <strong>&ldquo;Delete My Account&rdquo;</strong>.
                </p>
              </li>
              <li className="flex gap-4 rounded-xl border border-gray-100 bg-gray-50 p-5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                  2
                </span>
                <p>
                  Include your full name and the phone number or email tied to your account so we
                  can verify the request.
                </p>
              </li>
              <li className="flex gap-4 rounded-xl border border-gray-100 bg-gray-50 p-5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                  3
                </span>
                <p>
                  We&apos;ll confirm the request and process deletion within{' '}
                  <strong>7 business days</strong>. You&apos;ll receive an email once it&apos;s
                  complete.
                </p>
              </li>
            </ol>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">What gets deleted vs. retained</h2>
            <div className="overflow-x-auto rounded-lg border border-gray-100">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-gray-100">
                  {RETAINED.map((row) => (
                    <tr key={row.kept}>
                      <td className="px-4 py-4 font-semibold text-gray-900 whitespace-nowrap align-top w-32">
                        <span className="inline-flex items-center gap-1.5">
                          {row.kept === 'Deleted' ? (
                            <Trash2 className="h-4 w-4 text-primary" />
                          ) : (
                            <ShieldCheck className="h-4 w-4 text-gray-400" />
                          )}
                          {row.kept}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-gray-600">{row.items}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 flex items-start gap-2 rounded-lg border-l-4 border-primary bg-primary/5 px-4 py-3 text-sm">
              <Clock className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              Retained organizational records are kept only as long as required for your
              employer&apos;s compliance obligations, separate from your personal account.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Partial data deletion</h2>
            <p className="max-w-prose">
              You don&apos;t have to delete your entire account to remove specific data &mdash;
              use the same email address above to request deletion of particular records (for
              example, a specific visit log) while keeping your account active.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Contact</h2>
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-6 space-y-3">
              <p className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-primary shrink-0" />
                <a
                  href="mailto:sghealthpharmahosur@gmail.com"
                  className="font-semibold hover:underline"
                >
                  sghealthpharmahosur@gmail.com
                </a>
              </p>
              <p className="text-sm text-gray-500">
                See our{' '}
                <Link href="/privacy-policy" className="text-primary hover:underline">
                  Privacy Policy
                </Link>{' '}
                for more on how your data is handled.
              </p>
            </div>
          </section>
        </div>

        <footer className="mt-16 pt-6 border-t border-gray-100 text-xs text-gray-400">
          SPICA SG &middot; com.spicasg.app &middot; Operated by SG Health Pharma.
        </footer>
      </main>
    </div>
  );
}
