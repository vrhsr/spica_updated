
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
import {
  Loader,
  PlusCircle,
  FileQuestion,
  RefreshCw,
  Eye,
  UserPlus,
  SlidersHorizontal,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  MapPin,
  ChevronRight,
  Stethoscope,
  Search,
} from 'lucide-react';
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
import { cn } from '@/lib/utils';

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

// ─── Step Indicator ──────────────────────────────────────────────────────────
function StepIndicator({ step }: { step: 'type' | 'details' | 'slides' }) {
  const steps = [
    { id: 'type', label: 'Type' },
    { id: 'details', label: 'Details' },
    { id: 'slides', label: 'Slides' },
  ];
  const currentIndex = steps.findIndex(s => s.id === step);

  return (
    <div className="flex items-center gap-0 w-full mb-6">
      {steps.map((s, i) => (
        <React.Fragment key={s.id}>
          <div className="flex flex-col items-center">
            <div
              className={cn(
                'h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all duration-300',
                i < currentIndex
                  ? 'bg-primary border-primary text-primary-foreground'
                  : i === currentIndex
                  ? 'bg-primary/15 border-primary text-primary'
                  : 'bg-muted border-muted-foreground/20 text-muted-foreground'
              )}
            >
              {i < currentIndex ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
            </div>
            <span
              className={cn(
                'text-[10px] mt-1 font-medium',
                i <= currentIndex ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              {s.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div
              className={cn(
                'flex-1 h-0.5 mx-1 mb-4 transition-all duration-300',
                i < currentIndex ? 'bg-primary' : 'bg-muted'
              )}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ─── Propose Changes Dialog ───────────────────────────────────────────────────
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
  const [doctorCity, setDoctorCity] = useState('');
  const [doctorSearch, setDoctorSearch] = useState('');
  const [isAddingNewCity, setIsAddingNewCity] = useState(false);
  const [newCityName, setNewCityName] = useState('');
  const [proposedDoctor, setProposedDoctor] = useState<Partial<Doctor> | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();
  const firestore = useFirestore();

  const citiesQuery = useMemoFirebase(() => {
    if (!firestore || !repCity) return null;
    return query(collection(firestore, 'districts_cities'), where('districtName', '==', repCity));
  }, [firestore, repCity]);
  const { data: districtCities } = useCollection<{ name: string; districtName: string }>(citiesQuery);
  const cityOptions = useMemo(() => districtCities?.map(c => c.name).sort() ?? [], [districtCities]);

  useEffect(() => {
    if (cityOptions.length > 0 && !doctorCity) {
      setDoctorCity(cityOptions[0]);
    }
  }, [cityOptions, doctorCity]);

  const filteredDoctors = useMemo(() => {
    if (!doctorSearch.trim()) return doctors;
    const lower = doctorSearch.toLowerCase();
    return doctors.filter(d => d.name.toLowerCase().includes(lower));
  }, [doctors, doctorSearch]);

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
        doctorDistrict: (repDistrict || '').trim().toUpperCase(),
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
        title: "✅ Request Submitted",
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
      setDoctorCity(cityOptions[0] || repCity);
      setIsAddingNewCity(false);
      setNewCityName('');
      setProposedDoctor(null);
      setIsSubmitting(false);
      setDoctorSearch('');
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
        <Button
          size="lg"
          className="w-full sm:w-auto shadow-lg text-base h-12 px-6 rounded-xl font-semibold"
        >
          <PlusCircle className="mr-2 h-5 w-5" />
          Start a New Proposal
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-lg w-full sm:w-[calc(100vw-2rem)] rounded-2xl p-0 overflow-hidden">
        {/* Gradient header band */}
        <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-6 pt-6 pb-4 border-b">
          <DialogTitle className="text-xl font-bold">
            {step === 'type' && 'New Proposal'}
            {step === 'details' && (requestType === 'new_doctor' ? 'New Doctor Details' : 'Select Doctor')}
            {step === 'slides' && `Select Slides`}
          </DialogTitle>
          <DialogDescription className="text-sm mt-1">
            {step === 'type' && 'What change would you like to propose?'}
            {step === 'details' && requestType === 'new_doctor' && `Adding to district: ${repCity}`}
            {step === 'details' && requestType === 'slide_change' && 'Choose the doctor to update'}
            {step === 'slides' && `Configuring slides for ${proposedDoctor?.name}`}
          </DialogDescription>
        </div>

        <div className="px-6 pt-5 pb-4">
          <StepIndicator step={step} />

          {/* Step 1: Type selection */}
          {step === 'type' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Add New Doctor */}
              <button
                onClick={() => handleTypeSelect('new_doctor')}
                className="group relative flex flex-col items-center text-center gap-4 p-6 rounded-xl border-2 border-transparent bg-purple-50 hover:border-purple-300 hover:bg-purple-100/60 transition-all duration-200 active:scale-[0.98]"
              >
                <div className="h-14 w-14 rounded-2xl bg-purple-100 group-hover:bg-purple-200 flex items-center justify-center transition-colors">
                  <UserPlus className="h-7 w-7 text-purple-600" />
                </div>
                <div>
                  <div className="font-bold text-base text-foreground">Add New Doctor</div>
                  <div className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    Propose a new doctor to be added for your district
                  </div>
                </div>
                <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>

              {/* Update Slides */}
              <button
                onClick={() => handleTypeSelect('slide_change')}
                className="group relative flex flex-col items-center text-center gap-4 p-6 rounded-xl border-2 border-transparent bg-blue-50 hover:border-blue-300 hover:bg-blue-100/60 transition-all duration-200 active:scale-[0.98]"
              >
                <div className="h-14 w-14 rounded-2xl bg-blue-100 group-hover:bg-blue-200 flex items-center justify-center transition-colors">
                  <SlidersHorizontal className="h-7 w-7 text-blue-600" />
                </div>
                <div>
                  <div className="font-bold text-base text-foreground">Update Slides</div>
                  <div className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    Request slide changes for an existing doctor
                  </div>
                </div>
                <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            </div>
          )}

          {/* Step 2: Details */}
          {step === 'details' && (
            <div className="space-y-4">
              {requestType === 'new_doctor' ? (
                <>
                  {/* Doctor Name */}
                  <div className="space-y-1.5">
                    <Label htmlFor="doctor-name" className="text-sm font-semibold">Doctor Name</Label>
                    <div className="relative">
                      <Stethoscope className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="doctor-name"
                        placeholder="e.g., Ravi Kumar"
                        value={doctorName}
                        onChange={(e) => setDoctorName(e.target.value)}
                        className="pl-10 h-11"
                        autoFocus
                      />
                    </div>
                    {doctorName.trim() && !doctorName.trim().startsWith('Dr.') && (
                      <p className="text-xs text-muted-foreground">
                        Will be saved as: <strong>Dr. {doctorName.trim()}</strong>
                      </p>
                    )}
                  </div>

                  {/* City */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-semibold">City in District</Label>
                      {!isAddingNewCity && (
                        <button
                          type="button"
                          onClick={() => { setIsAddingNewCity(true); setDoctorCity(''); }}
                          className="text-xs text-primary hover:underline flex items-center gap-1 font-medium"
                        >
                          <PlusCircle className="h-3 w-3" /> Add New City
                        </button>
                      )}
                    </div>
                    {isAddingNewCity ? (
                      <div className="flex gap-2">
                        <Input
                          placeholder="Type new city name..."
                          value={newCityName}
                          onChange={(e) => setNewCityName(e.target.value)}
                          autoFocus
                          className="h-11"
                        />
                        <Button
                          type="button"
                          variant="default"
                          size="sm"
                          className="h-11 px-3 whitespace-nowrap"
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
                          className="h-11"
                          onClick={() => { setIsAddingNewCity(false); setNewCityName(''); setDoctorCity(cityOptions[0] || repCity); }}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <Select value={doctorCity} onValueChange={setDoctorCity}>
                        <SelectTrigger className="w-full h-11">
                          <MapPin className="mr-2 h-4 w-4 text-muted-foreground" />
                          <SelectValue placeholder="Select a city..." />
                        </SelectTrigger>
                        <SelectContent className="max-h-52">
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
                    {doctorCity && !cityOptions.includes(doctorCity) && !isAddingNewCity && (
                      <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg border border-amber-100 flex items-start gap-1.5">
                        <span className="shrink-0">⚠</span>
                        This is a new city. It will be created upon admin approval.
                      </p>
                    )}
                  </div>
                </>
              ) : (
                /* Slide change - doctor picker */
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Select Doctor</Label>
                  {/* Search filter */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search doctor..."
                      value={doctorSearch}
                      onChange={(e) => setDoctorSearch(e.target.value)}
                      className="pl-10 h-10 text-sm"
                    />
                  </div>
                  {/* Doctor list */}
                  <div className="max-h-56 overflow-y-auto rounded-xl border divide-y">
                    {filteredDoctors.length === 0 ? (
                      <div className="py-6 text-center text-sm text-muted-foreground">No doctors found</div>
                    ) : (
                      filteredDoctors.map(doctor => (
                        <button
                          key={doctor.id}
                          type="button"
                          onClick={() => setSelectedDoctorId(doctor.id)}
                          className={cn(
                            'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors',
                            selectedDoctorId === doctor.id
                              ? 'bg-primary/10 text-primary'
                              : 'hover:bg-muted/50'
                          )}
                        >
                          <div className={cn(
                            'h-8 w-8 shrink-0 rounded-full flex items-center justify-center text-xs font-bold',
                            selectedDoctorId === doctor.id
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted text-muted-foreground'
                          )}>
                            {doctor.name.replace('Dr. ', '').charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm truncate">{doctor.name}</p>
                          </div>
                          {selectedDoctorId === doctor.id && (
                            <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                          )}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}

              <DialogFooter className="flex flex-row gap-2 pt-2">
                <Button variant="outline" onClick={() => setStep('type')} className="flex-1 sm:flex-none h-11">
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back
                </Button>
                <Button
                  onClick={handleNext}
                  disabled={requestType === 'new_doctor' ? !doctorName.trim() : !selectedDoctorId}
                  className="flex-1 sm:flex-none h-11"
                >
                  Next: Select Slides <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </DialogFooter>
            </div>
          )}

          {/* Step 3: Slides */}
          {step === 'slides' && proposedDoctor ? (
            <EditSlidesForm
              doctor={proposedDoctor}
              onSave={handleSlideSave}
              isSaving={isSubmitting}
            />
          ) : null}
        </div>
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

  const repDistrict = userProfile?.city;
  const isLoading = isAuthLoading || isProfileLoading || isLoadingRequests || isLoadingDoctors;

  const sortedRequests = useMemo(() => {
    return requests?.sort((a, b) => b.createdAt.toDate().getTime() - a.createdAt.toDate().getTime()) || [];
  }, [requests]);

  const doctorMap = useMemo(() => {
    return new Map(doctors?.map(d => [d.id, d.name]) || []);
  }, [doctors]);

  const getStatusBadge = (status: Request['status']) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-amber-100 text-amber-800 border-amber-200">Pending</Badge>;
      case 'approved':
        return <Badge className="bg-green-100 text-green-800 border-green-200">Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>;
    }
  };

  const getRequestDoctorName = (req: Request) => {
    if (req.doctorName) return req.doctorName;
    if (req.doctorId) return doctorMap.get(req.doctorId) || 'Unknown Doctor';
    return 'N/A';
  };

  const getRequestDoctorCity = (req: Request) => {
    if (req.doctorCity) return req.doctorCity;
    if (req.doctorId) {
      const d = doctors?.find(doc => doc.id === req.doctorId);
      return d?.city || 'Unknown';
    }
    return 'N/A';
  };

  // Stats summary
  const stats = useMemo(() => ({
    pending: sortedRequests.filter(r => r.status === 'pending').length,
    approved: sortedRequests.filter(r => r.status === 'approved').length,
    rejected: sortedRequests.filter(r => r.status === 'rejected').length,
  }), [sortedRequests]);

  return (
    <div className="space-y-6 pb-28 md:pb-32">

      {/* Page Header */}
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="font-headline text-2xl sm:text-3xl font-bold tracking-tight">My Proposals</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track the status of changes you've submitted for review
          </p>
        </div>

        {/* CTA Button - full width on mobile */}
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

      {/* Stats row */}
      {!isLoading && sortedRequests.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <Card className="rounded-xl border shadow-sm">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-amber-600">{stats.pending}</div>
              <p className="text-xs text-muted-foreground mt-0.5">Pending</p>
            </CardContent>
          </Card>
          <Card className="rounded-xl border shadow-sm">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600">{stats.approved}</div>
              <p className="text-xs text-muted-foreground mt-0.5">Approved</p>
            </CardContent>
          </Card>
          <Card className="rounded-xl border shadow-sm">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-destructive">{stats.rejected}</div>
              <p className="text-xs text-muted-foreground mt-0.5">Rejected</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Content */}
      <Card className="rounded-xl border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Proposal History</CardTitle>
          <CardDescription className="text-xs">All proposals you've submitted</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex h-48 items-center justify-center">
              <Loader className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-3 text-muted-foreground text-sm">Loading proposals...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Desktop Table */}
              <div className="hidden lg:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Doctor</TableHead>
                      <TableHead>City</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-14 text-center">Slides</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedRequests.length > 0 ? sortedRequests.map(req => (
                      <TableRow key={req.id}>
                        <TableCell className="font-medium">{getRequestDoctorName(req)}</TableCell>
                        <TableCell className="text-muted-foreground">{getRequestDoctorCity(req)}</TableCell>
                        <TableCell>
                          {req.requestType === 'slide_change' ? (
                            <Badge variant="secondary" className="bg-blue-100 text-blue-800">Slide Update</Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-purple-100 text-purple-800">New Doctor</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <span title={format(req.createdAt.toDate(), 'PPP p')}>
                            {formatDistanceToNow(req.createdAt.toDate(), { addSuffix: true })}
                          </span>
                        </TableCell>
                        <TableCell>{getStatusBadge(req.status)}</TableCell>
                        <TableCell className="text-center">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setPreviewRequest(req)}
                            className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )) : (
                      <TableRow>
                        <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                          No proposals yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile + Tablet Card Grid */}
              <div className="lg:hidden grid grid-cols-1 sm:grid-cols-2 gap-3">
                {sortedRequests.length > 0 ? sortedRequests.map(req => (
                  <Card
                    key={req.id}
                    className="flex flex-col rounded-xl border overflow-hidden transition-all hover:shadow-md"
                  >
                    {/* Status stripe */}
                    <div className={cn(
                      'h-1',
                      req.status === 'pending' ? 'bg-amber-400' :
                      req.status === 'approved' ? 'bg-green-500' : 'bg-red-500'
                    )} />
                    <CardContent className="p-4 flex flex-col gap-3">
                      <div className="flex justify-between items-start">
                        <div className="min-w-0 flex-1">
                          <h3 className="font-bold text-sm leading-tight truncate">
                            {getRequestDoctorName(req)}
                          </h3>
                          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                            <MapPin className="h-3 w-3 shrink-0" />
                            {getRequestDoctorCity(req)}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDistanceToNow(req.createdAt.toDate(), { addSuffix: true })}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-2 shrink-0 ml-3">
                          {getStatusBadge(req.status)}
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setPreviewRequest(req)}
                            className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50 border border-blue-100"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="pt-2 border-t border-border/50">
                        {req.requestType === 'slide_change' ? (
                          <Badge variant="secondary" className="bg-blue-50 text-blue-700 text-[10px]">
                            <SlidersHorizontal className="h-2.5 w-2.5 mr-1" />Slide Update
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-purple-50 text-purple-700 text-[10px]">
                            <UserPlus className="h-2.5 w-2.5 mr-1" />New Doctor
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )) : (
                  <div className="col-span-full py-16 text-center">
                    <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
                      <FileQuestion className="h-8 w-8 text-muted-foreground/50" />
                    </div>
                    <h3 className="text-base font-semibold text-foreground">No Proposals Yet</h3>
                    <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">
                      Tap the button above to submit your first proposal.
                    </p>
                  </div>
                )}
              </div>
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
