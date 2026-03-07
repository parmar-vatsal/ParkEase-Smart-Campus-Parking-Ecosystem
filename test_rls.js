import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkPolicies() {
    // To check policies, we need to query pg_policies.
    // The anon key might not have access to pg_policies.
    // Let's try inserting a dummy vehicle to see the error.

    // First, let's login as a test student if possible.
    // Since we don't know the password, let's just sign up a new one.
    const email = `test_student_${Date.now()}@example.com`
    const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password: 'password123',
        options: {
            data: {
                full_name: 'Test Student',
                role: 'student',
                enrollment_id: `ENR${Date.now()}`
            }
        }
    })

    if (authError) {
        console.error("Auth error:", authError)
        return
    }

    console.log("Logged in as new student:", authData.user.id)

    // Wait a second for trigger to create profile
    await new Promise(r => setTimeout(r, 2000))

    const { data: profile } = await supabase.from('parkease_profiles').select('id').eq('id', authData.user.id).single()
    console.log("Profile created:", !!profile)

    // Attempt to insert vehicle
    const { data: insertData, error: insertError } = await supabase.from('parkease_vehicles').insert([{
        owner_id: authData.user.id,
        vehicle_number: `GJ05XX${Math.floor(Math.random() * 9000) + 1000}`,
        vehicle_type: 'two_wheeler',
        brand: 'Honda',
        model: 'Activa',
        color: 'Black',
        status: 'active'
    }])

    if (insertError) {
        console.error("Insert Error:", insertError)
    } else {
        console.log("Insert Success!", insertData)
    }
}

checkPolicies()
