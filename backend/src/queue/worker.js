const { Worker } = require('bullmq');
const redis = require('../redis/client');

const completedOrders = [];

const worker = new Worker('OrderQueue', async (job) => {
    console.log(`[Worker] Processing order for user ${job.data.userId}...`);
    
    // Simulate real database write latency
    await new Promise(resolve => setTimeout(resolve, Math.random() * 300 + 100));

    completedOrders.push({
        ...job.data,
        status: 'COMPLETED',
        completedAt: Date.now()
    });

    console.log(`[Worker] ✅ Order confirmed for user ${job.data.userId}. Total in DB: ${completedOrders.length}`);
    return { success: true, dbId: completedOrders.length };

}, { connection: redis });

worker.on('completed', (job) => {
    console.log(`[Worker] Job ${job.id} complete`);
});

worker.on('failed', (job, err) => {
    console.error(`[Worker] Job ${job.id} failed: ${err.message}`);
});

module.exports = { worker, completedOrders };
