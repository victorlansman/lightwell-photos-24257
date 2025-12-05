import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Member } from "@/lib/azureApiClient";
import { useRemoveMember, useChangeMemberRole } from "@/hooks/useInvites";
import { useToast } from "@/hooks/use-toast";
import { UserMinus, User } from "lucide-react";
import { useState } from "react";

interface MembersListProps {
  members: Member[];
  collectionId: string;
  collectionName?: string;
  photoCount?: number;
  currentUserRole: 'owner' | 'admin' | 'viewer';
  currentUserId?: string;
  onCollectionDeleted?: () => void;
}

export function MembersList({ members, collectionId, collectionName, photoCount, currentUserRole, currentUserId, onCollectionDeleted }: MembersListProps) {
  const { toast } = useToast();
  const removeMember = useRemoveMember(collectionId);
  const changeMemberRole = useChangeMemberRole(collectionId);
  const [changingRole, setChangingRole] = useState<string | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);

  const isOwner = currentUserRole === 'owner';
  const ownerCount = members.filter(m => m.role === 'owner').length;

  const handleRemove = async (userId: string, email: string, willDeleteCollection: boolean) => {
    setRemovingMemberId(userId);
    try {
      const result = await removeMember.mutateAsync(userId);

      if (willDeleteCollection || result?.collection_deleted) {
        toast({
          title: "Collection deleted",
          description: `Collection and all photos have been permanently deleted.`,
        });
        onCollectionDeleted?.();
      } else {
        toast({
          title: "Member removed",
          description: `${email} has been removed from the collection`,
        });
      }
    } catch (error: any) {
      toast({
        title: "Failed to remove member",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setRemovingMemberId(null);
      setDeleteConfirmText('');
    }
  };

  const handleRoleChange = async (userId: string, newRole: 'owner' | 'admin' | 'viewer', email: string) => {
    setChangingRole(userId);
    try {
      await changeMemberRole.mutateAsync({ userId, role: newRole });
      toast({
        title: "Role updated",
        description: `${email}'s role changed to ${newRole}`,
      });
    } catch (error: any) {
      toast({
        title: "Failed to update role",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setChangingRole(null);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'owner': return 'bg-primary text-primary-foreground';
      case 'admin': return 'bg-blue-500 text-white';
      case 'viewer': return 'bg-muted text-muted-foreground';
      default: return 'bg-muted';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Active Members ({members.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {members.map((member) => {
            const isCurrentUser = member.user_id === currentUserId;
            const isOtherOwner = member.role === 'owner' && !isCurrentUser;
            const canModify = isOwner && !isOtherOwner;
            const isMemberLastOwner = member.role === 'owner' && ownerCount === 1;
            const willDeleteIfRemoved = isMemberLastOwner;

            return (
              <div
                key={member.user_id}
                className={`flex items-center justify-between p-3 border rounded-lg ${
                  isCurrentUser ? 'bg-primary/5 border-primary/20' : ''
                }`}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{member.email}</p>
                    {isCurrentUser && (
                      <Badge variant="secondary" className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        You ({member.role})
                      </Badge>
                    )}
                    {isMemberLastOwner && (
                      <Badge variant="outline" className="text-xs text-muted-foreground">
                        Last owner
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Joined {new Date(member.joined_at).toLocaleDateString()}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {/* Role Badge/Selector */}
                  {canModify ? (
                    <Select
                      value={member.role}
                      onValueChange={(role: 'owner' | 'admin' | 'viewer') =>
                        handleRoleChange(member.user_id, role, member.email)
                      }
                      disabled={changingRole === member.user_id}
                    >
                      <SelectTrigger className="w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="owner">Owner</SelectItem>
                        <SelectItem value="admin" disabled={isMemberLastOwner}>
                          Admin {isMemberLastOwner && '(need another owner)'}
                        </SelectItem>
                        <SelectItem value="viewer" disabled={isMemberLastOwner}>
                          Viewer {isMemberLastOwner && '(need another owner)'}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getRoleBadgeColor(member.role)}`}>
                      {member.role}
                    </span>
                  )}

                  {/* Remove Button */}
                  {canModify && (
                    <AlertDialog onOpenChange={(open) => { if (!open) setDeleteConfirmText(''); }}>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <UserMinus className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            {willDeleteIfRemoved
                              ? '⚠️ Warning: This will delete the collection'
                              : 'Remove member?'}
                          </AlertDialogTitle>
                          <AlertDialogDescription asChild>
                            <div className="space-y-3">
                              {willDeleteIfRemoved ? (
                                <>
                                  <p className="font-semibold text-destructive">
                                    {member.email} is the last owner. Removing them will permanently delete "{collectionName}" and all {photoCount ?? 0} photos.
                                  </p>
                                  <p>This cannot be undone. All photos and member access will be lost.</p>
                                  <div className="pt-2">
                                    <p className="text-sm mb-2">Type <span className="font-mono font-bold">delete</span> to confirm:</p>
                                    <Input
                                      value={deleteConfirmText}
                                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                                      placeholder="delete"
                                      disabled={removingMemberId === member.user_id}
                                    />
                                  </div>
                                </>
                              ) : (
                                <p>Remove {member.email} from this collection? They will lose access to all photos.</p>
                              )}
                            </div>
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel disabled={removingMemberId === member.user_id}>
                            Cancel
                          </AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleRemove(member.user_id, member.email, willDeleteIfRemoved)}
                            disabled={
                              removingMemberId === member.user_id ||
                              (willDeleteIfRemoved && deleteConfirmText.toLowerCase() !== 'delete')
                            }
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            {removingMemberId === member.user_id
                              ? 'Processing...'
                              : willDeleteIfRemoved
                              ? 'Delete Collection'
                              : 'Remove'}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
