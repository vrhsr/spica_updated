'use client';

import React, { useState } from 'react';
import { useAuth, useFirestore, useUser, useCollection } from '@/firebase';
import { collection, addDoc, query, where, serverTimestamp } from 'firebase/firestore';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader, PlusCircle, Clock, CheckCircle, XCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

type Request = {
  id: string;
  type: 'new_doctor' | 'update_slides' | 'other';
  details: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: any;
  repId: string;
  repName: string;
};

export default function RepRequestsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [requestType, setRequestType] = useState<string>('');
  const [requestDetails, setRequestDetails] = useState('');

  // Fetch Requests
  const requestsQuery = user?.uid && firestore
    ? query(collection(firestore, 'requests'), where('repId', '==', user.uid))
    : null;

  const { data: requests, isLoading } = useCollection<Request>(requestsQuery);

  const handleSubmit = async () => {
    if (!firestore || !user) return;
    if (!requestType || !requestDetails) {
      toast({
        variant: 'destructive',
        title: 'Missing Information',
        description: 'Please select a type and provide details.',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await addDoc(collection(firestore, 'requests'), {
        type: requestType,
        details: requestDetails, // Plain text description
        status: 'pending',
        repId: user.uid,
        repName: user.displayName || 'Unknown Rep',
        createdAt: serverTimestamp(),
      });

      toast({
        title: 'Request Submitted',
        description: 'Admin will review your request shortly.',
      });
      setIsDialogOpen(false);
      setRequestType('');
      setRequestDetails('');
    } catch (error) {
      console.error('Error submitting request:', error);
      toast({
        variant: 'destructive',
        title: 'Submission Failed',
        description: 'Could not submit request. Try again later.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <div className="flex items-center text-yellow-600 bg-yellow-100 px-2 py-1 rounded text-xs font-medium"><Clock className="w-3 h-3 mr-1" /> Pending</div>;
      case 'approved':
        return <div className="flex items-center text-green-600 bg-green-100 px-2 py-1 rounded text-xs font-medium"><CheckCircle className="w-3 h-3 mr-1" /> Approved</div>;
      case 'rejected':
        return <div className="flex items-center text-red-600 bg-red-100 px-2 py-1 rounded text-xs font-medium"><XCircle className="w-3 h-3 mr-1" /> Rejected</div>;
      default:
        return null;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'new_doctor': return 'New Doctor';
      case 'update_slides': return 'Update Slides';
      default: return 'Other';
    }
  }

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h1 className="font-headline text-3xl font-bold tracking-tight">
          Change Requests
        </h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full md:w-auto">
              <PlusCircle className="mr-2 h-4 w-4" /> Propose Change
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Propose a Change</DialogTitle>
              <DialogDescription>
                Submit a request to add a doctor, update slides, or other changes.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="type">Request Type</Label>
                <Select value={requestType} onValueChange={setRequestType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new_doctor">Add New Doctor</SelectItem>
                    <SelectItem value="update_slides">Update Slides</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="details">Details</Label>
                <Textarea
                  id="details"
                  placeholder="e.g. Please add Dr. Smith (Cardiology) in Mumbai..."
                  value={requestDetails}
                  onChange={(e) => setRequestDetails(e.target.value)}
                  rows={4}
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting && <Loader className="mr-2 h-4 w-4 animate-spin" />}
                Submit Request
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-8">
          <Loader className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : requests && requests.length > 0 ? (
        <div className="grid gap-4">
          {requests.map((request) => (
            <Card key={request.id}>
              <CardHeader className="p-4 pb-2">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-base font-semibold">
                    {getTypeLabel(request.type)}
                  </CardTitle>
                  {getStatusBadge(request.status)}
                </div>
                <CardDescription className="text-xs">
                  {request.createdAt?.toDate ? formatDistanceToNow(request.createdAt.toDate(), { addSuffix: true }) : 'Just now'}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-2">
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{request.details}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="text-center p-8 text-muted-foreground">
          <p>No requests found. Propose a change to get started.</p>
        </Card>
      )}
    </div>
  );
}
