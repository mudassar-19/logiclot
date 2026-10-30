import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { Building2, Eye, Pencil, Trash2 } from 'lucide-react';

type AdminDealershipRow = Database['public']['Tables']['organizations']['Row'] & {
  market_size?: string | null;
  onboarding_completed?: boolean | null;
};

const log = logger('AdminDealerships');

const AdminDealerships = () => {
  const [orgs, setOrgs] = useState<AdminDealershipRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const { data, error } = await supabase
          .from('organizations')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) throw error;
        setOrgs((data ?? []) as AdminDealershipRow[]);
      } catch (err) {
        log.error('Failed to load dealerships', err);
        toast.error('Failed to load dealerships');
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this dealership and all associated data?')) return;
    const { error } = await supabase.from('organizations').delete().eq('id', id);
    if (error) {
      log.error('Failed to delete dealership', error);
      toast.error('Failed to delete dealership');
      return;
    }
    log.info('Dealership deleted', id);
    toast.success('Dealership deleted successfully');
    setOrgs(prev => prev.filter(o => o.id !== id));
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader>
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Building2 className="h-4 w-4 text-primary" /> All Dealerships ({orgs.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Market Size</TableHead>
              <TableHead>Onboarding</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orgs.map((org) => (
              <TableRow key={org.id}>
                <TableCell className="font-medium">{org.name}</TableCell>
                <TableCell className="text-muted-foreground">{[org.city, org.state].filter(Boolean).join(', ') || '—'}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs capitalize">{org.market_size?.replace('_', ' ') || 'N/A'}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={org.onboarding_completed ? 'default' : 'secondary'} className="text-xs">
                    {org.onboarding_completed ? 'Complete' : 'Pending'}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">{new Date(org.created_at).toLocaleDateString()}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" title="View Dashboard">
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" title="Edit">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" title="Delete" onClick={() => handleDelete(org.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {orgs.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">No dealerships found.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default AdminDealerships;
