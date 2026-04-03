
'use client';

import React, { useMemo, useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader, PlusCircle, FileQuestion, RefreshCw, Eye } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, where, Timestamp, addDoc, doc } from 'firebase/firestore';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHeader, TableRow, TableHead } from '@/components/ui/table';
import { format, formatDistanceToNow } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { EditSlidesForm } from '@/components/EditSlidesForm';
import { SlidePreviewDialog } from '@/components/SlidePreviewDialog';

type Doctor = { id: string; name: string; city: string; selectedSlides: number[] };
type UserProfile = { city: string; district?: string };
type Request = {
  doctorId?: string;
  doctorName?: string;
  doctorCity?: string;
  doctorDistrict?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Timestamp;
  selectedSlides: number[];
  requestType?: 'new_doctor' | 'slide_change';
};

function ProposeChangesDialog({ repId, repCity, repDistrict, doctors, onSubmitted, autoOpen = false }: {
  repId: string;
  repCity: string;
  repDistrict?: string;
  doctors: Doctor[];
  onSubmitted: () => void;
  autoOpen?: boolean;
}) {
  const [step, setStep] = useState<'type' | 'details' | 'slides'>('type');
  const [requestType, setRequestType] = useState<'new_doctor' | 'slide_change'>('new_doctor');
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [doctorCity, setDoctorCity] = useState(''); // will be set to first city once options load
  const [isAddingNewCity, setIsAddingNewCity] = useState(false);
  const [newCityName, setNewCityName] = useState('');
  const [proposedDoctor, setProposedDoctor] = useState<Partial<Doctor> | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();
  const firestore = useFirestore();

  // Fetch cities in the rep's district for the dropdown
  // Note: repCity IS the district name (e.g., KRISHNAGIRI)
  const citiesQuery = useMemoFirebase(() => {
    if (!firestore || !repCity) return null;
    return query(collection(firestore, 'districts_cities'), where('districtName', '==', repCity));
  }, [firestore, repCity]);
  const { data: districtCities } = useCollection<{ name: string; districtName: string }>(citiesQuery);
  const cityOptions = useMemo(() => districtCities?.map(c => c.name).sort() ?? [], [districtCities]);

  // Auto-select first city once options are loaded
  useEffect(() => {
    if (cityOptions.length > 0 && !doctorCity) {
      setDoctorCity(cityOptions[0]);
    }
  }, [cityOptions, doctorCity]);

  const handleTypeSelect = (type: 'new_doctor' | 'slide_change') => {
    setRequestType(type);
    setStep('details');
  };

  const handleNext = () => {
    if (requestType === 'new_doctor' && doctorName.trim()) {
      const finalName = doctorName.trim().startsWith('Dr.') ? doctorName.trim() : `Dr. ${doctorName.trim()}`;
      const finalCity = doctorCity.trim().toUpperCase() || repCity;
      setProposedDoctor({ name: finalName, city: finalCity });
      setStep('slides');
    } else if (requestType === 'slide_change' && selectedDoctorId) {
      const doctor = doctors.find(d => d.id === selectedDoctorId);
      if (doctor) {
        setProposedDoctor(doctor);
        setStep('slides');
      }
    }
  };

  const handleSlideSave = async (slides: number[]) => {
    if (!firestore || !proposedDoctor) return;

    setIsSubmitting(true);
    const requestsCollection = collection(firestore, 'requests');

    const newRequest = requestType === 'new_doctor'
      ? {
        repId,
        doctorName: proposedDoctor.name,
        doctorCity: proposedDoctor.city,
        doctorDistrict: repDistrict || '',
        selectedSlides: slides,
        status: 'pending' as const,
        requestType: 'new_doctor' as const,
        createdAt: Timestamp.now()
      }
      : {
        repId,
        doctorId: selectedDoctorId,
        selectedSlides: slides,
        status: 'pending' as const,
        requestType: 'slide_change' as const,
        createdAt: Timestamp.now()
      };

    try {
      await addDoc(requestsCollection, newRequest).catch(err => {
        const contextualError = new FirestorePermissionError({
          operation: 'create',
          path: requestsCollection.path,
          requestResourceData: newRequest
        });
        errorEmitter.emit('permission-error', contextualError);
        throw err;
      });

      toast({
        title: "Request Submitted",
        description: requestType === 'new_doctor'
          ? "Your proposal to add a new doctor has been sent for admin review."
          : "Your slide change request has been sent for admin review.",
      });
      onSubmitted();
      handleClose();

    } catch (err) {
      console.error("Error submitting request:", err);
      toast({
        variant: "destructive",
        title: "Submission Failed",
        description: "Could not submit your request. Check console for details.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setTimeout(() => {
      setStep('type');
      setRequestType('new_doctor');
      setSelectedDoctorId('');
      setDoctorName('');
      setDoctorCity(repCity);
      setIsAddingNewCity(false);
      setNewCityName('');
      setProposedDoctor(null);
      setIsSubmitting(false);
    }, 200);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      handleClose();
    } else {
      setIsOpen(true);
    }
  };

  useEffect(() => {
    if (autoOpen) {
      setIsOpen(true);
    }
  }, [autoOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="w-full sm:w-auto shadow-md">
          <PlusCircle className="mr-2 h-4 w-4" /> Start a New Proposal
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        {step === 'type' ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl">What would you like to do?</DialogTitle>
              <DialogDescription>
                Choose the type of change you want to propose
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4 sm:grid-cols-2">
              <Button
                variant="outline"
                className="h-auto py-8 flex-col items-center text-center gap-3 border-2 hover:border-primary/50 hover:bg-primary/5 transition-all"
                onClick={() => handleTypeSelect('new_doctor')}
              >
                <div className="h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center">
                  <PlusCircle className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <div className="font-bold text-base">Add New Doctor</div>
                  <div className="text-xs text-muted-foreground mt-1 px-2">Propose a new doctor for your district</div>
                </div>
              </Button>
              <Button
                variant="outline"
                className="h-auto py-8 flex-col items-center text-center gap-3 border-2 hover:border-primary/50 hover:bg-primary/5 transition-all"
                onClick={() => handleTypeSelect('slide_change')}
              >
                <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <RefreshCw className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <div className="font-bold text-base">Update Slides</div>
                  <div className="text-xs text-muted-foreground mt-1 px-2">Request slide changes for a current doctor</div>
                </div>
              </Button>
            </div>
          </>
        ) : step === 'details' ? (
          <>
            <DialogHeader>
              <DialogTitle>
                {requestType === 'new_doctor' ? 'Propose a New Doctor' : 'Select Doctor'}
              </DialogTitle>
              <DialogDescription>
                {requestType === 'new_doctor'
                  ? `Enter the name of the new doctor you want to add. They will be assigned to your district, ${repCity}.`
                  : 'Choose the doctor whose slides you want to update'
                }
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {requestType === 'new_doctor' ? (
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="doctor-name">Doctor Name</Label>
                    <Input
                      id="doctor-name"
                      placeholder="e.g., Jane Smith"
                      value={doctorName}
                      onChange={(e) => setDoctorName(e.target.value)}
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <Label htmlFor="doctor-city">City</Label>
                      {!isAddingNewCity && (
                        <button
                          type="button"
                          onClick={() => { setIsAddingNewCity(true); setDoctorCity(''); }}
                          className="text-xs text-primary hover:underline flex items-center gap-1"
                        >
                          <PlusCircle className="h-3 w-3" /> Add New City
                        </button>
                      )}
                    </div>
                    {isAddingNewCity ? (
                      <div className="flex gap-2">
                        <Input
                          id="doctor-city-new"
                          placeholder="Type new city name..."
                          value={newCityName}
                          onChange={(e) => setNewCityName(e.target.value)}
                          autoFocus
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="whitespace-nowrap"
                          onClick={() => {
                            if (newCityName.trim()) {
                              setDoctorCity(newCityName.trim().toUpperCase());
                            }
                            setIsAddingNewCity(false);
                            setNewCityName('');
                          }}
                        >
                          Confirm
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => { setIsAddingNewCity(false); setNewCityName(''); setDoctorCity(repCity); }}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <Select value={doctorCity} onValueChange={setDoctorCity}>
                        <SelectTrigger id="doctor-city" className="w-full bg-background border-input">
                          <SelectValue placeholder="Select a city..." />
                        </SelectTrigger>
                        <SelectContent>
                          {cityOptions.length === 0 && !doctorCity && (
                            <SelectItem value={repCity}>{repCity}</SelectItem>
                          )}
                          {cityOptions.map(city => (
                            <SelectItem key={city} value={city}>{city}</SelectItem>
                          ))}
                          {doctorCity && !cityOptions.includes(doctorCity) && (
                            <SelectItem value={doctorCity}>{doctorCity} (New)</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    )}
                    {doctorCity && doctorCity !== repCity && (
                      <p className="text-xs text-amber-600 mt-1">⚠ This is a different city from your assigned city ({repCity}). If it's new, it will be created upon admin approval.</p>
                    )}
                  </div>
                </div>
              ) : (
                <div>
                  <Label htmlFor="doctor-select">Select Doctor</Label>
                  <Select value={selectedDoctorId} onValueChange={setSelectedDoctorId}>
                    <SelectTrigger id="doctor-select" className="w-full mt-1 bg-background border-input">
                      <SelectValue placeholder="Select a doctor..." />
                    </SelectTrigger>
                    <SelectContent>
                      {doctors.map((doctor) => (
                        <SelectItem key={doctor.id} value={doctor.id}>
                          {doctor.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep('type')}>Back</Button>
              <Button
                onClick={handleNext}
                disabled={requestType === 'new_doctor' ? !doctorName.trim() : !selectedDoctorId}
              >
                Next: Select Slides
              </Button>
            </DialogFooter>
          </>
        ) : proposedDoctor ? (
          <EditSlidesForm
            doctor={proposedDoctor}
            onSave={handleSlideSave}
            isSaving={isSubmitting}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export default function RepRequestsPage() {
  const { user, isUserLoading: isAuthLoading } = useUser();
  const firestore = useFirestore();
  const searchParams = useSearchParams();
  const [showDialog, setShowDialog] = useState(false);
  const [previewRequest, setPreviewRequest] = useState<Request | null>(null);

  // Auto-open dialog if ?action=propose
  React.useEffect(() => {
    if (searchParams.get('action') === 'propose') {
      setShowDialog(true);
    }
  }, [searchParams]);

  const userProfileRef = useMemoFirebase(
    () => (user?.uid ? doc(firestore!, 'users', user.uid) : null),
    [firestore, user?.uid]
  );
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userProfileRef);

  const requestsQuery = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return query(collection(firestore, 'requests'), where('repId', '==', user.uid));
  }, [firestore, user?.uid]);

  const doctorsQuery = useMemoFirebase(() => {
    if (!firestore || !userProfile?.city) return null;
    return query(collection(firestore, 'doctors'), where('city', '==', userProfile.city));
  }, [firestore, userProfile?.city]);

  const { data: requests, isLoading: isLoadingRequests, forceRefetch } = useCollection<Request>(requestsQuery);
  const { data: doctors, isLoading: isLoadingDoctors } = useCollection<Doctor>(doctorsQuery);

  // repCity here is the district name (e.g. KRISHNAGIRI) stored in user profile
  // Use it directly as the district for querying sub-cities
  const repDistrict = userProfile?.city; // repCity === districtName

  const isLoading = isAuthLoading || isProfileLoading || isLoadingRequests || isLoadingDoctors;

  const sortedRequests = useMemo(() => {
    return requests?.sort((a, b) => b.createdAt.toDate().getTime() - a.createdAt.toDate().getTime()) || [];
  }, [requests]);

  // Create a map of doctorId to doctor name for slide change requests
  const doctorMap = useMemo(() => {
    return new Map(doctors?.map(d => [d.id, d.name]) || []);
  }, [doctors]);

  const getStatusBadge = (status: Request['status']) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      case 'approved':
        return <Badge className="bg-green-100 text-green-800">Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>;
    }
  };

  // Get display name for request
  const getRequestDoctorName = (req: Request) => {
    if (req.doctorName) {
      // New doctor proposal
      return req.doctorName;
    } else if (req.doctorId) {
      // Slide change request - lookup doctor name
      return doctorMap.get(req.doctorId) || 'Unknown Doctor';
    }
    return 'N/A';
  };

  const getRequestDoctorCity = (req: Request) => {
    if (req.doctorCity) {
      return req.doctorCity;
    } else if (req.doctorId) {
      const doc = doctors?.find(d => d.id === req.doctorId);
      return doc?.city || 'Unknown';
    }
    return 'N/A';
  };


  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="font-headline text-3xl font-bold tracking-tight">
          Pending Requests
        </h1>
        {userProfile?.city && user && doctors && (
          <ProposeChangesDialog
            repId={user.uid}
            repCity={userProfile.city}
            repDistrict={repDistrict || userProfile.city}
            doctors={doctors}
            onSubmitted={forceRefetch}
            autoOpen={showDialog}
          />
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Proposal History</CardTitle>
          <CardDescription>Track the status of all proposals you have submitted.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex h-64 items-center justify-center">
              <Loader className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-4 text-muted-foreground">Loading proposals...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Table view for desktop */}
              <div className="hidden lg:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Doctor Name</TableHead>
                      <TableHead>City</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-14">View</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedRequests.length > 0 ? sortedRequests.map(req => (
                      <TableRow key={req.id}>
                        <TableCell className="font-medium">{getRequestDoctorName(req)}</TableCell>
                        <TableCell>{getRequestDoctorCity(req)}</TableCell>
                        <TableCell>
                          {req.requestType === 'slide_change' ? (
                            <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                              Slide Update
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                              New Doctor
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <span title={format(req.createdAt.toDate(), 'PPP p')}>
                            {formatDistanceToNow(req.createdAt.toDate(), { addSuffix: true })}
                          </span>
                        </TableCell>
                        <TableCell>{getStatusBadge(req.status)}</TableCell>
                        <TableCell>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setPreviewRequest(req)}
                            title="View Proposed Slides"
                            className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )) : (
                      <TableRow>
                        <TableCell colSpan={7} className="h-48 text-center" />
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Card view for mobile and tablet */}
              <div className="lg:hidden grid grid-cols-1 md:grid-cols-2 gap-4">
                {sortedRequests.length > 0 ? sortedRequests.map(req => (
                  <Card key={req.id} className="flex flex-col h-full rounded-lg border p-4 transition-all duration-200 hover:border-accent hover:bg-accent/5 hover:shadow-md">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-bold text-lg">{getRequestDoctorName(req)}</h3>
                        <p className="text-sm text-muted-foreground font-medium">{getRequestDoctorCity(req)}</p>
                        <p className="text-xs text-muted-foreground mt-1 flex items-center">
                          {formatDistanceToNow(req.createdAt.toDate(), { addSuffix: true })}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        {getStatusBadge(req.status)}
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setPreviewRequest(req)}
                          title="View Proposed Slides"
                          className="h-10 w-10 mt-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50 border border-transparent shadow-sm hover:border-blue-200 bg-white"
                        >
                          <Eye className="h-5 w-5" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex gap-2 mb-4">
                      {req.requestType === 'slide_change' ? (
                        <Badge variant="secondary" className="bg-blue-100 text-blue-800 text-xs py-1">
                          Slide Update
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-purple-100 text-purple-800 text-xs py-1">
                          New Doctor
                        </Badge>
                      )}
                    </div>
                  </Card>
                )) : null}
              </div>

              {sortedRequests.length === 0 && (
                <div className="py-24 text-center text-muted-foreground">
                  <div className="flex flex-col items-center justify-center">
                    <FileQuestion className="h-12 w-12 text-muted-foreground/50" />
                    <h3 className="mt-4 text-lg font-semibold">No Proposals Found</h3>
                    <p className="mt-1 text-sm">
                      Click "Start a New Proposal" to submit your first proposal.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      
      <SlidePreviewDialog
        open={!!previewRequest}
        onOpenChange={(open) => !open && setPreviewRequest(null)}
        slideNumbers={previewRequest?.selectedSlides || []}
        doctorName={previewRequest ? getRequestDoctorName(previewRequest) : ''}
      />
    </div>
  );
}
