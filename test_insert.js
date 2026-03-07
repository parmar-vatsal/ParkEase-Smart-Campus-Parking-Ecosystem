import fs from 'fs';

const env = fs.readFileSync('.env', 'utf-8');
const url = env.split('\n').find(line => line.startsWith('VITE_SUPABASE_URL=')).split('=')[1].trim().replace(/['"]/g, '');
const key = env.split('\n').find(line => line.startsWith('VITE_SUPABASE_ANON_KEY=')).split('=')[1].trim().replace(/['"]/g, '');

const userId = "8910efca-2c30-4715-8f19-d148e3f570b1"; // User ID of vatsal
const department = "Artificial Intelligence & Data Science";

async function loginAndInsert() {
    console.log("Logging in as user...");
    const authRes = await fetch(`${url}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': key },
        body: JSON.stringify({ email: 'vatsalparmar.aids23@scet.ac.in', password: '123456' })
    });

    const authData = await authRes.json();
    const token = authData.access_token;

    if (!token) {
        console.log("Failed login", authData);
        return;
    }

    // Test the exact queries in VehicleRegister.jsx handleSubmit
    console.log("Checking zones for department...");
    const zoneRes = await fetch(`${url}/rest/v1/parkease_zone_departments?department_code=eq.${encodeURIComponent(department)}&select=zone_id`, {
        headers: { 'apikey': key, 'Authorization': `Bearer ${token}` }
    });
    const zoneData = await zoneRes.json();
    console.log("Zone Dept Result:", zoneData);

    let allocatedZoneId = null;
    if (zoneData.length > 0) {
        allocatedZoneId = zoneData[0].zone_id;
    } else {
        console.log("Fallback fetching active zones...");
        const anyZoneRes = await fetch(`${url}/rest/v1/parkease_zones?status=eq.active&select=id&limit=1`, {
            headers: { 'apikey': key, 'Authorization': `Bearer ${token}` }
        });
        const anyZoneData = await anyZoneRes.json();
        console.log("Any Zone Result:", anyZoneData);
        if (anyZoneData.length > 0) allocatedZoneId = anyZoneData[0].id;
    }

    console.log("Allocated Zone ID:", allocatedZoneId);

    const max_val = Math.floor(Math.random() * 9000) + 1000;
    const body = {
        owner_id: userId,
        vehicle_number: `GJ05XX${max_val}`,
        vehicle_type: 'two_wheeler',
        brand: 'Honda',
        model: 'Activa',
        color: 'Black',
    };
    if (allocatedZoneId) body.allocated_zone_id = allocatedZoneId;

    console.log("Inserting vehicle payload:", body);

    const insertRes = await fetch(`${url}/rest/v1/parkease_vehicles`, {
        method: 'POST',
        headers: {
            'apikey': key,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        },
        body: JSON.stringify(body)
    });

    if (insertRes.ok) {
        const insertData = await insertRes.json();
        console.log("Success Insert!", insertData);
    } else {
        const insertTxt = await insertRes.text();
        console.log("Insert Failed! HTTP Status:", insertRes.status);
        console.log("Insert Error text:", insertTxt);
    }
}

loginAndInsert();
