'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Monitor, Download } from 'lucide-react';
import Link from 'next/link';
import { OfflineBadge } from '@/components/OfflineBadge';
import { Badge } from '@/components/ui/badge';

interface Doctor {
    id: string;
    name: string;
}

interface Presentation {
    id: string;
    doctorId: string;
    pdfUrl?: string;
    dirty: boolean;
    error?: string;
}

interface QuickDoctorAccessProps {
    doctors: Doctor[];
    presentations: Presentation[];
    maxDisplay?: number;
}

export function QuickDoctorAccess({ doctors, presentations, maxDisplay = 6 }: QuickDoctorAccessProps) {
    // Create a map of doctorId to presentation
    const presentationMap = new Map(presentations?.map(p => [p.doctorId, p]) || []);

    // Filter doctors that have presentations and are ready
    const doctorsWithPresentations = doctors
        ?.filter(doctor => {
            const presentation = presentationMap.get(doctor.id);
            return presentation?.pdfUrl && !presentation.dirty && !presentation.error;
        })
        .slice(0, maxDisplay) || [];

    if (doctorsWithPresentations.length === 0) {
        return null;
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Quick Access</CardTitle>
                <CardDescription>Present to your top doctors</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-2">
                    {doctorsWithPresentations.map((doctor) => {
                        const presentation = presentationMap.get(doctor.id);
                        return (
                            <div
                                key={doctor.id}
                                className="flex items-center justify-between rounded-lg border p-3 hover:bg-accent/50 transition-colors"
                            >
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <span className="font-medium truncate">{doctor.name}</span>
                                    <OfflineBadge doctorId={doctor.id} />
                                    {presentation?.pdfUrl && (
                                        <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs">
                                            Ready
                                        </Badge>
                                    )}
                                </div>
                                <Button asChild size="sm" variant="default">
                                    <Link href={`/rep/present/${doctor.id}`}>
                                        <Monitor className="mr-2 h-4 w-4" />
                                        Present
                                    </Link>
                                </Button>
                            </div>
                        );
                    })}
                </div>
                <Button asChild variant="outline" className="w-full mt-4">
                    <Link href="/rep/doctors">
                        View All Doctors
                    </Link>
                </Button>
            </CardContent>
        </Card>
    );
}
