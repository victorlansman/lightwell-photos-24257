import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { z } from "zod";

// Validation schema
const createCollectionSchema = z.object({
  name: z.string()
    .trim()
    .min(1, "Collection name is required")
    .max(100, "Collection name must be less than 100 characters"),
  shopifyOrderId: z.string()
    .max(255, "Shopify Order ID must be less than 255 characters")
    .optional()
});

interface CreateCollectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCollectionCreated: () => void;
}

export function CreateCollectionDialog({
  open,
  onOpenChange,
  onCollectionCreated,
}: CreateCollectionDialogProps) {
  const [name, setName] = useState("");
  const [shopifyOrderId, setShopifyOrderId] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate input
    const validation = createCollectionSchema.safeParse({
      name,
      shopifyOrderId: shopifyOrderId || undefined,
    });

    if (!validation.success) {
      toast({
        title: "Invalid input",
        description: validation.error.errors[0].message,
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get user's internal ID
      const { data: userData } = await supabase
        .from("users")
        .select("id")
        .eq("supabase_user_id", user.id)
        .single();

      if (!userData) throw new Error("User profile not found");

      // Create collection
      const { data: collection, error: collectionError } = await supabase
        .from("collections")
        .insert({
          name: validation.data.name,
          shopify_order_id: validation.data.shopifyOrderId || null,
        })
        .select()
        .single();

      if (collectionError) throw collectionError;

      // Add creator as owner
      const { error: memberError } = await supabase
        .from("collection_members")
        .insert({
          collection_id: collection.id,
          user_id: userData.id,
          role: "owner",
        });

      if (memberError) throw memberError;

      toast({
        title: "Collection created",
        description: `${name} has been created successfully.`,
      });

      setName("");
      setShopifyOrderId("");
      onOpenChange(false);
      onCollectionCreated();
    } catch (error: any) {
      toast({
        title: "Error creating collection",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Collection</DialogTitle>
          <DialogDescription>
            Create a new photo collection for your family or group.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Collection Name *</Label>
            <Input
              id="name"
              placeholder="Smith Family Photos"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="shopify_order">Shopify Order ID (Optional)</Label>
            <Input
              id="shopify_order"
              placeholder="gid://shopify/Order/1234567890"
              value={shopifyOrderId}
              onChange={(e) => setShopifyOrderId(e.target.value)}
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              For tracking orders from your digitization service
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Collection"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
