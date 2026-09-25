import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-gradient p-6">
      <div className="w-full max-w-sm rounded-2xl bg-card p-8 text-center shadow-xl">
        <img src="/icon-192.png" alt="" className="mx-auto h-14 w-14 object-contain" />
        <p className="mt-5 font-headline text-5xl font-bold text-brand-gradient">404</p>
        <h1 className="mt-2 font-headline text-xl font-bold">Page not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist or has moved.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
        >
          Go to home
        </Link>
      </div>
    </div>
  );
}
