require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { generateSeedDataset } = require('./seed-data-generator');

async function upsertInBatches(supabase, table, rows, batchSize = 500) {
  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize);
    const { error } = await supabase.from(table).upsert(chunk, { onConflict: 'id' });
    if (error) {
      throw new Error(`Failed upserting into ${table} (batch ${i}): ${error.message}`);
    }
  }
}

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!url || !key || url.includes('your-project-ref')) {
    console.error('Error: Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY) in .env before running seed:supabase.');
    process.exit(1);
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const dataset = generateSeedDataset();

  console.log(`Seeding Supabase project at ${url} for "${dataset.shop.name}"...`);

  await upsertInBatches(supabase, 'shops', [dataset.shop]);
  await upsertInBatches(supabase, 'departments', dataset.departments);
  await upsertInBatches(supabase, 'employees', dataset.employees);
  await upsertInBatches(supabase, 'sales_records', dataset.sales_records);
  await upsertInBatches(supabase, 'attendance_records', dataset.attendance_records);
  await upsertInBatches(supabase, 'customer_feedback', dataset.customer_feedback);
  await upsertInBatches(supabase, 'recognitions', dataset.recognitions);
  await upsertInBatches(supabase, 'reward_recommendations', dataset.reward_recommendations);
  await upsertInBatches(supabase, 'scoring_settings', [dataset.scoring_settings]);

  console.log('Supabase seed completed successfully!');
  console.log(`Employees: ${dataset.employees.length}, Sales: ${dataset.sales_records.length}, Attendance: ${dataset.attendance_records.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

