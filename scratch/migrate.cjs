const { Client } = require('pg');

const projectRef = 'xzjeupbenyqkqoeuvxwy';
const password = 'SbxyOvJJUl0cDe5r';

async function run() {
  const host = 'aws-0-us-west-2.pooler.supabase.com';
  console.log(`Connecting to ${host}...`);
  
  const client = new Client({
    host,
    port: 6543,
    user: `postgres.${projectRef}`,
    password: password,
    database: 'postgres',
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected!');

    console.log('Creating vehicle_retail_values table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.vehicle_retail_values (
        id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        vin               VARCHAR(50)   NOT NULL,
        miles             INTEGER       NOT NULL,
        marketcheck_price INTEGER,
        price_mean        INTEGER,
        price_median      INTEGER,
        price_std_dev     NUMERIC(10,2),
        comparables_count INTEGER,
        fetched_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        dealer_zip        VARCHAR(10),
        api_status        VARCHAR(20)   DEFAULT 'success',
        avg_days_to_sell  INTEGER,
        market_day_supply INTEGER,
        UNIQUE (vin, miles)
      );
    `);

    console.log('Enabling RLS on vehicle_retail_values...');
    await client.query(`ALTER TABLE public.vehicle_retail_values ENABLE ROW LEVEL SECURITY;`).catch(() => {});

    console.log('Adding RLS policies for vehicle_retail_values...');
    await client.query(`
      CREATE POLICY "Allow authenticated users to read retail cache" ON public.vehicle_retail_values
        FOR SELECT TO authenticated USING (true);
    `).catch(() => {});
    await client.query(`
      CREATE POLICY "Allow authenticated users to insert retail cache" ON public.vehicle_retail_values
        FOR INSERT TO authenticated WITH CHECK (true);
    `).catch(() => {});
    await client.query(`
      CREATE POLICY "Allow authenticated users to update retail cache" ON public.vehicle_retail_values
        FOR UPDATE TO authenticated USING (true);
    `).catch(() => {});

    console.log('Creating vehicle_announcements table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.vehicle_announcements (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        run_list_id     UUID NOT NULL REFERENCES public.auction_run_lists(id) ON DELETE CASCADE,
        vin             VARCHAR(50) NOT NULL,
        source          VARCHAR(20) NOT NULL,
        raw_text        TEXT,
        detected_flags  TEXT[] DEFAULT '{}',
        confirmed_flags TEXT[] DEFAULT '{}',
        dismissed_flags TEXT[] DEFAULT '{}',
        created_at      TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (run_list_id, vin)
      );
    `);

    console.log('Enabling RLS on vehicle_announcements...');
    await client.query(`ALTER TABLE public.vehicle_announcements ENABLE ROW LEVEL SECURITY;`).catch(() => {});

    console.log('Adding RLS policies for vehicle_announcements...');
    await client.query(`
      CREATE POLICY "Allow authenticated users to read announcements" ON public.vehicle_announcements
        FOR SELECT TO authenticated USING (true);
    `).catch(() => {});
    await client.query(`
      CREATE POLICY "Allow authenticated users to insert announcements" ON public.vehicle_announcements
        FOR INSERT TO authenticated WITH CHECK (true);
    `).catch(() => {});
    await client.query(`
      CREATE POLICY "Allow authenticated users to update announcements" ON public.vehicle_announcements
        FOR UPDATE TO authenticated USING (true);
    `).catch(() => {});
    await client.query(`
      CREATE POLICY "Allow authenticated users to delete announcements" ON public.vehicle_announcements
        FOR DELETE TO authenticated USING (true);
    `).catch(() => {});

    console.log('Adding is_bank_lendable column to auction_vehicles...');
    await client.query(`
      ALTER TABLE public.auction_vehicles ADD COLUMN IF NOT EXISTS is_bank_lendable BOOLEAN DEFAULT FALSE;
    `);

    console.log('All migrations executed successfully!');

  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await client.end();
  }
}

run();
