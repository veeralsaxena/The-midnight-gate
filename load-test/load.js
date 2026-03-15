// Load Test: Simulates 5000 concurrent users hitting the Reserve → Confirm flow
// Some users abandon (don't confirm) to test heartbeat release
const http = require('http');

const NUM_USERS = 5000;
const ABANDON_RATE = 0.3; // 30% of successful reservations won't pay (test heartbeat release)
const HOST = 'localhost';
const PORT = 4000;

let reserveSuccess = 0;
let reserveFailed = 0;
let confirmSuccess = 0;
let confirmFailed = 0;
let abandoned = 0;
let errors = 0;
let completed = 0;
let botsBlocked = 0;

function makeRequest(path, body) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify(body);
        const options = {
            hostname: HOST, port: PORT, path, method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) }
        };
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(data) }));
        });
        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

async function simulateUser(i, isBot = false) {
    const userId = isBot ? `bot-scraper-${i}` : `loadtest-user-${i}`;
    
    if (isBot) {
        // ML Filter Test: Aggressive bot doing 15 requests instantly
        for (let b = 0; b < 15; b++) {
            makeRequest('/api/reserve', { productId: 1, userId: userId }).then(r => {
                if (r.status === 403) botsBlocked++;
            }).catch(()=>{});
        }
        return;
    }

    try {
        // Step 1: Reserve
        const reserveRes = await makeRequest('/api/reserve', { productId: 1, userId });
        
        if (reserveRes.status === 200) {
            reserveSuccess++;
            
            // Simulate some users abandoning (testing heartbeat/TTL release)
            if (Math.random() < ABANDON_RATE) {
                abandoned++;
                completed++;
                return; // User closes tab — reservation will expire via TTL
            }
            
            // Step 2: Confirm payment
            const confirmRes = await makeRequest('/api/confirm', { 
                productId: 1, userId, checkoutToken: reserveRes.data.checkoutToken 
            });
            
            if (confirmRes.status === 200) confirmSuccess++;
            else confirmFailed++;
        } else {
            reserveFailed++;
        }
    } catch {
        errors++;
    }
    completed++;
}

async function runLoadTest() {
    // Reset inventory first
    await makeRequest('/api/admin/reset', { inventory: 10 });
    console.log('🔄 System reset. Inventory: 10\n');
    
    // Small delay for reset to propagate
    await new Promise(r => setTimeout(r, 500));

    console.log(`🚀 Launching ${NUM_USERS} simultaneous users at the Midnight Gate...`);
    console.log(`   (${Math.round(ABANDON_RATE * 100)}% abandon rate to test heartbeat release)\n`);
    
    const startTime = Date.now();

    const promises = [];
    // Fire regular users
    for (let i = 0; i < NUM_USERS; i++) {
        promises.push(simulateUser(i, false));
    }
    
    // Fire aggressive bots specifically to test the ML filter
    for (let i = 0; i < 50; i++) {
        promises.push(simulateUser(i, true));
    }

    await Promise.all(promises);
    
    // Wait an extra second for bot async requests to resolve
    await new Promise(r => setTimeout(r, 1000));

    const duration = Date.now() - startTime;
    
    // Some bots will get 400 SOLD OUT very quickly and not 403 if they don't trip the ML fast enough, 
    // but the vast majority of their 15 hits will be 403 or 400.


    console.log(`\n✅ Load Test Complete in ${duration}ms!`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`🎟️  Reservations Secured:    ${reserveSuccess} (should be ≤ 10)`);
    console.log(`🛑 Clean Rejections:        ${reserveFailed}`);
    console.log(`💳 Payments Confirmed:      ${confirmSuccess}`);
    console.log(`💔 Abandoned (TTL Release): ${abandoned}`);
    console.log(`🤖 Bots Blocked (ML Filter):${botsBlocked}`);
    console.log(`❌ Errors:                  ${errors}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`\n⏳ Abandoned reservations will release via TTL in ~60s.`);
    console.log(`   Watch the War Room dashboard to see inventory return!`);
    
    process.exit(0);
}

runLoadTest();
