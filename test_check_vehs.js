import fs from 'fs';

const env = fs.readFileSync('.env', 'utf-8');
const url = env.split('\n').find(line => line.startsWith('VITE_SUPABASE_URL=')).split('=')[1].trim().replace(/['"]/g, '');
const key = env.split('\n').find(line => line.startsWith('VITE_SUPABASE_ANON_KEY=')).split('=')[1].trim().replace(/['"]/g, '');

const userId = "8910efca-2c30-4715-8f19-d148e3f570b1"; // User ID of vatsal

async function checkVehs() {
    const authRes = await fetch(`${url}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': key },
        body: JSON.stringify({ email: 'vatsalparmar.aids23@scet.ac.in', password: '123456' })
    });

    const authData = await authRes.json();
    const token = authData.access_token;

    const res = await fetch(`${url}/rest/v1/parkease_vehicles?owner_id=eq.${userId}&select=*`, {
        headers: { 'apikey': key, 'Authorization': `Bearer ${token}` }
    });

    const data = await res.json();
    console.log("Vehicles for user:", data.length);
    console.log(data);
}

checkVehs();
