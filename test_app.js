const http = require('http');

function request(options, postData = null) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    body: data
                });
            });
        });
        req.on('error', reject);
        if (postData) {
            req.write(postData);
        }
        req.end();
    });
}

async function runTests() {
    console.log('--- Testing MetroVerify HTTP Endpoints ---');

    // Test 1: Landing Page
    const landing = await request({ hostname: 'localhost', port: 3000, path: '/', method: 'GET' });
    console.log(`1. GET /: ${landing.statusCode === 200 ? 'PASS (200 OK)' : 'FAIL (' + landing.statusCode + ')'}`);

    // Test 2: Hindi Landing Page
    const hindi = await request({ hostname: 'localhost', port: 3000, path: '/?lang=hi', method: 'GET' });
    console.log(`2. GET /?lang=hi: ${hindi.statusCode === 200 && hindi.body.includes('विधिक मापविज्ञान') ? 'PASS (Hindi rendered)' : 'FAIL'}`);

    // Test 3: Public Verify Landing
    const verifyLanding = await request({ hostname: 'localhost', port: 3000, path: '/verify', method: 'GET' });
    console.log(`3. GET /verify: ${verifyLanding.statusCode === 200 ? 'PASS (200 OK)' : 'FAIL'}`);

    // Test 4: Verify Valid Certificate
    const certValid = await request({ hostname: 'localhost', port: 3000, path: '/verify/LM-2026-DL-104920', method: 'GET' });
    console.log(`4. GET /verify/LM-2026-DL-104920 (Valid): ${certValid.statusCode === 200 && certValid.body.includes('STATUS: OFFICIALLY VERIFIED & VALID') ? 'PASS (Valid Certificate Verified)' : 'FAIL'}`);

    // Test 5: Verify Expiring Certificate
    const certExpiring = await request({ hostname: 'localhost', port: 3000, path: '/verify/LM-2025-MH-084219', method: 'GET' });
    console.log(`5. GET /verify/LM-2025-MH-084219: ${certExpiring.statusCode === 200 ? 'PASS (200 OK)' : 'FAIL'}`);

    // Test 6: Verify Revoked Certificate
    const certRevoked = await request({ hostname: 'localhost', port: 3000, path: '/verify/LM-2026-DL-002158', method: 'GET' });
    console.log(`6. GET /verify/LM-2026-DL-002158 (Revoked): ${certRevoked.statusCode === 200 && certRevoked.body.includes('CERTIFICATE REVOKED') ? 'PASS (Revocation Notice Verified)' : 'FAIL'}`);

    // Test 7: Verify Non-existent Certificate (Not Found State)
    const certMissing = await request({ hostname: 'localhost', port: 3000, path: '/verify/LM-9999-FAKE-000000', method: 'GET' });
    console.log(`7. GET /verify/LM-9999-FAKE-000000: ${certMissing.statusCode === 200 && certMissing.body.includes('Certificate Record Not Found') ? 'PASS (Proper Not Found Alert)' : 'FAIL'}`);

    // Test 8: Login Page
    const loginPage = await request({ hostname: 'localhost', port: 3000, path: '/auth/login', method: 'GET' });
    console.log(`8. GET /auth/login: ${loginPage.statusCode === 200 && loginPage.body.includes('merchant@demo.com') ? 'PASS (200 OK with Demo Autofills)' : 'FAIL'}`);

    // Test 9: Register Page
    const regPage = await request({ hostname: 'localhost', port: 3000, path: '/auth/register', method: 'GET' });
    console.log(`9. GET /auth/register: ${regPage.statusCode === 200 && regPage.body.includes('GSTIN (15 Alphanumeric)') ? 'PASS (200 OK with Strict Validation Hints)' : 'FAIL'}`);

    // Test 10: PDF Certificate Static Route
    const pdfTest = await request({ hostname: 'localhost', port: 3000, path: '/uploads/certificates/LM-2026-DL-104920.pdf', method: 'GET' });
    console.log(`10. GET /uploads/certificates/LM-2026-DL-104920.pdf: ${pdfTest.statusCode === 200 && pdfTest.headers['content-type'] === 'application/pdf' ? 'PASS (200 OK PDF Streamed)' : 'FAIL'}`);

    // Test 11: Route Guard Check (Unauthorized Merchant Page without Login)
    const guardTest = await request({ hostname: 'localhost', port: 3000, path: '/merchant/dashboard', method: 'GET' });
    console.log(`11. GET /merchant/dashboard (Guest): ${guardTest.statusCode === 302 && guardTest.headers.location.includes('/auth/login') ? 'PASS (302 Redirect to Login)' : 'FAIL'}`);

    // Test 12: Route Guard Check (Unauthorized Inspector Page without Login)
    const guardTest2 = await request({ hostname: 'localhost', port: 3000, path: '/inspector/dashboard', method: 'GET' });
    console.log(`12. GET /inspector/dashboard (Guest): ${guardTest2.statusCode === 302 && guardTest2.headers.location.includes('/auth/login') ? 'PASS (302 Redirect to Login)' : 'FAIL'}`);

    console.log('\n--- All Core Endpoint Tests Completed! ---');
}

runTests().catch(console.error);
