import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { Users, UserX, ShieldCheck } from 'lucide-react';
import { fetchAllRows } from '@/lib/fetchAllRows';
import { usePagination } from '@/hooks/usePagination';
import TablePagination from '@/components/ui/TablePagination';

type AdminProfileRow = Database['public']['Tables']['profiles']['Row'];
type AdminUserRoleRow = Database['public']['Tables']['user_roles']['Row'];
type AdminOrganizationRow = Pick<Database['public']['Tables']['organizations']['Row'], 'id' | 'name'>;

interface AdminUserRow extends AdminProfileRow {
  role: string;
  orgName: string;
}

const log = logger('AdminUsers');

const AdminUsers = () => {
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const userPagination = usePagination(users, 50);

  useEffect(() => {
    const fetch = async () => {
      try {
        const [profiles, roles, orgs] = await Promise.all([
          fetchAllRows<AdminProfileRow>((from, to) => supabase.from('profiles').select('*').range(from, to)),
          fetchAllRows<AdminUserRoleRow>((from, to) => supabase.from('user_roles').select('*').range(from, to)),
          fetchAllRows<AdminOrganizationRow>((from, to) => supabase.from('organizations').select('id, name').range(from, to)),
        ]);

        const orgMap = Object.fromEntries(orgs.map((o) => [o.id, o.name]));
        const roleMap = Object.fromEntries(roles.map((r) => [r.user_id, r.role]));

        const merged: AdminUserRow[] = profiles.map((p) => ({
          ...p,
          role: roleMap[p.user_id] || 'none',
          orgName: p.organization_id ? orgMap[p.organization_id] || 'Unknown' : '—',
        }));

        setUsers(merged);
      } catch (err) {
        log.error('Failed to load users', err);
        toast.error('Failed to load users');
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
          <Users className="h-4 w-4 text-primary" /> All Users ({users.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Dealership</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {userPagination.pageItems.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.full_name || '—'}</TableCell>
                <TableCell className="text-muted-foreground">{u.email || '—'}</TableCell>
                <TableCell>
                  <Badge variant={u.role === 'admin' ? 'default' : 'outline'} className="text-xs capitalize">
                    {u.role === 'admin' && <ShieldCheck className="h-3 w-3 mr-1" />}
                    {u.role.replace('_', ' ')}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{u.orgName}</TableCell>
                <TableCell className="text-muted-foreground text-xs">{new Date(u.created_at).toLocaleDateString()}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" title="Disable User">
                    <UserX className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {users.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">No users found.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <TablePagination
          page={userPagination.page}
          totalPages={userPagination.totalPages}
          totalItems={userPagination.totalItems}
          pageSize={userPagination.pageSize}
          onPageChange={userPagination.setPage}
          onPageSizeChange={userPagination.setPageSize}
        />
      </CardContent>
    </Card>
  );
};

export default AdminUsers;
