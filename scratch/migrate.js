const { Client } = require('pg');

const client = new Client({
  host: 'db.xzjeupbenyqkqoeuvxwy.supabase.co',
  port: 5432,
  user: 'postgres',
  password: 'SbxyOvJJUl0cDe5r',
  database: 'postgres',
  ssl: {
    rejectUnauthorized: false
  }
});

async function run() {
  try {
    await client.connect();
    console.log('Connected to Supabase Postgres database successfully.');

    console.log('Altering vehicle_retail_values table...');
    await client.query(`
      ALTER TABLE public.vehicle_retail_values 
      ADD COLUMN IF NOT EXISTS avg_days_to_sell INTEGER;
    `);
    await client.query(`
      ALTER TABLE public.vehicle_retail_values 
      ADD COLUMN IF NOT EXISTS market_day_supply INTEGER;
    `);

    console.log('Columns added successfully (or already existed).');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
