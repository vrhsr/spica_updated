
'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Loader, Copy, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { createUser } from '../users/actions';
import { useUser } from '@/firebase';

type City = {
  id: string;
  name: string;
};

interface AddRepDialogProps {
  cities: City[];
  isLoadingCities: boolean;
  defaultCity?: string;
  onRepAdded: () => void;
  triggerButton: React.ReactNode;
}

function PasswordDisplay({ password }: { password?: string }) {
  const [hasCopied, setHasCopied] = React.useState(false);
  const { toast } = useToast();

  const handleCopy = () => {
    if (password) {
      navigator.clipboard.writeText(password).then(() => {
        setHasCopied(true);
        setTimeout(() => setHasCopied(false), 2000); // Reset after 2s
      }).catch(err => {
        console.error("Failed to copy password: ", err);
        toast({
          variant: 'destructive',
          title: 'Copy Failed',
          description: 'Could not copy password to clipboard.'
        })
      });
    }
  }

  if (!password) return null;

  return (
    <div className="flex items-center space-x-2 my-2">
      <p className="font-mono text-sm bg-muted text-foreground p-2 rounded-md flex-grow">
        {password}
      </p>
      <Button variant="outline" size="icon" onClick={handleCopy}>
        {hasCopied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
        <span className="sr-only">Copy password</span>
      </Button>
    </div>
  )
}

export function AddRepDialog({ cities, isLoadingCities, defaultCity, onRepAdded, triggerButton }: AddRepDialogProps) {
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [role, setRole] = React.useState<'admin' | 'rep'>('rep');
  const [city, setCity] = React.useState<string | undefined>(defaultCity);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const { user: adminUser } = useUser();
  const { toast } = useToast();
  
  // When role changes, if it becomes admin, clear the city.
  React.useEffect(() => {
    if (role === 'admin') {
      setCity(undefined);
    } else if (defaultCity) {
      setCity(defaultCity);
    }
  }, [role, defaultCity]);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Basic validation to allow numbers and '+'
    if (/^[+0-9\s]*$/.test(value)) {
        setPhone(value);
    }
  };

  React.useEffect(() => {
    // Prefill with +91 when the dialog opens and phone is empty
    if (isDialogOpen && !phone) {
        setPhone('+91 ');
    }
  }, [isDialogOpen, phone]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminUser) {
      toast({
        variant: 'destructive',
        title: 'Authentication Error',
        description: 'You must be logged in as an admin to create users.',
      });
      return;
    }
    if (role === 'rep' && !city) {
        toast({
            variant: 'destructive',
            title: 'City is required for Representatives',
            description: 'Please select a city for the representative.',
        })
        return;
    }
    setIsSubmitting(true);
    try {
      const result = await createUser({
        name,
        email,
        phone,
        city: role === 'rep' ? city! : 'N/A', // City is not applicable for admins
        role,
        adminUid: adminUser.uid,
      });
      
      const roleName = role === 'admin' ? 'Admin' : 'Representative';
      
      toast({
        title: `${roleName} Created`,
        description: (
          <div>
            <p>{name} has been added. Their temporary password is:</p>
            <PasswordDisplay password={result.temporaryPassword} />
            <p>They should change this after their first login.</p>
          </div>
        ),
        duration: 15000, // Give user more time to copy password
      });

      onRepAdded();
      setIsDialogOpen(false); // Close the dialog
      // Reset form
      setName('');
      setEmail('');
      setPhone('');
      setRole('rep');
      setCity(defaultCity || undefined);

    } catch (err: any) {
      console.error(err);
      toast({
        variant: 'destructive',
        title: `Failed to create ${role}`,
        description: err.message || 'An unknown error occurred.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>{triggerButton}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New User</DialogTitle>
          <DialogDescription>
            Enter the details for the new user. Their account will be
            created with a temporary password.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="user-name">Full Name</Label>
            <Input
              id="user-name"
              placeholder="e.g., John Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="user-email">Email Address</Label>
            <Input
              id="user-email"
              type="email"
              placeholder="e.g., john.doe@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="user-phone">Phone Number</Label>
            <Input
              id="user-phone"
              placeholder="+91 12345 67890"
              value={phone}
              onChange={handlePhoneChange}
              required
            />
          </div>
           <div>
            <Label htmlFor="user-role">Role</Label>
            <Select value={role} onValueChange={(value: 'admin' | 'rep') => setRole(value)}>
                <SelectTrigger id="user-role">
                    <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="rep">Representative</SelectItem>
                </SelectContent>
            </Select>
          </div>
           {role === 'rep' && (
            <div>
              <Label htmlFor="rep-city">City</Label>
              <Select value={city} onValueChange={(value) => setCity(value)} disabled={!!defaultCity}>
                  <SelectTrigger id="rep-city">
                      <SelectValue placeholder="Select a city" />
                  </SelectTrigger>
                  <SelectContent>
                      {isLoadingCities && <div className="flex items-center justify-center p-2"><Loader className="h-4 w-4 animate-spin"/></div>}
                      {cities?.map((c) => (
                          <SelectItem key={c.id} value={c.name}>
                          {c.name}
                          </SelectItem>
                      ))}
                  </SelectContent>
              </Select>
            </div>
           )}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" type="button">
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="submit"
              disabled={isSubmitting || !name || !email || phone.length <= 3 || (role === 'rep' && !city) || isLoadingCities}
            >
              {isSubmitting && (
                <Loader className="mr-2 h-4 w-4 animate-spin" />
              )}
              {isSubmitting ? 'Creating...' : 'Create User'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
