require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const puppeteer = require('puppeteer');
const path = require('path');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const fs = require('fs');

const ARTIFACTS_DIR = path.join(__dirname, 'data', 'screenshots');
if (!fs.existsSync(ARTIFACTS_DIR)) {
    fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
}

async function runScreenshotTest() {
    console.log('🌟 STARTING VISUAL CAPTURE AND TESTING 🌟');
    
    // 1. Fetch a claim from Supabase
    const { data: claims, error } = await supabase.from('claims').select('id, claim_number').limit(1);
    if (error || !claims || claims.length === 0) {
        console.error('❌ Failed to fetch claim from Supabase:', error);
        process.exit(1);
    }
    const claimId = claims[0].id;
    console.log(`📌 Found target claim for testing: ID=${claimId}, ClaimNumber=${claims[0].claim_number}`);

    // 2. Launch Puppeteer
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 960 });

    try {
        // 3. Go to base URL and set localStorage for session bypass
        console.log('🔑 Navigating to home page to inject login session...');
        await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
        
        await page.evaluate(() => {
            localStorage.setItem('solar_user', JSON.stringify({
                email: 'admin@solar.com',
                name: 'System Admin',
                role: 'admin'
            }));
        });
        console.log('✅ Session injected!');

        // 4. Capture Dashboard Page
        console.log('📊 Navigating to Dashboard...');
        await page.goto('http://localhost:3000/dashboard.html', { waitUntil: 'networkidle2' });
        await page.waitForSelector('table');
        const dashboardPath = path.join(ARTIFACTS_DIR, 'dashboard.png');
        await page.screenshot({ path: dashboardPath });
        console.log(`📸 Dashboard screenshot captured at: ${dashboardPath}`);

        // 5. Capture Claim Detail Page (Web view)
        const claimDetailUrl = `http://localhost:3000/claim-detail.html?id=${claimId}`;
        console.log(`🔍 Navigating to Claim Detail Page: ${claimDetailUrl}`);
        await page.goto(claimDetailUrl, { waitUntil: 'networkidle2' });
        await page.waitForSelector('#claimTitle');
        // Let user avatars / styles settle
        await new Promise(r => setTimeout(r, 1000));
        
        const detailPath = path.join(ARTIFACTS_DIR, 'claim_detail.png');
        await page.screenshot({ path: detailPath, fullPage: true });
        console.log(`📸 Claim Detail screenshot captured at: ${detailPath}`);

        // 6. Emulate Print and Capture Print Layout (PDF Preview)
        console.log('🖨️ Emulating Print Media for PDF View...');
        await page.emulateMediaType('print');
        // A4 ratio 794x1123 at 96 DPI
        await page.setViewport({ width: 794, height: 1123 });
        await new Promise(r => setTimeout(r, 500));
        
        const printPath = path.join(ARTIFACTS_DIR, 'claim_detail_print.png');
        await page.screenshot({ path: printPath, fullPage: true });
        console.log(`📸 Claim Detail Print screenshot captured at: ${printPath}`);

        console.log('🎉 ALL SCREENSHOTS CAPTURED SUCCESSFULLY!');
    } catch (e) {
        console.error('❌ Error during visual testing:', e);
    } finally {
        await browser.close();
    }
}

runScreenshotTest();
