import pg from 'pg';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf-8');
const connectionString = env.split('\n').find(line => line.startsWith('DATABASE_URL=')).split('=')[1].trim().replace(/"/g, '');

const pool = new pg.Pool({ connectionString });

async function checkUser() {
    try {
        const res = await pool.query(`
            SELECT id, email, role, department 
            FROM parkease_profiles 
            WHERE email = 'vatsalparmar.aids23@scet.ac.in';
        `);
        console.log("User Profile:", JSON.stringify(res.rows, null, 2));

        if (res.rows.length === 0) {
            console.log("User not found in profiles table.");
        } else if (!res.rows[0].role) {
            console.log("Role is null! This causes an infinite redirect loop.");
            // Fix it
            await pool.query(`UPDATE parkease_profiles SET role = 'student' WHERE id = $1`, [res.rows[0].id]);
            console.log("Role updated to 'student'.");
        }
    } catch (err) {
        console.error(err);
    } finally {
        pool.end();
    }
}

checkUser();
