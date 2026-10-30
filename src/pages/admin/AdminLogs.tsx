import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollText, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

const mockLogs = [
  { id: '1', event: 'User signup', severity: 'info', detail: 'new_user@example.com registered', timestamp: new Date().toISOString() },
  { id: '2', event: 'Upload failed', severity: 'error', detail: 'File parsing error for DMS export', timestamp: new Date(Date.now() - 3600000).toISOString() },
  { id: '3', event: 'AI processing complete', severity: 'info', detail: 'Generated 5 insights for Test Motors', timestamp: new Date(Date.now() - 7200000).toISOString() },
  { id: '4', event: 'RLS policy denied', severity: 'warning', detail: 'Unauthorized access attempt on auction_vehicles', timestamp: new Date(Date.now() - 10800000).toISOString() },
];

const severityIcon = (s: string) => {
  if (s === 'error') return <XCircle className="h-3.5 w-3.5 text-destructive" />;
  if (s === 'warning') return <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground" />;
  return <CheckCircle className="h-3.5 w-3.5 text-primary" />;
};

const AdminLogs = () => {
  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader>
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <ScrollText className="h-4 w-4 text-primary" /> System Logs
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {mockLogs.map((log) => (
            <div key={log.id} className="flex items-start gap-3 py-2.5 border-b border-border/40 last:border-0">
              {severityIcon(log.severity)}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{log.event}</p>
                  <Badge variant="outline" className="text-[10px] capitalize">{log.severity}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{log.detail}</p>
              </div>
              <p className="text-xs text-muted-foreground whitespace-nowrap">{new Date(log.timestamp).toLocaleTimeString()}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-4">Live system logs will populate once event tracking is fully configured.</p>
      </CardContent>
    </Card>
  );
};

export default AdminLogs;
