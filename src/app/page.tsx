
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Stethoscope, User, Shield } from 'lucide-react';

export default function LandingPage() {
  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-gradient-to-br from-blue-100 via-purple-100 to-blue-200 p-4">
      <div className="flex w-full max-w-4xl flex-col items-center justify-center gap-8 md:flex-row">
        
        {/* Left Side - Title and Description */}
        <div className="w-full max-w-md text-center md:text-left">
          <div className="mb-4 inline-flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Stethoscope className="h-7 w-7" />
              </div>
              <h1 className="font-headline text-4xl font-bold text-foreground md:text-5xl">
                SPICASG Portal
              </h1>
          </div>
          <p className="mt-2 text-lg text-muted-foreground">
            Your centralized hub for automated presentation generation and management for medical representatives.
          </p>
        </div>

        {/* Right Side - Login Cards */}
        <div className="flex w-full max-w-md flex-col gap-4">
           <Link href="/admin-login" className="group block">
            <Card className="transform-gpu transition-all duration-300 ease-in-out group-hover:-translate-y-1 group-hover:scale-[1.02] group-hover:shadow-2xl">
              <CardHeader className="flex flex-row items-center gap-4">
                <Shield className="h-8 w-8 text-primary" />
                <div>
                  <CardTitle className="font-headline text-2xl">Admin Login</CardTitle>
                  <CardDescription>Access the management dashboard.</CardDescription>
                </div>
              </CardHeader>
            </Card>
          </Link>

          <Link href="/rep-login" className="group block">
            <Card className="transform-gpu transition-all duration-300 ease-in-out group-hover:-translate-y-1 group-hover:scale-[1.02] group-hover:shadow-2xl">
              <CardHeader className="flex flex-row items-center gap-4">
                <User className="h-8 w-8 text-accent" />
                <div>
                  <CardTitle className="font-headline text-2xl">Rep Login</CardTitle>
                  <CardDescription>View presentations and propose changes.</CardDescription>
                </div>
              </CardHeader>
            </Card>
          </Link>
        </div>
      </div>
    </main>
  );
}
