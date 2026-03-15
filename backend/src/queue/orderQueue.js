const { Queue } = require('bullmq');
const redis = require('../redis/client');

// Create the Queue backed by Redis
const orderQueue = new Queue('OrderQueue', {
    connection: redis,
});

async function enqueueOrder(productId, userId, token) {
    // Add job to the queue for asynchronous DB insertion
    await orderQueue.add('process_order', {
        productId,
        userId,
        token,
        timestamp: Date.now()
    });
    console.log(`[Queue] Added order for user ${userId} to queue.`);
}

module.exports = {
    orderQueue,
    enqueueOrder
};
