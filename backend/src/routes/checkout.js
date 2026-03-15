const express = require('express');
const { atomicReserve, releaseReservation, confirmReservation, getInventory, getMetrics } = require('../redis/scripts');
const { enqueueOrder } = require('../queue/orderQueue');
const { anomalyMiddleware } = require('../ml/anomalyDetector');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();
const redis = require('../redis/client');

// Function to get recommendations using Redis Vector Search (RediSearch)
async function getRecommendations(productId, limit = 3) {
    try {
        const productData = await redis.hgetall(`product_data:${productId}`);
        if (!productData || !productData.embedding) return [];

        const embeddingBuffer = productData.embedding;
        // Search for nearest neighbors. We fetch 6 to account for current product or out-of-stock
        const results = await redis.call(
            'FT.SEARCH',
            'idx:products',
            '*=>[KNN 6 @embedding $vec AS score]',
            'PARAMS', '2', 'vec', embeddingBuffer,
            'DIALECT', '2'
        );

        const products = [];
        for (let i = 1; i < results.length; i += 2) {
            const fields = results[i + 1];
            const p = {};
            for (let j = 0; j < fields.length; j += 2) {
                p[fields[j]] = fields[j + 1];
            }
            if (p.id && parseInt(p.id) !== parseInt(productId)) {
                // Eagerly fetch atomic inventory
                const stock = await redis.get(`product:${p.id}:inventory`);
                if (parseInt(stock) > 0) {
                    p.inventory = parseInt(stock);
                    delete p.embedding; // don't send buffer to client
                    products.push(p);
                }
            }
        }
        return products.slice(0, limit);
    } catch (err) {
        console.error('Vector search error:', err);
        return [];
    }
}

// ============================================================
// POST /api/reserve — The Gate (Step 1 of 2)
// Atomically reserves an item. Returns checkout token.
// ============================================================
router.post('/reserve', anomalyMiddleware, async (req, res) => {
    const userId = req.body.userId;
    const productId = req.body.productId || 1;
    const socketId = req.body.socketId;

    if (!userId) {
        return res.status(400).json({ error: "userId is required." });
    }

    // PRESSURE-ADAPTIVE LOAD SHEDDING
    const loadSheddingActive = req.app.get('loadSheddingActive');
    if (loadSheddingActive) {
        return res.status(503).json({ 
            error: "System under pressure. Please wait...",
            code: "LOAD_SHEDDING" 
        });
    }

    try {
        const startTime = Date.now();
        const result = await atomicReserve(productId, userId);
        const latency = Date.now() - startTime;

        // Track metrics
        const metrics = req.app.get('requestMetrics');
        if (metrics) metrics.totalRequests++;

        if (result === -2) {
            return res.status(400).json({ error: "Already confirmed. You own this item.", code: "ALREADY_CONFIRMED" });
        }

        if (result === -1) {
            return res.status(400).json({ error: "You already have a reservation. Complete your payment.", code: "ALREADY_RESERVED" });
        }

        if (result === 0) {
            const recommendations = await getRecommendations(productId, 3);
            return res.status(400).json({ 
                error: "SOLD OUT! Better luck next time. />", 
                code: "SOLD_OUT",
                recommendations
            });
        }

        // Success! User reserved an item
        const checkoutToken = uuidv4();
        const io = req.app.get('io');

        // Map this socket to userId for heartbeat monitoring
        if (socketId) {
            const socketUserMap = req.app.get('socketUserMap');
            socketUserMap.set(socketId, { userId, productId });
        }

        // Broadcast to all clients
        const currentMetrics = await getMetrics(productId);
        io.emit('inventoryUpdate', { 
            productId, 
            remainingStock: result, 
            reservedCount: currentMetrics.reservedCount,
            confirmedCount: currentMetrics.confirmedCount
        });
        io.emit('activityEvent', { 
            type: 'RESERVED', 
            userId: userId.substring(0, 8), 
            timestamp: Date.now(),
            latency 
        });

        if (result === 0) {
            io.emit('soldOut', { productId });
        }

        return res.status(200).json({
            message: "Reserved! Complete payment within 60 seconds.",
            checkoutToken,
            remainingStock: result,
            latency,
            code: "RESERVED"
        });

    } catch (error) {
        console.error("[Reserve Error]", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
});

// ============================================================
// POST /api/confirm — Payment Confirmation (Step 2 of 2)
// Confirms reservation and queues order for DB write
// ============================================================
router.post('/confirm', anomalyMiddleware, async (req, res) => {
    const userId = req.body.userId;
    const productId = req.body.productId || 1;
    const checkoutToken = req.body.checkoutToken;

    if (!userId || !checkoutToken) {
        return res.status(400).json({ error: "userId and checkoutToken are required." });
    }

    try {
        const result = await confirmReservation(productId, userId);

        if (result === -1) {
            return res.status(400).json({ 
                error: "Reservation expired or not found. Your item was released.", 
                code: "RESERVATION_EXPIRED" 
            });
        }

        // Confirmed! Enqueue for persistent DB storage
        await enqueueOrder(productId, userId, checkoutToken);

        const io = req.app.get('io');
        const currentMetrics = await getMetrics(productId);

        io.emit('inventoryUpdate', { 
            productId, 
            remainingStock: currentMetrics.stock,
            reservedCount: currentMetrics.reservedCount,
            confirmedCount: currentMetrics.confirmedCount
        });
        io.emit('activityEvent', { 
            type: 'CONFIRMED', 
            userId: userId.substring(0, 8), 
            timestamp: Date.now() 
        });

        // Remove from socket heartbeat map (they paid, no need to track disconnect)
        const socketUserMap = req.app.get('socketUserMap');
        for (const [sid, data] of socketUserMap.entries()) {
            if (data.userId === userId) {
                socketUserMap.delete(sid);
                break;
            }
        }

        return res.status(200).json({ 
            message: "Payment confirmed! Your order is being processed.",
            code: "CONFIRMED"
        });

    } catch (error) {
        console.error("[Confirm Error]", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
});

// ============================================================
// GET /api/inventory/:productId — Get current stock + metrics
// ============================================================
router.get('/inventory/:productId', async (req, res) => {
    const metrics = await getMetrics(req.params.productId);
    res.json(metrics);
});

// ============================================================
// GET /api/admin/metrics — Full system metrics for War Room
// ============================================================
router.get('/admin/metrics', async (req, res) => {
    const productMetrics = await getMetrics(1);
    const io = req.app.get('io');
    const requestMetrics = req.app.get('requestMetrics');
    const { orderQueue } = require('../queue/orderQueue');
    
    let queueLength = 0;
    try {
        queueLength = await orderQueue.getWaitingCount() + await orderQueue.getActiveCount();
    } catch(e) { /* queue may not be ready */ }

    res.json({
        ...productMetrics,
        activeConnections: io.engine.clientsCount || 0,
        queueLength,
        loadSheddingActive: req.app.get('loadSheddingActive') || false,
        requestsPerSecond: requestMetrics ? requestMetrics.rps : 0,
    });
});

module.exports = router;
