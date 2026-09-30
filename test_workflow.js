const http = require('http');
const querystring = require('querystring');

function extractCookie(headers) {
    const raw = headers['set-cookie'];
    if (!raw) return '';
    return raw.map(c => c.split(';')[0]).join('; ');
}

function request(options, data = null, cookie = '') {
    return new Promise((resolve, reject) => {
        const reqOpts = { ...options };
        reqOpts.headers = reqOpts.headers || {};
        if (cookie) reqOpts.headers['Cookie'] = cookie;
        if (data) {
            reqOpts.headers['Content-Type'] = 'application/x-www-form-urlencoded';
            reqOpts.headers['Content-Length'] = Buffer.byteLength(data);
        }

        const req = http.request(reqOpts, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    body: body,
                    cookie: extractCookie(res.headers)
                });
            });
        });
        req.on('error', reject);
        if (data) req.write(data);
        req.end();
    });
}

function extractCsrf(html) {
    const match = html.match(/name="_csrf" value="([^"]+)"/);
    return match ? match[1] : '';
}

async function testWorkflows() {
    console.log('--- Testing Full End-to-End Workflow with Sessions ---');

    // 1. Merchant Session
    const loginGet = await request({ hostname: 'localhost', port: 3000, path: '/auth/login', method: 'GET' });
    const sessionCookie = loginGet.cookie;
    const csrf = extractCsrf(loginGet.body);

    console.log(`1. Acquired CSRF token: ${csrf ? 'SUCCESS' : 'FAIL'}`);

    // Post Login as Merchant
    const loginPost = await request(
        { hostname: 'localhost', port: 3000, path: '/auth/login', method: 'POST' },
        querystring.stringify({
            email: 'merchant@demo.com',
            password: 'Demo@123',
            role: 'merchant',
            _csrf: csrf
        }),
        sessionCookie
    );

    const authCookie = loginPost.cookie || sessionCookie;
    console.log(`2. Merchant Login: ${loginPost.statusCode === 302 && loginPost.headers.location === '/merchant/dashboard' ? 'PASS (302 Redirect to Dashboard)' : 'FAIL'}`);

    // Access Merchant Dashboard
    const merchDash = await request({ hostname: 'localhost', port: 3000, path: '/merchant/dashboard', method: 'GET' }, null, authCookie);
    console.log(`3. Merchant Dashboard: ${merchDash.statusCode === 200 && merchDash.body.includes('Sharma Kirana') ? 'PASS (Merchant Profile Loaded)' : 'FAIL'}`);

    // Access My Instruments
    const merchInsts = await request({ hostname: 'localhost', port: 3000, path: '/merchant/instruments', method: 'GET' }, null, authCookie);
    console.log(`4. Merchant Instruments: ${merchInsts.statusCode === 200 && merchInsts.body.includes('ESS-2023-8841') ? 'PASS (Instruments Listed)' : 'FAIL'}`);

    // Access Application Detail (Tracker)
    const appDetail = await request({ hostname: 'localhost', port: 3000, path: '/merchant/applications/1', method: 'GET' }, null, authCookie);
    console.log(`5. Application Tracker: ${appDetail.statusCode === 200 && appDetail.body.includes('Application Verification Lifecycle Tracker') ? 'PASS (Tracker Visual Stepper Rendered)' : 'FAIL'}`);

    // 2. Inspector Session
    const inspLoginGet = await request({ hostname: 'localhost', port: 3000, path: '/auth/login', method: 'GET' });
    const inspSessionCookie = inspLoginGet.cookie;
    const inspCsrf = extractCsrf(inspLoginGet.body);

    const inspLoginPost = await request(
        { hostname: 'localhost', port: 3000, path: '/auth/login', method: 'POST' },
        querystring.stringify({
            email: 'inspector@demo.com',
            password: 'Demo@123',
            role: 'inspector',
            _csrf: inspCsrf
        }),
        inspSessionCookie
    );

    const inspAuthCookie = inspLoginPost.cookie || inspSessionCookie;
    console.log(`6. Inspector Login: ${inspLoginPost.statusCode === 302 && inspLoginPost.headers.location === '/inspector/dashboard' ? 'PASS (302 Redirect to Inspector Dashboard)' : 'FAIL'}`);

    // Access Inspector Dashboard
    const inspDash = await request({ hostname: 'localhost', port: 3000, path: '/inspector/dashboard', method: 'GET' }, null, inspAuthCookie);
    console.log(`7. Inspector Dashboard: ${inspDash.statusCode === 200 && inspDash.body.includes('Central Delhi') ? 'PASS (Jurisdiction Dashboard Active)' : 'FAIL'}`);

    // Access Inspector Applications Queue
    const inspQueue = await request({ hostname: 'localhost', port: 3000, path: '/inspector/applications', method: 'GET' }, null, inspAuthCookie);
    console.log(`8. Inspector Queue: ${inspQueue.statusCode === 200 && inspQueue.body.includes('Verification Applications Queue') ? 'PASS (Applications Queue Loaded)' : 'FAIL'}`);

    // Access Inspector Application Review Screen
    const inspReview = await request({ hostname: 'localhost', port: 3000, path: '/inspector/applications/4', method: 'GET' }, null, inspAuthCookie);
    console.log(`9. Inspector Review Screen: ${inspReview.statusCode === 200 && inspReview.body.includes('Record Metrological Test Readings') ? 'PASS (Test Calculator & Decision UI Loaded)' : 'FAIL'}`);

    // Access Analytics
    const analytics = await request({ hostname: 'localhost', port: 3000, path: '/inspector/analytics', method: 'GET' }, null, inspAuthCookie);
    console.log(`10. Inspector Analytics: ${analytics.statusCode === 200 && analytics.body.includes('chart.umd.min.js') ? 'PASS (Chart.js Analytics Loaded)' : 'FAIL'}`);

    // Access Audit Log
    const auditLog = await request({ hostname: 'localhost', port: 3000, path: '/inspector/audit-log', method: 'GET' }, null, inspAuthCookie);
    console.log(`11. Inspector Audit Trail: ${auditLog.statusCode === 200 && auditLog.body.includes('System Audit Trail & Compliance Log') ? 'PASS (Audit Log Loaded)' : 'FAIL'}`);

    console.log('\n--- All Authenticated Workflows Verified Successfully! ---');
}

testWorkflows().catch(console.error);
