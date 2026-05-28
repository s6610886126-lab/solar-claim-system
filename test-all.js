const { exec } = require('child_process');
const path = require('path');

const tests = [
    { name: '1. Supabase Direct DB Connection Test', cmd: 'node test-insert.js' },
    { name: '2. Local Excel Cache File Read Test', cmd: 'node test-excel.js' },
    { name: '3. Frontend Form Submission POST API Test', cmd: 'node C:\\Users\\User\\.gemini\\antigravity\\brain\\9106b0c4-2a5d-43a2-8f76-3838cc09af1b\\scratch\\test-post-claim.js' },
    { name: '4. Excel File Bulk Import POST API Test', cmd: 'node C:\\Users\\User\\.gemini\\antigravity\\brain\\9106b0c4-2a5d-43a2-8f76-3838cc09af1b\\scratch\\test-api-import.js' },
    { name: '5. CSV File Bulk Import POST API Test', cmd: 'node C:\\Users\\User\\.gemini\\antigravity\\brain\\9106b0c4-2a5d-43a2-8f76-3838cc09af1b\\scratch\\test-api-import-csv.js' },
    { name: '6. Full E2E Headless Workflow Integration Test', cmd: 'node C:\\Users\\User\\.gemini\\antigravity\\brain\\9106b0c4-2a5d-43a2-8f76-3838cc09af1b\\scratch\\test-e2e-headless.js' }
];

async function runCommand(cmd) {
    return new Promise((resolve) => {
        exec(cmd, (error, stdout, stderr) => {
            resolve({
                success: !error,
                stdout: stdout.trim(),
                stderr: stderr.trim()
            });
        });
    });
}

async function runAllTests() {
    console.log('\n======================================================');
    console.log('🌟 RUNNING ALL DIAGNOSTIC TESTS FOR SOLAR CLAIM SYSTEM 🌟');
    console.log('======================================================\n');

    const results = [];

    for (const test of tests) {
        console.log(`⏳ Running: ${test.name}...`);
        const result = await runCommand(test.cmd);
        
        if (result.success) {
            console.log(`✅ Success!\n`);
            results.push({ name: test.name, status: 'PASSED', color: '\x1b[32m' });
        } else {
            console.log(`❌ Failed!\n`);
            results.push({ name: test.name, status: 'FAILED', color: '\x1b[31m', error: result.stderr || result.stdout });
        }
    }

    console.log('\n======================================================');
    console.log('📋 CONSOLIDATED TEST EXECUTION REPORT');
    console.log('======================================================');
    
    let allPassed = true;
    results.forEach(r => {
        if (r.status === 'FAILED') allPassed = false;
        console.log(`${r.color}[${r.status}]\x1b[0m - ${r.name}`);
        if (r.error) {
            console.log(`   └─ Error details: ${r.error.split('\n')[0]}`);
        }
    });

    console.log('======================================================');
    if (allPassed) {
        console.log('\x1b[32m🎉 ALL SYSTEMS GO! Every single test has passed successfully! 🎉\x1b[0m');
    } else {
        console.log('\x1b[31m⚠️  WARNING! One or more diagnostic tests failed. Please check logs. ⚠️\x1b[0m');
    }
    console.log('======================================================\n');
}

runAllTests();
