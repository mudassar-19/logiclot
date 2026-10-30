import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { HardDrive } from 'lucide-react';

type AdminRunListRow = Database['public']['Tables']['auction_run_lists']['Row'];
type AdminOrganizationRow = Pick<Database['public']['Tables']['organizations']['Row'], 'id' | 'name'>;

interface AdminRunListWithOrg extends AdminRunListRow {
  orgName: string;
  total_vehicles?: number | null;
}

const log = logger('AdminData');

const AdminData = () => {
  const [runLists, setRunLists] = useState<AdminRunListWithOrg[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const [rlRes, orgsRes] = await Promise.all([
          supabase.from('auction_run_lists').select('*').order('created_at', { ascending: false }).limit(50),
          supabase.from('organizations').select('id, name'),
        ]);

        if (rlRes.error) throw rlRes.error;
        if (orgsRes.error) throw orgsRes.error;

        const orgs: AdminOrganizationRow[] = orgsRes.data ?? [];
        const runListRows: AdminRunListRow[] = rlRes.data ?? [];
        const orgMap = Object.fromEntries(orgs.map((o) => [o.id, o.name]));

        const merged: AdminRunListWithOrg[] = runListRows.map((d) => ({
          ...d,
          orgName: orgMap[d.organization_id] || 'Unknown',
        }));

        setRunLists(merged);
      } catch (err) {
        log.error('Failed to load run list data', err);
        toast.error('Failed to load run list data');
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader>
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <HardDrive className="h-4 w-4 text-primary" /> Run List Uploads ({runLists.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Dealership</TableHead>
              <TableHead>File</TableHead>
              <TableHead>Vehicles</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Uploaded</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {runLists.map((d) => (
              <TableRow key={d.id}>
                <TableCell className="font-medium">{d.orgName}</TableCell>
                <TableCell className="text-muted-foreground text-xs">{d.file_name || d.file_path || '—'}</TableCell>
                <TableCell>{d.total_vehicles ?? '—'}</TableCell>
                <TableCell><Badge variant="outline" className="text-xs">{d.status || 'unknown'}</Badge></TableCell>
                <TableCell className="text-muted-foreground text-xs">{new Date(d.created_at).toLocaleDateString()}</TableCell>
              </TableRow>
            ))}
            {runLists.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">No run list uploads found.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default AdminData;
