import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { MapPin, Plus } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  buyListId: string;
  selectedVehicleIds: string[];
  onComplete: (mapId: string) => void;
}

const AddToBidMapDialog = ({ open, onOpenChange, buyListId, selectedVehicleIds, onComplete }: Props) => {
  const { user, organization } = useAuth();
  const [mode, setMode] = useState<'new' | 'existing'>('new');
  const [newName, setNewName] = useState('');
  const [existingMaps, setExistingMaps] = useState<{ id: string; name: string }[]>([]);
  const [selectedMapId, setSelectedMapId] = useState<string>('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !organization?.id) return;
    (async () => {
      const { data } = await (supabase as any)
        .from('bidding_maps')
        .select('id, name')
        .eq('organization_id', organization.id)
        .order('created_at', { ascending: false });
      setExistingMaps(data || []);
    })();
  }, [open, organization?.id]);

  const handleSubmit = async () => {
    if (!organization?.id || !user?.id) return;
    if (mode === 'new' && !newName.trim()) {
      toast.error('Enter a name for the new Lane Strategy');
      return;
    }
    if (mode === 'existing' && !selectedMapId) {
      toast.error('Select an existing Lane Strategy');
      return;
    }

    setSaving(true);

    try {
      let mapId: string;

      if (mode === 'new') {
        const { data: newMap, error } = await (supabase as any)
          .from('bidding_maps')
          .insert({
            organization_id: organization.id,
            buy_list_id: buyListId,
            name: newName.trim(),
            mode: 'in_lane',
            created_by: user.id,
          })
          .select('id')
          .single();
        if (error || !newMap) throw new Error('Failed to create Lane Strategy');
        mapId = newMap.id;
      } else {
        mapId = selectedMapId;
      }

      const { data: rpcSuccess, error: rpcError } = await (supabase as any).rpc('add_vehicles_to_bid_map', {
        p_bidding_map_id: mapId,
        p_vehicle_ids: selectedVehicleIds,
      });

      if (rpcError) {
        console.error('Error invoking add_vehicles_to_bid_map RPC:', rpcError);
        throw new Error(rpcError.message || 'Failed to add vehicles');
      }

      toast.success(`${selectedVehicleIds.length} vehicle${selectedVehicleIds.length !== 1 ? 's' : ''} added to Lane Strategy`);
      onOpenChange(false);
      onComplete(mapId);
    } catch (err: any) {
      toast.error(err.message || 'Something went wrong');
    }

    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95%] sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Add to Lane Strategy
          </DialogTitle>
          <DialogDescription>
            Add {selectedVehicleIds.length} vehicle{selectedVehicleIds.length !== 1 ? 's' : ''} to a lane strategy.
          </DialogDescription>
        </DialogHeader>

        <RadioGroup value={mode} onValueChange={v => setMode(v as 'new' | 'existing')} className="space-y-3 my-2">
          <div className="flex items-center space-x-3 rounded-lg border p-4 cursor-pointer hover:bg-muted/30 transition-colors"
            onClick={() => setMode('new')}>
            <RadioGroupItem value="new" id="new" />
            <Label htmlFor="new" className="flex-1 cursor-pointer">
              <span className="font-medium flex items-center gap-1.5"><Plus className="h-4 w-4" /> Create New Lane Strategy</span>
              <span className="text-xs text-muted-foreground block mt-0.5">Start a fresh lane strategy with these vehicles</span>
            </Label>
          </div>
          <div className="flex items-center space-x-3 rounded-lg border p-4 cursor-pointer hover:bg-muted/30 transition-colors"
            onClick={() => setMode('existing')}>
            <RadioGroupItem value="existing" id="existing" />
            <Label htmlFor="existing" className="flex-1 cursor-pointer">
              <span className="font-medium">Add to Existing Lane Strategy</span>
              <span className="text-xs text-muted-foreground block mt-0.5">Append to a lane strategy you've already created</span>
            </Label>
          </div>
        </RadioGroup>

        {mode === 'new' && (
          <div className="space-y-2">
            <Label htmlFor="map-name">Lane Strategy Name</Label>
            <Input id="map-name" placeholder="e.g. Tuesday Manheim Sale" value={newName} onChange={e => setNewName(e.target.value)} />
          </div>
        )}

        {mode === 'existing' && (
          <div className="space-y-2">
            <Label>Select Lane Strategy</Label>
            {existingMaps.length === 0 ? (
              <p className="text-sm text-muted-foreground">No existing lane strategies found. Create a new one instead.</p>
            ) : (
              <Select value={selectedMapId} onValueChange={setSelectedMapId}>
                <SelectTrigger><SelectValue placeholder="Choose a lane strategy..." /></SelectTrigger>
                <SelectContent>
                  {existingMaps.map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving} className="gap-2">
            {saving ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : <MapPin className="h-4 w-4" />}
            {mode === 'new' ? 'Create & Add' : 'Add to Strategy'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddToBidMapDialog;
