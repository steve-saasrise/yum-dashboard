'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { useCuratorAuth } from '@/hooks/use-curator-auth';
import {
  UserPlus,
  Copy,
  Trash2,
  Mail,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
} from 'lucide-react';
import { format } from 'date-fns';

interface CuratorInvite {
  id: string;
  email: string;
  token: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
  inviter?: {
    email: string;
  };
}

export default function AdminPage() {
  const router = useRouter();
  const { curator, loading: authLoading } = useCuratorAuth();
  const [invites, setInvites] = useState<CuratorInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [sendingInvite, setSendingInvite] = useState(false);

  useEffect(() => {
    if (!authLoading && !curator?.is_admin) {
      router.push('/dashboard');
    }
  }, [curator, authLoading, router]);

  useEffect(() => {
    if (curator?.is_admin) {
      fetchInvites();
    }
  }, [curator]);

  async function fetchInvites() {
    try {
      const response = await fetch('/api/curator/invites', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setInvites(data.invites);
      }
    } catch (error) {
      console.error('Failed to fetch invites:', error);
      toast({
        title: 'Error',
        description: 'Failed to load invites',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  async function sendInvite() {
    setSendingInvite(true);

    try {
      const response = await fetch('/api/curator/invites', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ email: inviteEmail }),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: 'Invite sent!',
          description: `An invite has been sent to ${inviteEmail}`,
        });
        setInviteDialogOpen(false);
        setInviteEmail('');
        fetchInvites();
      } else {
        console.error('Invite error:', data);
        toast({
          title: 'Error',
          description: data.error || 'Failed to send invite',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Something went wrong',
        variant: 'destructive',
      });
    } finally {
      setSendingInvite(false);
    }
  }

  async function deleteInvite(inviteId: string) {
    if (!confirm('Are you sure you want to delete this invite?')) {
      return;
    }

    try {
      const response = await fetch(`/api/curator/invites/${inviteId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast({
          title: 'Invite deleted',
          description: 'The invite has been removed',
        });
        fetchInvites();
      } else {
        toast({
          title: 'Error',
          description: 'Failed to delete invite',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Something went wrong',
        variant: 'destructive',
      });
    }
  }

  function copyInviteLink(token: string) {
    const link = `${window.location.origin}/curator/accept-invite?token=${token}`;
    navigator.clipboard.writeText(link);
    toast({
      title: 'Link copied!',
      description: 'Invite link has been copied to clipboard',
    });
  }

  function getInviteStatus(invite: CuratorInvite) {
    if (invite.accepted_at) {
      return (
        <Badge variant="secondary">
          <CheckCircle className="w-3 h-3 mr-1" /> Accepted
        </Badge>
      );
    }

    const isExpired = new Date(invite.expires_at) < new Date();
    if (isExpired) {
      return (
        <Badge variant="destructive">
          <XCircle className="w-3 h-3 mr-1" /> Expired
        </Badge>
      );
    }

    return (
      <Badge variant="default">
        <Clock className="w-3 h-3 mr-1" /> Pending
      </Badge>
    );
  }

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!curator?.is_admin) {
    return null;
  }

  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Admin Dashboard</CardTitle>
              <CardDescription>Manage curator invitations</CardDescription>
            </div>
            <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Invite Curator
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Invite a new curator</DialogTitle>
                  <DialogDescription>
                    Send an invitation email to add a new curator to the
                    platform.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="email">Email address</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="curator@example.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    onClick={sendInvite}
                    disabled={!inviteEmail || sendingInvite}
                  >
                    {sendingInvite ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Mail className="mr-2 h-4 w-4" />
                        Send Invite
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Invited by</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invites.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center text-muted-foreground"
                  >
                    No invites yet
                  </TableCell>
                </TableRow>
              ) : (
                invites.map((invite) => (
                  <TableRow key={invite.id}>
                    <TableCell className="font-medium">
                      {invite.email}
                    </TableCell>
                    <TableCell>{getInviteStatus(invite)}</TableCell>
                    <TableCell>{invite.inviter?.email || 'System'}</TableCell>
                    <TableCell>
                      {format(new Date(invite.created_at), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {!invite.accepted_at &&
                          new Date(invite.expires_at) > new Date() && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => copyInviteLink(invite.token)}
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => deleteInvite(invite.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
