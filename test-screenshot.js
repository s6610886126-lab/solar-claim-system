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
    
    // 1. Fetch a claim from Supabase or fallback to local claims.json
    let claimId;
    let claimNumber;
    try {
        const { data: claims, error } = await supabase.from('claims').select('id, claim_number').limit(1);
        if (error || !claims || claims.length === 0) {
            throw new Error(error ? error.message : 'No claims found');
        }
        claimId = claims[0].id;
        claimNumber = claims[0].claim_number;
    } catch (e) {
        console.warn('⚠️ Supabase connection failed. Trying local claims.json fallback...');
        const DATA_FILE = path.join(__dirname, 'data', 'claims.json');
        if (fs.existsSync(DATA_FILE)) {
            const fileData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
            if (fileData.claims && fileData.claims.length > 0) {
                claimId = fileData.claims[0].id;
                claimNumber = fileData.claims[0].claimNumber || fileData.claims[0].claim_number;
            }
        }
    }

    if (!claimId) {
        console.error('❌ Failed to fetch any claims for screenshot testing.');
        process.exit(1);
    }
    console.log(`📌 Found target claim for testing: ID=${claimId}, ClaimNumber=${claimNumber}`);

    // 2. Launch Puppeteer
    const browser = await puppeteer.launch({
        headless: true,
        executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
    page.on('pageerror', err => console.error('BROWSER ERROR:', err.message));
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
        await page.waitForSelector('#statsGrid');
        const dashboardPath = path.join(ARTIFACTS_DIR, 'dashboard.png');
        await page.screenshot({ path: dashboardPath });
        console.log(`📸 Dashboard screenshot captured at: ${dashboardPath}`);

        // Capture Overview (Analytics) Page
        console.log('📊 Navigating to Overview...');
        const response = await page.goto('http://localhost:3000/overview.html', { waitUntil: 'domcontentloaded' });
        console.log(`📡 Overview response status: ${response ? response.status() : 'null'}`);
        console.log(`📡 Overview current URL: ${page.url()}`);
        await page.waitForSelector('#chartsSection');
        // Let Chart.js animations finish
        await new Promise(r => setTimeout(r, 2500));
        const overviewPath = path.join(ARTIFACTS_DIR, 'overview.png');
        await page.screenshot({ path: overviewPath, fullPage: true });
        console.log(`📸 Overview screenshot captured at: ${overviewPath}`);

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
