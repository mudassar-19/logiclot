import PageHeader from '@/components/app/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, Plus, Mail } from 'lucide-react';

const users = [
  { name: 'John Smith', email: 'john@dealer.com', role: 'Admin', status: 'Active' },
  { name: 'Sarah Johnson', email: 'sarah@dealer.com', role: 'Manager', status: 'Active' },
  { name: 'Mike Davis', email: 'mike@dealer.com', role: 'Viewer', status: 'Pending' },
];

const UsersAccess = () => (
  <div className="space-y-6">
    <PageHeader title="Users & Access" breadcrumbs={[{ label: 'LogicLot', href: '/app/dashboard' }, { label: 'Users & Access' }]} />
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-heading">Team Members</CardTitle>
            <CardDescription>Manage who has access to your dealership dashboard</CardDescription>
          </div>
          <Button size="sm" className="bg-primary text-primary-foreground"><Plus className="h-4 w-4 mr-1.5" /> Invite User</Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {['Name', 'Email', 'Role', 'Status', ''].map(h => (
                  <th key={h} className="text-left py-3 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u, idx) => (
                <tr key={idx} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                  <td className="py-3 px-3 font-medium text-foreground">{u.name}</td>
                  <td className="py-3 px-3 text-muted-foreground">{u.email}</td>
                  <td className="py-3 px-3"><Badge variant="outline">{u.role}</Badge></td>
                  <td className="py-3 px-3">
                    <Badge variant="outline" className={u.status === 'Active' ? 'border-green-300 bg-green-50 text-green-700' : 'border-amber-300 bg-amber-50 text-amber-700'}>
                      {u.status}
                    </Badge>
                  </td>
                  <td className="py-3 px-3">
                    {u.status === 'Pending' && (
                      <Button variant="ghost" size="sm" className="text-xs"><Mail className="h-3.5 w-3.5 mr-1" /> Resend</Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  </div>
);

export default UsersAccess;
