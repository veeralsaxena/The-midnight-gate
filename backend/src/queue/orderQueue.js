const { Queue } = require('bullmq');
const Redis = require('ioredis');
const redisConfig = process.env.REDIS_URL
  ? process.env.REDIS_URL
  : { host: process.env.REDIS_HOST || 'localhost', port: process.env.REDIS_PORT || 6380 };

const orderQueue = new Queue('OrderQueue', {
    connection: new Redis(redisConfig, { maxRetriesPerRequest: null, family: 6 }),
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
