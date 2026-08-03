require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Error: Supabase credentials not found in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seedAdmin() {
    console.log('🚀 Seeding Admin user to Supabase online database...');
    
    const adminUser = {
        id: "admin-account-id-0000-000000000000",
        name: "System Admin",
        email: "admin@solar.com",
        phone: "088-888-8888",
        role: "admin",
        password: "admin",
        created_at: new Date().toISOString()
    };

    const { data, error } = await supabase
        .from('users')
        .upsert([adminUser], { onConflict: 'email' })
        .select();

    if (error) {
        console.error('❌ Failed to seed Admin to Supabase:', error);
    } else {
        console.log('🎉 Successfully seeded Admin user to online Supabase!');
        console.log('Data:', data);
    }
}

seedAdmin();
