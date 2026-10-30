import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Upload, FileSpreadsheet, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface UploadRecord {
  id: string;
  file_name: string;
  created_at: string;
}

const SalesHistoryUpload = () => {
  const { organization, user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploads, setUploads] = useState<UploadRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!organization?.id) return;
    const load = async () => {
      const { data } = await (supabase as any)
        .from('sales_history_uploads')
        .select('id, file_name, created_at')
        .eq('organization_id', organization.id)
        .order('created_at', { ascending: false });
      if (data) setUploads(data);
      setLoading(false);
    };
    load();
  }, [organization?.id]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !organization?.id) return;

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['csv', 'xlsx', 'xls'].includes(ext || '')) {
      toast.error('Please upload a CSV or Excel file');
      return;
    }

    setUploading(true);
    const path = `${organization.id}/${Date.now()}_${file.name}`;

    const { error: storageErr } = await supabase.storage
      .from('sales-history')
      .upload(path, file);

    if (storageErr) {
      toast.error('Upload failed');
      setUploading(false);
      return;
    }

    const { data, error: dbErr } = await (supabase as any)
      .from('sales_history_uploads')
      .insert({
        organization_id: organization.id,
        file_name: file.name,
        file_path: path,
        uploaded_by: user?.id,
      })
      .select('id, file_name, created_at')
      .single();

    // Also update dealer_preferences with the file path and parse status
    await supabase
      .from('dealer_preferences')
      .upsert({
        organization_id: organization.id,
        sales_history_file_path: path,
        sales_history_parse_status: 'pending',
      }, { onConflict: 'organization_id' });

    setUploading(false);
    if (dbErr) {
      toast.error('Failed to record upload');
    } else {
      toast.success('Sales history uploaded');
      setUploads(prev => [data, ...prev]);
    }

    if (fileRef.current) fileRef.current.value = '';
  };

  const handleDelete = async (upload: UploadRecord) => {
    await (supabase as any).from('sales_history_uploads').delete().eq('id', upload.id);
    setUploads(prev => prev.filter(u => u.id !== upload.id));
    toast.success('Removed');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5 text-primary" /> Sales History
        </CardTitle>
        <CardDescription>
          Upload your last 3 months of sales history so our AI can recommend vehicles similar to what your store sells best.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => fileRef.current?.click()}
        >
          {uploading ? (
            <Loader2 className="h-8 w-8 mx-auto animate-spin text-primary" />
          ) : (
            <>
              <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm font-medium">Click to upload sales history</p>
              <p className="text-xs text-muted-foreground mt-1">CSV or Excel (.xlsx, .xls)</p>
            </>
          )}
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={handleUpload}
          />
        </div>

        {!loading && uploads.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground font-medium">Uploaded Files</p>
            {uploads.map(u => (
              <div key={u.id} className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{u.file_name}</span>
                  <Badge variant="outline" className="text-xs">
                    {new Date(u.created_at).toLocaleDateString()}
                  </Badge>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(u)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SalesHistoryUpload;
