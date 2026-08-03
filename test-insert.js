require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testInsert() {
    const newClaim = {
        id: uuidv4(),
        claim_number: `CLM-TEST-${Date.now().toString().slice(-6)}`,
        customer: {
            name: "EndToEnd User",
            phone: "0812345678",
            email: "ete@solar.com",
            address: "123 Test Road, Bangkok"
        },
        equipment: {
            type: "Inverter",
            brand: "Huawei",
            model: "SUN2000-E2E",
            serialNumber: "SN-E2E-TEST-999",
            purchaseDate: "2024-05-01"
        },
        warranty: {
            number: "WRT-E2E-999",
            period: "5 years",
            expiryDate: "2029-05-01"
        },
        problem: {
            description: "Inverter alerts Error Code 204",
            severity: "80",
            images: []
        },
        status: 'pending',
        timeline: [{ status: 'pending', date: new Date().toISOString(), note: 'Claim submitted successfully' }],
        notes: []
    };

    const { data, error } = await supabase.from('claims').insert([newClaim]).select();
    if (error) {
        console.error('❌ Supabase Insert Error:', error);
    } else {
        console.log('✅ Supabase Insert Success:', data);
    }
}

testInsert();
