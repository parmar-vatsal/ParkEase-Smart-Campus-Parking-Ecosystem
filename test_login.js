const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUser() {
    console.log("Attempting login...");
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: 'vatsalparmar.aids23@scet.ac.in',
        password: '123456'
    });

    if (authError) {
        console.error("Login failed:", authError.message);
        return;
    }

    console.log("Logged in! User ID:", authData.user.id);

    // Fetch their profile!
    const { data: profile, error: profError } = await supabase
        .from('parkease_profiles')
        .select('*')
        .eq('id', authData.user.id)
        .single();

    console.log("Profile Data:", profile);
    if (profError) {
        console.error("Profile Error:", profError);
    }

    // Also quickly test fetching vehicles just in case there is a DB error there
    const { data: vehicles, error: vehErr } = await supabase
        .from('parkease_vehicles')
        .select('*')
        .eq('owner_id', authData.user.id);

    console.log("Vehicles count:", vehicles?.length);
    if (vehErr) {
        console.error("Vehicles fetch error:", vehErr);
    }
}

checkUser();
