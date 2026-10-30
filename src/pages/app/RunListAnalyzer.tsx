import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Upload, FileSpreadsheet, Trash2, Map, AlertTriangle, StickyNote } from 'lucide-react';
import * as XLSX from 'xlsx';

interface Vehicle {
  id: string;
  vin: string;
  year: number;
  make: string;
  model: string;
  mileage: number;
  lane_number: number;
  run_order: number;
  cr_score: number | null;
  estimated_retail_value: number;
  estimated_recon_cost: number;
  estimated_profit: number;
  recommended_max_bid: number;
  in_buy_list: boolean;
  dealer_notes: string;
  dealer_max_bid_override: number | null;
}

type SpreadsheetCell = string | number | null | undefined;
type SpreadsheetRow = Record<string, SpreadsheetCell>;
type RunListInsert = Database['public']['Tables']['run_lists']['Insert'];
type RunListVehicleInsert = Database['public']['Tables']['run_list_vehicles']['Insert'];

const cellToString = (value: SpreadsheetCell) => value == null ? '' : String(value);
const cellToInt = (value: SpreadsheetCell, fallback = 0) => {
  const parsed = parseInt(cellToString(value), 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};
const cellToFloatOrNull = (value: SpreadsheetCell) => {
  const text = cellToString(value).trim();
  if (!text) return null;
  const parsed = parseFloat(text);
  return Number.isNaN(parsed) ? null : parsed;
};

const fmt = (n: number) => `$${n.toLocaleString()}`;

const RunListAnalyzer = () => {
  const { organization } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [allParsed, setAllParsed] = useState<Vehicle[]>([]);
  const [uploading, setUploading] = useState(false);
  const [runListName, setRunListName] = useState('');
  const [editingNote, setEditingNote] = useState<string | null>(null);

  const parseFile = useCallback(async (file: File) => {
    setUploading(true);
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<SpreadsheetRow>(ws, { defval: '' });

      // Map columns flexibly
      const parsed: Vehicle[] = rows.map((row, i) => {
        const vin = cellToString(row.VIN || row.vin || row.Vin);
        const year = cellToInt(row.Year || row.year || row.YEAR);
        const make = cellToString(row.Make || row.make || row.MAKE);
        const model = cellToString(row.Model || row.model || row.MODEL);
        const mileage = cellToInt(row.Mileage || row.mileage || row.Miles || row.MILEAGE);
        const lane = cellToInt(row['Lane Number'] || row.Lane || row.lane || row.LANE);
        const runOrder = cellToInt(row['Run Order'] || row['Run #'] || row.Run || row.run_order, i + 1);
        const crRaw = row['CR Score'] || row.CR || row.cr_score || row['Condition Report'];
        const cr = cellToFloatOrNull(crRaw);

        // Simulate AI estimates (in production, this would call an edge function)
        const estRetail = 15000 + Math.round(Math.random() * 25000);
        const estRecon = 500 + Math.round(Math.random() * 3000);
        const estProfit = Math.round(estRetail * 0.12);
        const maxBid = estRetail - estRecon - estProfit;

        return {
          id: crypto.randomUUID(),
          vin, year, make, model, mileage,
          lane_number: lane,
          run_order: runOrder,
          cr_score: cr,
          estimated_retail_value: estRetail,
          estimated_recon_cost: estRecon,
          estimated_profit: estProfit,
          recommended_max_bid: maxBid,
          in_buy_list: true,
          dealer_notes: '',
          dealer_max_bid_override: null,
        };
      });

      setAllParsed(parsed);
      // Filter based on preferences would happen here; for now show all
      setVehicles(parsed.filter(v => v.in_buy_list));
      setRunListName(file.name.replace(/\.(csv|xlsx|xls)$/i, ''));
      toast.success(`Parsed ${parsed.length} vehicles`);
    } catch (err) {
      toast.error('Failed to parse file. Ensure it is a valid CSV or Excel file.');
    }
    setUploading(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) parseFile(file);
  }, [parseFile]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) parseFile(file);
  };

  const removeFromBuyList = (id: string) => {
    setVehicles(prev => prev.filter(v => v.id !== id));
  };

  const updateNote = (id: string, note: string) => {
    setVehicles(prev => prev.map(v => v.id === id ? { ...v, dealer_notes: note } : v));
    setEditingNote(null);
  };

  const updateMaxBid = (id: string, bid: number) => {
    setVehicles(prev => prev.map(v => v.id === id ? { ...v, dealer_max_bid_override: bid } : v));
  };

  const saveBuyList = async () => {
    if (!organization?.id) return;
    // Save run list to DB
    const runListInsert: RunListInsert = {
      organization_id: organization.id,
      name: runListName || 'Run List',
      status: 'analyzed',
    };
    const { data: rl, error: rlErr } = await supabase
      .from('run_lists')
      .insert(runListInsert)
      .select('id')
      .single<{ id: string }>();
    if (rlErr || !rl) { toast.error('Failed to save run list'); return; }
    const runListId = rl.id;

    const rows: RunListVehicleInsert[] = vehicles.map(v => ({
      run_list_id: runListId,
      organization_id: organization.id,
      vin: v.vin, year: v.year, make: v.make, model: v.model,
      mileage: v.mileage, lane_number: v.lane_number, run_order: v.run_order,
      cr_score: v.cr_score, estimated_retail_value: v.estimated_retail_value,
      estimated_recon_cost: v.estimated_recon_cost, estimated_profit: v.estimated_profit,
      recommended_max_bid: v.dealer_max_bid_override || v.recommended_max_bid,
      in_buy_list: true, dealer_notes: v.dealer_notes,
      dealer_max_bid_override: v.dealer_max_bid_override,
    }));

    const { error } = await supabase.from('run_list_vehicles').insert(rows);
    if (error) { toast.error('Failed to save vehicles'); return; }
    toast.success('Buy list saved! Navigate to Bidding Map.');
  };

  return (
    <div className="space-y-6">
      {/* Upload zone */}
      {vehicles.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              Upload Auction Run List
            </CardTitle>
            <CardDescription>Upload a CSV or Excel file with your auction run list.</CardDescription>
          </CardHeader>
          <CardContent>
            <div
              onDragOver={e => e.preventDefault()}
              onDrop={handleDrop}
              className="border-2 border-dashed border-border rounded-2xl p-12 text-center cursor-pointer hover:border-primary/40 transition-colors"
              onClick={() => document.getElementById('run-list-input')?.click()}
            >
              <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
              <p className="text-sm text-muted-foreground mb-1">Drag & drop or click to upload</p>
              <p className="text-xs text-muted-foreground">Supports CSV, XLS, XLSX</p>
              <input
                id="run-list-input"
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>
            {uploading && (
              <div className="flex items-center justify-center mt-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                <span className="ml-2 text-sm text-muted-foreground">Parsing...</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Buy List */}
      {vehicles.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-foreground">{runListName || 'Run List'}</h2>
              <p className="text-sm text-muted-foreground">{vehicles.length} vehicles in buy list (from {allParsed.length} total)</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setVehicles([]); setAllParsed([]); }}>
                Upload New
              </Button>
              <Button onClick={saveBuyList} className="gap-2">
                <Map className="h-4 w-4" />
                Build Bidding Map
              </Button>
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Lane</TableHead>
                      <TableHead className="w-16">Run #</TableHead>
                      <TableHead>Vehicle</TableHead>
                      <TableHead className="w-20">CR</TableHead>
                      <TableHead className="text-right">Mileage</TableHead>
                      <TableHead className="text-right">Est. Retail</TableHead>
                      <TableHead className="text-right">Recon</TableHead>
                      <TableHead className="text-right">Profit</TableHead>
                      <TableHead className="text-right">Max Bid</TableHead>
                      <TableHead className="w-20">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vehicles
                      .sort((a, b) => a.lane_number - b.lane_number || a.run_order - b.run_order)
                      .map(v => (
                        <TableRow key={v.id}>
                          <TableCell className="font-medium">{v.lane_number}</TableCell>
                          <TableCell>{v.run_order}</TableCell>
                          <TableCell>
                            <div>
                              <span className="font-medium">{v.year} {v.make} {v.model}</span>
                              <span className="text-xs text-muted-foreground block">{v.vin}</span>
                              {v.cr_score === null && (
                                <span className="text-xs text-amber-600 flex items-center gap-1 mt-0.5">
                                  <AlertTriangle className="h-3 w-3" />
                                  CR unavailable — inspect before bidding
                                </span>
                              )}
                              {v.dealer_notes && (
                                <span className="text-xs text-primary flex items-center gap-1 mt-0.5">
                                  <StickyNote className="h-3 w-3" /> {v.dealer_notes}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {v.cr_score !== null ? (
                              <Badge variant={v.cr_score >= 3 ? 'default' : 'secondary'}>{v.cr_score.toFixed(1)}</Badge>
                            ) : (
                              <Badge variant="outline">N/A</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{v.mileage.toLocaleString()}</TableCell>
                          <TableCell className="text-right tabular-nums">{fmt(v.estimated_retail_value)}</TableCell>
                          <TableCell className="text-right tabular-nums">{fmt(v.estimated_recon_cost)}</TableCell>
                          <TableCell className="text-right tabular-nums text-emerald-600 font-medium">{fmt(v.estimated_profit)}</TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              className="w-24 text-right text-sm h-8 ml-auto"
                              defaultValue={v.dealer_max_bid_override || v.recommended_max_bid}
                              onBlur={e => updateMaxBid(v.id, +e.target.value)}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost" size="icon" className="h-7 w-7"
                                onClick={() => setEditingNote(editingNote === v.id ? null : v.id)}
                              >
                                <StickyNote className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                                onClick={() => removeFromBuyList(v.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                            {editingNote === v.id && (
                              <div className="absolute mt-1 z-10 bg-card border rounded-lg p-2 shadow-lg w-64">
                                <Textarea
                                  placeholder="Add note..."
                                  defaultValue={v.dealer_notes}
                                  rows={2}
                                  className="text-xs"
                                  onBlur={e => updateNote(v.id, e.target.value)}
                                />
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default RunListAnalyzer;
