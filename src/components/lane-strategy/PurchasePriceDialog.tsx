import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DollarSign } from 'lucide-react';

interface PurchasePriceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicleLabel: string;
  onConfirm: (price: number) => void;
}

export const PurchasePriceDialog = ({ open, onOpenChange, vehicleLabel, onConfirm }: PurchasePriceDialogProps) => {
  const [price, setPrice] = useState('');

  const handleConfirm = () => {
    const parsed = parseFloat(price.replace(/[^0-9.]/g, ''));
    if (isNaN(parsed) || parsed <= 0) return;
    onConfirm(parsed);
    setPrice('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95%] sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-emerald-600" /> Enter Purchase Price
          </DialogTitle>
          <DialogDescription>{vehicleLabel}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label htmlFor="purchase-price">Purchase Price</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
            <Input
              id="purchase-price"
              type="text"
              inputMode="decimal"
              placeholder="0"
              className="pl-7 tabular-nums"
              value={price}
              onChange={e => setPrice(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleConfirm()}
              autoFocus
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleConfirm} className="bg-emerald-600 hover:bg-emerald-700">Confirm Purchase</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
