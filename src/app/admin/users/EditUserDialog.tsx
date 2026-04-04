'use client';

import React, { useState, useTransition, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader, AlertTriangle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { updateUserDetails, setUserCity, setUserRole } from './actions';
import { RoleUser } from './page'; // Ensure this type is exported from page.tsx or moved to a shared types file

export function EditUserDialog({
  user,
  cities = [],
  onClose,
  onUserUpdated
}: {
  user: RoleUser | null;
  cities?: { id: string, name: string }[];
  onClose: () => void;
  onUserUpdated: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');
  const [role, setRole] = useState<'admin' | 'rep'>('rep');
  
  const [isSubmitting, startTransition] = useTransition();
  const { toast } = useToast();

  // Populate form when dialog opens
  useEffect(() => {
    if (user) {
      setName(user.displayName || '');
      setPhone(user.phone || '');
      setEmail(user.email || '');
      setCity(user.city || '');
      setRole(user.role || 'rep');
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  }, [user]);

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      // Delay telling parent to nullify user to allow Dialog close animation to complete
      setTimeout(() => {
        onClose();
        // Fallback safety to strip locks
        document.body.style.pointerEvents = '';
        document.body.removeAttribute('data-scroll-locked');
      }, 300);
    }
  };

  const handleSave = () => {
    if (!user) return;
    
    // Basic validation
    if (!name.trim()) {
      toast({ variant: 'destructive', title: 'Name is required' });
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      toast({ variant: 'destructive', title: 'A valid email is required' });
      return;
    }

    startTransition(async () => {
      try {
        await updateUserDetails({
          uid: user.uid,
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || undefined,
        });

        // Handle role change safely
        if (role !== user.role) {
          await setUserRole(user.uid, role);
        }

        // Handle city change for rep
        if (role === 'rep' && city !== user.city) {
          if (!city) throw new Error("City/District cannot be empty for a rep");
          await setUserCity(user.uid, city);
        }
        
        toast({
          title: 'User Updated',
          description: `Details for ${name.trim()} have been successfully saved.`,
        });
        
        onUserUpdated();
        handleOpenChange(false);
      } catch (err: any) {
        console.error(err);
        toast({
          variant: 'destructive',
          title: 'Update Failed',
          description: err.message || 'Could not update user details.',
        });
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit User Details</DialogTitle>
          <DialogDescription>
            Update personal and contact information for this user. 
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Display Name */}
          <div className="grid gap-2">
            <Label htmlFor="edit-name">Display Name</Label>
            <Input
              id="edit-name"
              placeholder="e.g. John Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          {/* Email */}
          <div className="grid gap-2">
            <Label htmlFor="edit-email">Email Address</Label>
            <Input
              id="edit-email"
              type="email"
              placeholder="e.g. john@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isSubmitting}
            />
            {email !== user?.email && (
              <p className="text-xs text-amber-600 flex items-start gap-1 mt-1 font-medium bg-amber-50 p-1.5 rounded">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                Changing the email will alter the user's login credentials. They must use the new email to sign in.
              </p>
            )}
          </div>

          {/* Phone */}
          <div className="grid gap-2">
            <Label htmlFor="edit-phone">Phone Number (Optional)</Label>
            <Input
              id="edit-phone"
              placeholder="+1234567890"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          {/* Role Field */}
          <div className="grid gap-2">
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as 'admin' | 'rep')} disabled={isSubmitting}>
              <SelectTrigger>
                <SelectValue placeholder="Select Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="rep">Representative</SelectItem>
              </SelectContent>
            </Select>
            {role === 'admin' && user?.role !== 'admin' && (
              <p className="text-xs text-amber-600 flex items-start gap-1 mt-1 font-medium bg-amber-50 p-1.5 rounded">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                Warning: Assigning the Admin role grants this user critical system access.
              </p>
            )}
          </div>

          {/* District Field for Reps Only */}
          {role === 'rep' && (
            <div className="grid gap-2">
              <Label>District</Label>
              <Select value={city} onValueChange={setCity} disabled={isSubmitting}>
                <SelectTrigger>
                  <SelectValue placeholder="Select District" />
                </SelectTrigger>
                <SelectContent className="max-h-64 mb-10 overflow-y-auto w-full max-w-none">
                  {cities.map((c) => (
                    <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isSubmitting}>Cancel</Button>
          <Button 
            onClick={handleSave} 
            disabled={isSubmitting || !name.trim() || !email.trim()}
          >
            {isSubmitting && <Loader className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
