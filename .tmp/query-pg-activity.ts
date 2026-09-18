import { Client } from 'pg';
async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const res = await client.query(`select pid, state, wait_event_type, wait_event, query from pg_stat_activity where datname = current_database() and state <> 'idle' order by query_start asc`);
  console.log(JSON.stringify(res.rows, null, 2));
  await client.end();
}
main().catch((e)=>{console.error(e); process.exit(1)});
