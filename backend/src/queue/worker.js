const { Worker } = require('bullmq');
const redis = require('../redis/client');
const pool = require('../database/client');

const completedOrders = [];

const worker = new Worker('OrderQueue', async (job) => {
    console.log(`[Worker] Processing order for user ${job.data.userId}...`);
    
    // Simulate real database write latency
    await new Promise(resolve => setTimeout(resolve, Math.random() * 300 + 100));

    try {
        // Persist to Postgres
        // NOTE: In this demo, we use a simple insert. 
        // We link to the existing product 1 and upsert/find a user record.
        
        // 1. Ensure user exists (hackathon shortcut: use a default user_id or upsert)
        // For the sake of the demo, we'll just insert into orders with the string token
        const res = await pool.query(
            'INSERT INTO orders (product_id, checkout_token, status) VALUES ($1, $2, $3) RETURNING id',
            [job.data.productId || 1, job.data.token, 'COMPLETED']
        );

        const dbId = res.rows[0].id;
        
        completedOrders.push({
            ...job.data,
            dbId,
            status: 'COMPLETED',
            completedAt: Date.now()
        });

        console.log(`[Worker] ✅ Order #${dbId} persisted to Postgres for user ${job.data.userId}.`);
        return { success: true, dbId };
    } catch (err) {
        console.error(`[Worker] ❌ Database Error: ${err.message}`);
        throw err; // BullMQ will retry or move to failed
    }

}, { connection: redis });

worker.on('completed', (job) => {
    console.log(`[Worker] Job ${job.id} complete`);
});

worker.on('failed', (job, err) => {
    console.error(`[Worker] Job ${job.id} failed: ${err.message}`);
});

module.exports = { worker, completedOrders };
