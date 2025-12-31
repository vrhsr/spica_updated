
'use client';

/**
 * @fileoverview This component is the primary admin interface for managing user roles and city assignments.
 * It is protected by an admin-only guard. Non-admin users will see a "Permission Denied" message.
 */

import React, { useState, useEffect, useCallback, useTransition } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader, Users, ShieldQuestion, MoreHorizontal, Trash2 } from 'lucide-react';
import { z } from 'zod';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection } from 'firebase/firestore';
import { useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { AddRepDialog } from '../reps/AddRepDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { listAllUsers, setUserRole, setUserCity, deleteUser } from './actions';


const RoleUserSchema = z.object({
  uid: z.string(),
  email: z.string().optional(),
  displayName: z.string().optional(),
  phone: z.string().optional(),
  role: z.enum(['admin', 'rep']).optional(),
  city: z.string().optional(),
});
export type RoleUser = z.infer<typeof RoleUserSchema>;

type City = { id: string, name: string };

type RoleChangeConfirmation = {
    uid: string;
    newRole: 'admin' | 'rep';
    displayName: string;
}

type CityChangeConfirmation = {
    uid: string;
    newCity: string;
    oldCity: string;
    displayName: string;
}

const KING_ADMIN_EMAIL = 'mvrhsr0@gmail.com';


export default function UsersPage() {
  const [users, setUsers] = useState<RoleUser[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [isSubmitting, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user: currentUser, role: currentUserRole, isUserLoading } = useUser();
  const [userToDelete, setUserToDelete] = useState<RoleUser | null>(null);
  const [roleChangeToConfirm, setRoleChangeToConfirm] = useState<RoleChangeConfirmation | null>(null);
  const [cityChangeToConfirm, setCityChangeToConfirm] = useState<CityChangeConfirmation | null>(null);
  const [deleteConfirmationInput, setDeleteConfirmationInput] = useState('');

  const citiesCollection = useMemoFirebase(
    () => (firestore ? collection(firestore, 'cities') : null),
    [firestore]
  );
  const { data: cities, isLoading: isLoadingCities } = useCollection<City>(citiesCollection);

  const fetchUsers = useCallback(async () => {
    setIsDataLoading(true);
    setError(null);
    try {
      const userList = await listAllUsers();
      setUsers(userList);
    } catch (e: any) {
      console.error('Failed to fetch users:', e);
      setError('Could not load user data. This is likely a permissions issue with your backend environment. Ensure your service account credentials are set correctly.');
      toast({
        variant: 'destructive',
        title: 'Error fetching users',
        description: e.message || 'An unknown error occurred.',
      });
    } finally {
      setIsDataLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!isUserLoading && currentUserRole === 'admin') {
      fetchUsers();
    } else if (!isUserLoading) {
      setIsDataLoading(false);
    }
  }, [fetchUsers, currentUserRole, isUserLoading]);
  

  const proceedWithRoleChange = async () => {
    if (!roleChangeToConfirm) return;
    const { uid, newRole, displayName } = roleChangeToConfirm;

    startTransition(async () => {
      try {
        await setUserRole(uid, newRole);
        toast({
          title: 'Role Updated',
          description: `${displayName}'s role has been set to ${newRole}. The user must log out and log back in for the changes to apply.`,
        });
        await fetchUsers(); // Refresh the user list
      } catch (err: any) {
        console.error(err);
        toast({
          variant: 'destructive',
          title: 'Failed to update role',
          description: err.message || 'An unknown error occurred.',
        });
      } finally {
        setRoleChangeToConfirm(null);
      }
    });
  };

  const initiateRoleChange = (uid: string, newRole: 'admin' | 'rep', displayName: string) => {
    if (uid === currentUser?.uid) {
        toast({
            variant: 'destructive',
            title: 'Action not allowed',
            description: 'For security, you cannot change your own role.',
        });
        return;
    }
    // If setting a user to admin, show confirmation. Otherwise, proceed directly.
    if (newRole === 'admin') {
        setRoleChangeToConfirm({ uid, newRole, displayName });
    } else {
        proceedWithRoleChangeOnNoConfirm(uid, newRole, displayName);
    }
  };
  
  const proceedWithRoleChangeOnNoConfirm = async (uid: string, newRole: 'rep', displayName: string) => {
     startTransition(async () => {
      try {
        await setUserRole(uid, newRole);
        toast({
          title: 'Role Updated',
          description: `${displayName}'s role has been set to ${newRole}. The user must log out and log back in for the changes to apply.`,
        });
        await fetchUsers(); // Refresh the user list
      } catch (err: any) {
        console.error(err);
        toast({
          variant: 'destructive',
          title: 'Failed to update role',
          description: err.message || 'An unknown error occurred.',
        });
      }
    });
  }


  const proceedWithCityChange = async () => {
    if (!cityChangeToConfirm) return;
    const { uid, newCity } = cityChangeToConfirm;
    startTransition(async () => {
        try {
            await setUserCity(uid, newCity);
            toast({
                title: 'City Updated',
                description: `${cityChangeToConfirm.displayName}'s city has been changed to ${newCity}. The user must log out and log back in for the changes to apply.`,
            });
            await fetchUsers();
        } catch (err: any) {
            console.error(err);
            toast({
                variant: 'destructive',
                title: 'Failed to update city',
                description: err.message || 'An unknown error occurred.',
            });
        } finally {
            setCityChangeToConfirm(null);
        }
    });
  };

  const initiateCityChange = (uid: string, newCity: string, user: RoleUser) => {
     // If the user's role is not 'rep', don't do anything.
    if (user.role !== 'rep') return;

    setCityChangeToConfirm({
        uid,
        newCity,
        oldCity: user.city || 'N/A',
        displayName: user.displayName || user.email || 'this user'
    });
  }

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    startTransition(async () => {
        try {
            await deleteUser(userToDelete.uid);
            toast({
                title: 'User Deleted',
                description: `${userToDelete.displayName || userToDelete.email} has been permanently deleted.`,
            });
            await fetchUsers();
        } catch (err: any) {
             console.error(err);
             toast({
                variant: 'destructive',
                title: 'Failed to delete user',
                description: err.message || 'An unknown error occurred.',
             });
        } finally {
            setUserToDelete(null);
            setDeleteConfirmationInput('');
        }
    });
  };
  
  const handleOpenDeleteDialog = (user: RoleUser) => {
    setUserToDelete(user);
    setDeleteConfirmationInput('');
  }

  const getRoleBadge = (role?: 'admin' | 'rep') => {
    if (role === 'admin') {
      return <Badge variant="destructive">Admin</Badge>;
    }
    if (role === 'rep') {
      return <Badge className="bg-blue-100 text-blue-800">Rep</Badge>;
    }
    return <Badge variant="outline">Not Set</Badge>;
  };
  
  if (isUserLoading) {
    return (
      <div className="flex h-64 w-full items-center justify-center">
        <Loader className="h-8 w-8 animate-spin" />
      </div>
    )
  }
  
  if (currentUserRole !== 'admin') {
    return (
        <Card className="shadow-sm">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 font-headline"><ShieldQuestion /> Permission Denied</CardTitle>
                <CardDescription>
                  You do not have the necessary permissions to view this page. This is because your account does not have the 'admin' role. Please contact the system administrator.
                </CardDescription>
            </CardHeader>
        </Card>
    )
  }

  // This is the view for an admin user.
  return (
    <div className="space-y-6">
       <div className="flex items-center justify-between">
        <h1 className="font-headline text-3xl font-bold tracking-tight">
          Users &amp; Roles Management
        </h1>
        <AddRepDialog 
            cities={cities || []} 
            isLoadingCities={isLoadingCities}
            onRepAdded={fetchUsers} 
            triggerButton={
              <Button><Users className="mr-2 h-4 w-4" /> Add User</Button>
            } 
        />
      </div>
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>All Users</CardTitle>
          <CardDescription>
            Assign roles and cities to users. These are enforced by Firestore security rules. A user must log out and log back in for changes to take effect.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isDataLoading ? (
            <div className="flex items-center justify-center gap-2 py-8">
                <Loader className="h-5 w-5 animate-spin text-primary" />
                <p className="text-muted-foreground">Loading users...</p>
            </div>
          ) : error ? (
            <div className="py-8 text-center text-destructive">{error}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Display Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => {
                  const isCurrentUser = user.uid === currentUser?.uid;
                  const isKingAdmin = user.email === KING_ADMIN_EMAIL;
                  const canPerformAction = !isCurrentUser && !isKingAdmin;

                  return (
                    <TableRow key={user.uid}>
                      <TableCell className="font-medium">{user.displayName || 'N/A'}</TableCell>
                      <TableCell className="text-muted-foreground">{user.email || 'N/A'}</TableCell>
                      <TableCell className="text-muted-foreground">{user.phone || 'N/A'}</TableCell>
                      <TableCell>
                        <Select
                          value={user.role || ''}
                          onValueChange={(value: 'admin' | 'rep') =>
                            initiateRoleChange(user.uid, value, user.displayName || user.email || 'this user')
                          }
                          disabled={!canPerformAction || isSubmitting}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select role...">
                              {getRoleBadge(user.role)}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="rep">Representative</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                         <Select
                          value={user.city || ''}
                          onValueChange={(value: string) =>
                            initiateCityChange(user.uid, value, user)
                          }
                          disabled={user.role !== 'rep' || isLoadingCities || !canPerformAction || isSubmitting}
                        >
                          <SelectTrigger className="w-40">
                            <SelectValue placeholder={user.role !== 'rep' ? "N/A" : "Select city..."} />
                          </SelectTrigger>
                          <SelectContent>
                            {isLoadingCities ? (
                              <div className="flex items-center justify-center p-2"><Loader className="h-4 w-4 animate-spin"/></div>
                            ) : cities?.map(city => (
                                <SelectItem key={city.id} value={city.name}>{city.name}</SelectItem>
                              ))
                            }
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right">
                         {canPerformAction && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0" disabled={isSubmitting}>
                                <span className="sr-only">Open menu</span>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-red-500 focus:bg-red-500/10 focus:text-red-600"
                                onClick={() => handleOpenDeleteDialog(user)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete User
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                         )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the user account
              for <span className="font-bold">{userToDelete?.displayName || userToDelete?.email}</span>.
              <br/><br/>
              To confirm, please type <strong className="text-foreground">DELETE</strong> in the box below.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="delete-confirm" className="sr-only">Confirm Deletion</Label>
            <Input 
              id="delete-confirm"
              value={deleteConfirmationInput}
              onChange={(e) => setDeleteConfirmationInput(e.target.value)}
              autoComplete="off"
              placeholder="DELETE"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteUser} 
              disabled={deleteConfirmationInput !== 'DELETE' || isSubmitting}
              className="bg-destructive hover:bg-destructive/90">
              {isSubmitting && <Loader className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Role Change Confirmation Dialog */}
      <AlertDialog open={!!roleChangeToConfirm} onOpenChange={(open) => !open && setRoleChangeToConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Role Change</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to grant <span className="font-bold">{roleChangeToConfirm?.displayName}</span> full administrative privileges? They will have the ability to manage users and all other aspects of the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setRoleChangeToConfirm(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={proceedWithRoleChange} disabled={isSubmitting}>
              {isSubmitting && <Loader className="mr-2 h-4 w-4 animate-spin" />}
              Confirm & Grant Admin
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* City Change Confirmation Dialog */}
      <AlertDialog open={!!cityChangeToConfirm} onOpenChange={(open) => !open && setCityChangeToConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm City Change</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to change city for <span className="font-bold">{cityChangeToConfirm?.displayName}</span> from <span className="font-bold">{cityChangeToConfirm?.oldCity}</span> to <span className="font-bold">{cityChangeToConfirm?.newCity}</span>? The user must log out and back in for this to take effect.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setCityChangeToConfirm(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={proceedWithCityChange} disabled={isSubmitting}>
              {isSubmitting && <Loader className="mr-2 h-4 w-4 animate-spin" />}
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
