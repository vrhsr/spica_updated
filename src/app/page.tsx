'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  Shield,
  ArrowRight,
  Menu,
  X,
  WifiOff,
  Truck,
  PackageSearch,
  Building2,
  FileCheck2,
  MapPin,
  Phone,
  Mail,
  Globe,
  BadgeCheck,
  Pill,
  Warehouse,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { isCapacitorApp } from '@/lib/capacitor-utils';

const MAPS_URL =
  'https://www.google.com/maps/place/OLD+ASTC+Hudco+,Water+Tank/@12.7364523,77.8169514,17z/data=!3m1!4b1!4m6!3m5!1s0x3bae7135cea42c5d:0xd623d3a5da3124ff!8m2!3d12.7364523!4d77.8195263!16s%2Fg%2F11trn6h5jw?entry=ttu';

const NAV_LINKS = [
  { href: '#about', label: 'About' },
  { href: '#services', label: 'Services' },
  { href: '#compliance', label: 'Compliance' },
  { href: '#contact', label: 'Contact' },
];

const SERVICES = [
  {
    icon: Truck,
    title: 'Pharmaceutical Wholesale',
    desc: 'Bulk stockist and wholesale supply of pharmaceutical formulations to retail pharmacies, hospitals and sub-distributors.',
  },
  {
    icon: Warehouse,
    title: 'C&F / Stockist Operations',
    desc: 'Carrying & Forwarding warehousing out of our Hosur CFA facility, built for reliable, compliant storage and dispatch.',
  },
  {
    icon: Pill,
    title: 'Nutraceutical & Food Products',
    desc: 'Licensed distribution of nutraceutical and food-category health products alongside our core pharma portfolio.',
  },
  {
    icon: PackageSearch,
    title: 'Multi-State Coverage',
    desc: 'Active drug licenses across Tamil Nadu and Karnataka, enabling supply chain reach across both states.',
  },
];

const LICENSES = [
  { label: 'GSTIN', value: '33AKKPM3362R1ZL', icon: FileCheck2 },
  { label: 'Drug License', value: 'TN-01-20B-00413', icon: BadgeCheck },
  { label: 'Drug License', value: 'TN-01-21B-00413', icon: BadgeCheck },
  { label: 'Drug License', value: 'KA-B61-278603-20B', icon: BadgeCheck },
  { label: 'Drug License', value: 'KA-B61-278604-21B', icon: BadgeCheck },
  { label: 'Food License', value: '12426011000133', icon: FileCheck2 },
];

export default function LandingPage() {
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [isCapApp, setIsCapApp] = useState(false);

  // Check if running in Capacitor
  useEffect(() => {
    setIsCapApp(isCapacitorApp());
  }, []);

  // Detect online/offline status
  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Inside the Android app, a cold start with no connection lands here
  // (this marketing page is the root route). Reps opening the app offline
  // want their downloaded presentations, not a marketing site — skip
  // straight there.
  useEffect(() => {
    if (isCapApp && !navigator.onLine) {
      router.replace('/rep/offline');
    }
  }, [isCapApp, router]);

  // Handle Login click - only intercepted when offline; otherwise the
  // plain <Link href="/login"> below handles it. /login is part of the
  // same locally-bundled offline-capable shell as this page, so a normal
  // in-app navigation is all that's needed here.
  const handleLoginClick = async (e: React.MouseEvent) => {
    if (!isOnline) {
      e.preventDefault();
      router.push('/rep/offline');
      return;
    }
  };

  const loginHref = isOnline ? '/login' : '/rep/offline';
  const loginLabel = isOnline ? 'Login' : 'Offline Presentations';

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav
        className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-200"
        style={{
          paddingTop: 'max(env(safe-area-inset-top), var(--android-inset-top, 0px))',
          minHeight: 'calc(4.5rem + max(env(safe-area-inset-top), var(--android-inset-top, 0px)))',
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-[4.5rem]">
            <Link href="/" className="flex items-center gap-3 shrink-0">
              <Image
                src="/spicasg-logo.png"
                alt="SPICASG"
                width={44}
                height={44}
                className="h-10 w-10 sm:h-11 sm:w-11 object-contain"
                priority
              />
              <div className="leading-tight">
                <span className="block text-lg sm:text-xl font-bold tracking-tight text-gray-900">
                  SPICA<span className="text-primary">SG</span>
                </span>
                <span className="block text-[10px] sm:text-xs font-semibold uppercase tracking-widest text-gray-400">
                  SG Health Pharma
                </span>
              </div>
            </Link>

            {/* Desktop nav */}
            <div className="hidden md:flex items-center gap-8">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-sm font-medium text-gray-600 hover:text-primary transition-colors"
                >
                  {link.label}
                </a>
              ))}
            </div>

            <div className="hidden md:flex items-center gap-3">
              <Link href={loginHref} onClick={handleLoginClick}>
                <Button className={!isOnline ? 'bg-orange-500 hover:bg-orange-600' : ''}>
                  {!isOnline && <WifiOff className="mr-2 h-4 w-4" />}
                  {loginLabel}
                  {isOnline && <ArrowRight className="ml-2 h-4 w-4" />}
                </Button>
              </Link>
            </div>

            {/* Mobile menu button */}
            <button
              className="md:hidden p-2 text-gray-500 hover:text-gray-700"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="md:hidden py-4 border-t border-gray-100 bg-white">
              <div className="flex flex-col gap-1 px-1">
                {NAV_LINKS.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="px-3 py-2.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    {link.label}
                  </a>
                ))}
                <Link
                  href={loginHref}
                  onClick={(e) => {
                    setMobileMenuOpen(false);
                    handleLoginClick(e);
                  }}
                  className="mt-2"
                >
                  <Button
                    className={`w-full justify-center ${!isOnline ? 'bg-orange-500 hover:bg-orange-600' : ''}`}
                  >
                    {!isOnline && <WifiOff className="mr-2 h-4 w-4" />}
                    {loginLabel}
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Hero */}
      <section
        className="relative overflow-hidden"
        style={{ background: 'var(--brand-gradient)' }}
      >
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-orange-300/20 blur-3xl" />
          <div className="absolute -bottom-32 -left-24 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-20 sm:pt-24 sm:pb-28">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/70 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-primary shadow-sm ring-1 ring-primary/10">
                <BadgeCheck className="h-3.5 w-3.5" />
                Licensed Drug Wholesaler &amp; Distributor
              </span>
              <h1 className="mt-6 text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-gray-900">
                Trusted Pharma Distribution,
                <span className="block text-primary">Built for Scale.</span>
              </h1>
              <p className="mt-6 text-base sm:text-lg text-gray-600 max-w-xl">
                SPICASG is a fully licensed pharmaceutical wholesale and
                distribution house operating as{' '}
                <span className="font-semibold text-gray-800">SG Health Pharma</span>,
                supplying pharmacies, hospitals and sub-distributors across
                Tamil Nadu and Karnataka with reliable stock, compliant
                handling, and dependable turnaround.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <Link href={loginHref} onClick={handleLoginClick}>
                  <Button
                    size="lg"
                    className={`w-full sm:w-auto text-base px-8 ${!isOnline ? 'bg-orange-500 hover:bg-orange-600' : ''}`}
                  >
                    {!isOnline && <WifiOff className="mr-2 h-5 w-5" />}
                    {loginLabel}
                    {isOnline && <ArrowRight className="ml-2 h-5 w-5" />}
                  </Button>
                </Link>
                <a href="#contact">
                  <Button size="lg" variant="outline" className="w-full sm:w-auto text-base px-8 bg-white/70">
                    Contact Us
                  </Button>
                </a>
              </div>
            </div>

            <div className="relative flex justify-center lg:justify-end">
              <div className="relative h-64 w-64 sm:h-80 sm:w-80 rounded-3xl bg-white shadow-2xl ring-1 ring-black/5 flex items-center justify-center">
                <Image
                  src="/spicasg-logo.png"
                  alt="SPICASG logo"
                  width={220}
                  height={220}
                  className="h-40 w-40 sm:h-48 sm:w-48 object-contain"
                  priority
                />
              </div>
            </div>
          </div>
        </div>

        {/* Trust strip */}
        <div className="relative border-t border-white/40 bg-white/60 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-wrap items-center justify-center gap-x-10 gap-y-3 text-xs sm:text-sm font-semibold text-gray-600">
            <span className="flex items-center gap-2">
              <FileCheck2 className="h-4 w-4 text-primary" /> GST Registered
            </span>
            <span className="flex items-center gap-2">
              <BadgeCheck className="h-4 w-4 text-primary" /> TN &amp; KA Drug Licensed
            </span>
            <span className="flex items-center gap-2">
              <FileCheck2 className="h-4 w-4 text-primary" /> FSSAI Food License
            </span>
            <span className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" /> A Unit of SPICA SG
            </span>
          </div>
        </div>
      </section>

      {/* About */}
      <section id="about" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-primary">About Us</span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight">
              A licensed pharma distribution house you can build your supply chain on
            </h2>
            <p className="mt-5 text-gray-600 leading-relaxed">
              Operating as <span className="font-semibold text-gray-800">SG Health Pharma</span>,
              a unit of SPICA SG, we run pharmaceutical wholesale and Carrying &amp; Forwarding
              (C&amp;F) operations from our registered office in Koramangala, Bangalore and our
              CFA warehouse in Hosur. Every consignment moves under active Drug Control and GST
              registration, so retailers, hospitals and sub-stockists get stock they can trust.
            </p>
            <ul className="mt-6 space-y-3">
              {[
                'Bulk stockist for pharmaceutical formulations',
                'Carrying & Forwarding (C&F) warehousing at Hosur',
                'Nutraceutical & food-category product distribution',
                'Coverage across Tamil Nadu and Karnataka',
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm sm:text-base text-gray-700">
                  <BadgeCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl bg-gray-50 border border-gray-100 p-8 sm:p-10">
            <div className="grid grid-cols-2 gap-6">
              {[
                { icon: Building2, label: 'Registered Office', value: 'Bangalore, KA' },
                { icon: Warehouse, label: 'CFA Warehouse', value: 'Hosur, TN' },
                { icon: BadgeCheck, label: 'Drug Licenses', value: '4 Active' },
                { icon: FileCheck2, label: 'Food License', value: 'FSSAI Certified' },
              ].map((stat) => (
                <div key={stat.label} className="flex flex-col gap-2">
                  <stat.icon className="h-7 w-7 text-primary" />
                  <span className="text-lg font-bold text-gray-900">{stat.value}</span>
                  <span className="text-xs font-medium text-gray-500">{stat.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Services */}
      <section id="services" className="bg-gray-50 border-y border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center max-w-2xl mx-auto">
            <span className="text-xs font-bold uppercase tracking-widest text-primary">What We Do</span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight">
              End-to-end pharmaceutical distribution
            </h2>
          </div>
          <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {SERVICES.map((service) => (
              <Card
                key={service.title}
                className="border-gray-100 shadow-sm hover:shadow-lg hover:border-primary/30 transition-all"
              >
                <CardHeader>
                  <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-2">
                    <service.icon className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-lg">{service.title}</CardTitle>
                  <CardDescription className="text-sm leading-relaxed">
                    {service.desc}
                  </CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Compliance / Licenses */}
      <section id="compliance" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center max-w-2xl mx-auto">
          <span className="text-xs font-bold uppercase tracking-widest text-primary">Compliance</span>
          <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight">
            Fully licensed. Fully verifiable.
          </h2>
          <p className="mt-4 text-gray-600">
            Every shipment we handle is backed by active statutory registration.
          </p>
        </div>
        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {LICENSES.map((lic) => (
            <div
              key={lic.value}
              className="flex items-center gap-4 rounded-xl border border-gray-100 bg-white shadow-sm p-5 hover:shadow-md transition-shadow"
            >
              <div className="h-11 w-11 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <lic.icon className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  {lic.label}
                </p>
                <p className="text-sm font-bold text-gray-900 truncate">{lic.value}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Contact / Locations */}
      <section id="contact" className="bg-gray-50 border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center max-w-2xl mx-auto">
            <span className="text-xs font-bold uppercase tracking-widest text-primary">Get in Touch</span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight">
              Visit us or reach out directly
            </h2>
          </div>

          <div className="mt-12 grid md:grid-cols-2 gap-6">
            <Card className="border-gray-100 shadow-sm">
              <CardHeader>
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-2">
                  <Building2 className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-lg">Registered Office</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-gray-600 leading-relaxed">
                Shivaraj Building, Ground Floor, 1st Block, 39/26, 8th Cross,
                Koramangala, Bangalore - 560034
              </CardContent>
            </Card>

            <Card className="border-gray-100 shadow-sm">
              <CardHeader>
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-2">
                  <Warehouse className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-lg">CFA Office &amp; Warehouse</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-gray-600 leading-relaxed">
                M-473/B, Room No: 2, 1st Floor, Old ASTC HUDCO, Opp New Water
                Tank, Hosur - 635109
                <a
                  href={MAPS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1.5 text-primary font-semibold hover:underline"
                >
                  <MapPin className="h-4 w-4" /> Get Directions
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </CardContent>
            </Card>
          </div>

          <div className="mt-6 grid sm:grid-cols-2 gap-6">
            <a
              href="tel:9443435603"
              className="flex items-center gap-4 rounded-xl border border-gray-100 bg-white shadow-sm p-5 hover:shadow-md transition-shadow"
            >
              <div className="h-11 w-11 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Phone className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Call Us</p>
                <p className="text-sm font-bold text-gray-900">9443435603, 9443077308</p>
              </div>
            </a>
            <a
              href="mailto:sghealthpharmahosur@gmail.com"
              className="flex items-center gap-4 rounded-xl border border-gray-100 bg-white shadow-sm p-5 hover:shadow-md transition-shadow"
            >
              <div className="h-11 w-11 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Mail className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Email Us</p>
                <p className="text-sm font-bold text-gray-900 truncate">sghealthpharmahosur@gmail.com</p>
              </div>
            </a>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative overflow-hidden" style={{ background: 'var(--brand-gradient)' }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
            Partners and field teams sign in here
          </h2>
          <p className="mt-3 text-gray-600">
            Access the SPICASG portal to manage doctors, presentations and requests.
          </p>
          <Link href={loginHref} onClick={handleLoginClick} className="inline-block mt-6">
            <Button size="lg" className={`text-base px-10 ${!isOnline ? 'bg-orange-500 hover:bg-orange-600' : ''}`}>
              {!isOnline && <WifiOff className="mr-2 h-5 w-5" />}
              {loginLabel}
              {isOnline && <ArrowRight className="ml-2 h-5 w-5" />}
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full bg-gray-900 text-gray-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10">
            <div>
              <div className="flex items-center gap-3">
                <Image
                  src="/spicasg-logo.png"
                  alt="SPICASG"
                  width={40}
                  height={40}
                  className="h-9 w-9 object-contain rounded bg-white p-0.5"
                />
                <span className="text-lg font-bold text-white">
                  SPICA<span className="text-orange-400">SG</span>
                </span>
              </div>
              <p className="mt-4 text-sm text-gray-400 leading-relaxed">
                SG Health Pharma — a unit of SPICA SG. Licensed pharmaceutical
                wholesale distribution &amp; C&amp;F operations.
              </p>
            </div>

            <div>
              <h4 className="text-sm font-bold uppercase tracking-widest text-white">Registered Office</h4>
              <p className="mt-4 text-sm text-gray-400 leading-relaxed flex gap-2">
                <MapPin className="h-4 w-4 shrink-0 mt-0.5 text-orange-400" />
                Shivaraj Building, Ground floor, 1st Block, 39/26, 8th Cross,
                Koramangala, Bangalore - 560034
              </p>
            </div>

            <div>
              <h4 className="text-sm font-bold uppercase tracking-widest text-white">CFA Office</h4>
              <p className="mt-4 text-sm text-gray-400 leading-relaxed flex gap-2">
                <MapPin className="h-4 w-4 shrink-0 mt-0.5 text-orange-400" />
                (M-473/B, Room No:2, 1st Floor), Old ASTC HUDCO, Opp New Water
                Tank, Hosur - 635109
              </p>
              <a
                href={MAPS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-orange-400 hover:text-orange-300"
              >
                View on Google Maps <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>

            <div>
              <h4 className="text-sm font-bold uppercase tracking-widest text-white">Contact</h4>
              <ul className="mt-4 space-y-3 text-sm text-gray-400">
                <li className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-orange-400 shrink-0" />
                  9443435603, 9443077308
                </li>
                <li className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-orange-400 shrink-0" />
                  sghealthpharmahosur@gmail.com
                </li>
                <li className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-orange-400 shrink-0" />
                  www.spicasg.in
                </li>
                <li>
                  <Link
                    href={loginHref}
                    onClick={handleLoginClick}
                    className="inline-flex items-center gap-1.5 mt-1 font-semibold text-white hover:text-orange-300"
                  >
                    <Shield className="h-4 w-4" /> {loginLabel}
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-12 pt-6 border-t border-white/10 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-gray-500">
            <span>© {new Date().getFullYear()} SG Health Pharma. All rights reserved.</span>
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
              <span>GSTIN: 33AKKPM3362R1ZL</span>
              <span>Food Lic: 12426011000133</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
