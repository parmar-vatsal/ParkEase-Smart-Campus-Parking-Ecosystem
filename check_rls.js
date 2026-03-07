import pg from 'pg';
import fs from 'fs';

// Read .env file manually
const env = fs.readFileSync('.env', 'utf-8');
const connectionString = env.split('\n').find(line => line.startsWith('DATABASE_URL=')).split('=')[1].trim().replace(/"/g, '');

const pool = new pg.Pool({
    connectionString: connectionString,
});

async function query() {
    try {
        const res = await pool.query(`
            SELECT pol.policyname, pol.permissive, pol.roles, pol.cmd, pol.qual, pol.with_check 
            FROM pg_policies pol 
            WHERE pol.schemaname = 'public' AND pol.tablename = 'parkease_vehicles';
        `);
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        pool.end();
    }
}

query();
