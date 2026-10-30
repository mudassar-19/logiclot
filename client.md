# LogicLot.ai — Project Handover & Supabase Setup Checklist

To migrate the database schema and deploy edge functions to your Supabase project (`xzjeupbenyqkqoeuvxwy`), we need two quick details from you.

Please follow the steps below to retrieve and send them to us:

---

## 📋 Action Items

### Provide Access Token & Connection Pooler Host
If you prefer not to invite us as a project member, please provide these two items:

#### Item 1: Personal Access Token
1. In the Supabase Dashboard, click your profile icon in the top right corner → **Account Settings** → **Access Tokens**.
2. Click **Generate new token**.
3. Name it `LogicLot Deployment` and click **Generate**.
4. Copy the generated token (it starts with `sbp_...`) and send it to us securely.

#### Item 2: Database Connection Pooler Host
Because your database direct hostname resolves to IPv6 only, we must connect using the IPv4 Session pooler:
1. Open your Supabase project at `https://supabase.com/dashboard/project/xzjeupbenyqkqoeuvxwy`.
2. Click the **Connect** button at the top of the page.
3. In the modal that opens, click the **Connection Pooler** (or **Transaction Pooler**) tab.
4. Set the mode to **Session** (using port `5432`).
5. Copy the host address shown (it looks like: `aws-0-us-east-1.pooler.supabase.com`) and send it to us.

---
