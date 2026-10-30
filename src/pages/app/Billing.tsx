import PageHeader from '@/components/app/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CreditCard, Calendar, FileText } from 'lucide-react';

const invoices = [
  { date: 'Feb 1, 2025', amount: '$199', status: 'Paid' },
  { date: 'Jan 1, 2025', amount: '$199', status: 'Paid' },
  { date: 'Dec 1, 2024', amount: '$199', status: 'Paid' },
];

const Billing = () => (
  <div className="space-y-6">
    <PageHeader title="Billing" breadcrumbs={[{ label: 'LogicLot', href: '/app/dashboard' }, { label: 'Billing' }]} />
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-heading">Current Plan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-heading font-semibold text-foreground">Pro Plan</h4>
              <Badge className="bg-primary text-primary-foreground">Active</Badge>
            </div>
            <p className="text-2xl font-bold text-foreground">$199<span className="text-sm font-normal text-muted-foreground">/month</span></p>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><Calendar className="h-3 w-3" /> Next billing: March 1, 2025</p>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg border border-border">
            <CreditCard className="h-5 w-5 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">Visa ending 4242</p>
              <p className="text-xs text-muted-foreground">Expires 12/26</p>
            </div>
            <Button variant="outline" size="sm" className="text-xs">Update</Button>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-heading">Invoices</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {invoices.map((inv, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-3">
                  <FileText className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-sm font-medium text-foreground">{inv.amount}</p>
                    <p className="text-xs text-muted-foreground">{inv.date}</p>
                  </div>
                </div>
                <Badge variant="outline" className="border-green-300 bg-green-50 text-green-700 text-[10px]">{inv.status}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
);

export default Billing;
