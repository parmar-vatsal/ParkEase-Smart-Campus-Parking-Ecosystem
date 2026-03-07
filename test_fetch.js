import fs from 'fs';

const env = fs.readFileSync('.env', 'utf-8');
const url = env.split('\n').find(line => line.startsWith('VITE_SUPABASE_URL=')).split('=')[1].trim().replace(/['"]/g, '');
const key = env.split('\n').find(line => line.startsWith('VITE_SUPABASE_ANON_KEY=')).split('=')[1].trim().replace(/['"]/g, '');

async function check() {
    const authRes = await fetch(`${url}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': key },
        body: JSON.stringify({ email: 'vatsalparmar.aids23@scet.ac.in', password: '123456' })
    });

    const authData = await authRes.json();
    const token = authData.access_token;

    const profRes = await fetch(`${url}/rest/v1/parkease_profiles?id=eq.${authData.user.id}&select=*`, {
        headers: { 'apikey': key, 'Authorization': `Bearer ${token}` }
    });

    const profData = await profRes.json();
    fs.writeFileSync('user_profile_debug.json', JSON.stringify(profData, null, 2));
}

check();
