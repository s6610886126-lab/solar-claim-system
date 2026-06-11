const http = require('http');

function makeRequest(options, postData) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    resolve({
                        statusCode: res.statusCode,
                        headers: res.headers,
                        body: JSON.parse(data)
                    });
                } catch (e) {
                    resolve({
                        statusCode: res.statusCode,
                        headers: res.headers,
                        body: data
                    });
                }
            });
        });
        req.on('error', (e) => reject(e));
        if (postData) {
            req.write(JSON.stringify(postData));
        }
        req.end();
    });
}

async function runApiTests() {
    console.log('🧪 Starting API Integration Tests...');
    
    try {
        // Test 1: GET /api/claims
        const resGet = await makeRequest({
            hostname: 'localhost',
            port: 3000,
            path: '/api/claims',
            method: 'GET'
        });
        if (resGet.statusCode === 200 && resGet.body.success) {
            console.log('   ✅ GET /api/claims: Passed');
        } else {
            console.error('   ❌ GET /api/claims: Failed', resGet);
            process.exit(1);
        }

        // Test 2: GET /api/stats
        const resStats = await makeRequest({
            hostname: 'localhost',
            port: 3000,
            path: '/api/stats',
            method: 'GET'
        });
        if (resStats.statusCode === 200 && resStats.body.success) {
            console.log('   ✅ GET /api/stats: Passed');
        } else {
            console.error('   ❌ GET /api/stats: Failed', resStats);
            process.exit(1);
        }

        // Test 3: POST /api/claims
        const mockPayload = {
            customer: {
                name: "API Test User",
                phone: "0899999999",
                email: "api.test@solar.com",
                address: "456 Test Blvd, Bangkok"
            },
            equipment: {
                type: "Solar Panel",
                brand: "JinkoSolar",
                model: "JKM-440N",
                serialNumber: `SN-API-${Date.now().toString().slice(-6)}`,
                purchaseDate: "2024-06-01"
            },
            warranty: {
                number: "WRT-API-001",
                period: "12 ปี"
            },
            problem: {
                description: "Test claim created via automated API test",
                severity: "10",
                images: []
            }
        };

        const resPost = await makeRequest({
            hostname: 'localhost',
            port: 3000,
            path: '/api/claims',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        }, mockPayload);

        if (resPost.statusCode === 201 && resPost.body.success) {
            console.log(`   ✅ POST /api/claims: Passed (Created: ${resPost.body.data.claimNumber})`);
        } else {
            console.error('   ❌ POST /api/claims: Failed', resPost);
            process.exit(1);
        }

        console.log('🎉 API Integration Tests Completed Successfully!');
    } catch (err) {
        console.error('❌ API Test connection error. Is the server running?', err.message);
        process.exit(1);
    }
}

runApiTests();
