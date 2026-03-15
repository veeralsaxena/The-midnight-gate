const express = require('express');
const cors = require('cors');
const http = require('http');
const Redis = require('ioredis');
const { Server } = require('socket.io');
const checkoutRoutes = require('./routes/checkout');
const agentRoutes = require('./routes/agent');
const simulationRoutes = require('./routes/simulation');
const { setInventory, getInventory, releaseReservation, getMetrics } = require('./redis/scripts');
const { orderQueue } = require('./queue/orderQueue');
require('./queue/worker');

process.on('unhandledRejection', (err) => {
    console.error('[Unhandled Rejection]', err.message || err);
});

const app = express();
const server = http.createServer(app);

app.use(cors({ origin: '*' }));
app.use(express.json());

// Socket-User Map for Reactive Heartbeat
const socketUserMap = new Map();
app.set('socketUserMap', socketUserMap);

// Request Metrics
const requestMetrics = { totalRequests: 0, rps: 0, windowStart: Date.now() };
app.set('requestMetrics', requestMetrics);

// Load shedding state
app.set('loadSheddingActive', false);

// Socket.IO
const io = new Server(server, { cors: { origin: '*' } });
app.set('io', io);

io.on('connection', (socket) => {
    console.log(`[Socket] Connected: ${socket.id}`);
    io.emit('connectionUpdate', { activeUsers: io.engine.clientsCount });

    socket.on('disconnect', async () => {
        console.log(`[Socket] Disconnected: ${socket.id}`);
        io.emit('connectionUpdate', { activeUsers: io.engine.clientsCount });

        const mapping = socketUserMap.get(socket.id);
        if (mapping) {
            const { userId, productId } = mapping;
            console.log(`💔 [HEARTBEAT] Lost connection for ${userId}. Releasing...`);
            try {
                const newStock = await releaseReservation(productId, userId);
                socketUserMap.delete(socket.id);
                if (newStock >= 0) {
                    console.log(`🔄 [HEARTBEAT] Reclaimed! Stock: ${newStock}`);
                    const m = await getMetrics(productId);
                    io.emit('inventoryUpdate', { productId, remainingStock: newStock, reservedCount: m.reservedCount, confirmedCount: m.confirmedCount });
                    io.emit('activityEvent', { type: 'HEARTBEAT_RELEASE', userId: userId.substring(0, 8), timestamp: Date.now() });
                }
            } catch (err) {
                console.error('[HEARTBEAT] Error:', err.message);
            }
        }
    });
});

// Routes
app.use('/api', checkoutRoutes);
app.use('/api/admin', agentRoutes);
app.use('/api', simulationRoutes);

app.post('/api/admin/reset', async (req, res) => {
    const inv = req.body.inventory || 10;
    await setInventory(1, inv);
    io.emit('inventoryUpdate', { productId: 1, remainingStock: inv, reservedCount: 0, confirmedCount: 0 });
    io.emit('activityEvent', { type: 'SYSTEM_RESET', timestamp: Date.now() });
    res.json({ message: "System Reset.", stock: inv });
});

// ============ START ============
const PORT = process.env.PORT || 4000;

async function startServer() {
    // Enable keyspace notifications using main redis client before subscribing
    const mainRedis = require('./redis/client');
    try {
        await mainRedis.config('SET', 'notify-keyspace-events', 'Ex');
        console.log('[Redis] Keyspace notifications enabled');
    } catch (err) {
        console.log('[Redis] Keyspace notifications:', err.message);
    }

    // Init inventory
    const currentStock = await getInventory(1);
    if (!currentStock) {
        await setInventory(1, 10);
        console.log(`🔋 Initialized with 10 items`);
    } else {
        console.log(`🔋 Existing stock: ${currentStock}`);
    }

    // Start HTTP server
    server.listen(PORT, () => {
        console.log(`\n🌙 ═══════════════════════════════════════════════`);
        console.log(`   THE MIDNIGHT GATE — Server v2.0`);
        console.log(`   http://localhost:${PORT}`);
        console.log(`   Reactive Heartbeat | Load Shedding | TTL Recovery`);
        console.log(`═══════════════════════════════════════════════════\n`);
    });

    // RPS tracker
    setInterval(() => {
        const elapsed = (Date.now() - requestMetrics.windowStart) / 1000;
        requestMetrics.rps = elapsed > 0 ? Math.round(requestMetrics.totalRequests / elapsed) : 0;
        if (elapsed > 5) {
            requestMetrics.totalRequests = 0;
            requestMetrics.windowStart = Date.now();
        }
    }, 1000);

    // Pressure-Adaptive Load Shedding
    let loadSheddingActive = false;
    setInterval(async () => {
        try {
            const waiting = await orderQueue.getWaitingCount();
            const active = await orderQueue.getActiveCount();
            const total = waiting + active;
            if (!loadSheddingActive && total >= 20) {
                loadSheddingActive = true;
                app.set('loadSheddingActive', true);
                io.emit('loadShedding', { active: true, queueDepth: total });
                io.emit('activityEvent', { type: 'LOAD_SHEDDING_ON', timestamp: Date.now() });
                console.log(`⚠️ [LOAD SHEDDING] ON — Queue: ${total}`);
            } else if (loadSheddingActive && total <= 5) {
                loadSheddingActive = false;
                app.set('loadSheddingActive', false);
                io.emit('loadShedding', { active: false, queueDepth: total });
                io.emit('activityEvent', { type: 'LOAD_SHEDDING_OFF', timestamp: Date.now() });
                console.log(`✅ [LOAD SHEDDING] OFF — Queue: ${total}`);
            }
        } catch (e) {}
    }, 500);

    // Keyspace notifications subscriber (separate connection in subscriber mode)
    const subscriber = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT) : 6380,
        maxRetriesPerRequest: null,
    });

    subscriber.subscribe('__keyevent@0__:expired', (err) => {
        if (err) console.error('[Redis] Subscription error:', err);
        else console.log('[Redis] 🔔 Listening for TTL expirations...');
    });

    subscriber.on('message', async (channel, expiredKey) => {
        if (!expiredKey.startsWith('reservation:')) return;
        const parts = expiredKey.split(':');
        if (parts.length !== 3) return;
        const userId = parts[1];
        const productId = parts[2];
        console.log(`⏰ [TTL] Expired: ${userId}`);
        try {
            const newStock = await releaseReservation(productId, userId);
            if (newStock >= 0) {
                console.log(`🔄 [TTL] Reclaimed! Stock: ${newStock}`);
                const m = await getMetrics(productId);
                io.emit('inventoryUpdate', { productId, remainingStock: newStock, reservedCount: m.reservedCount, confirmedCount: m.confirmedCount });
                io.emit('activityEvent', { type: 'TTL_RELEASE', userId: userId.substring(0, 8), timestamp: Date.now() });
            }
        } catch (err) {
            console.error('[TTL] Error:', err.message);
        }
    });
}

startServer().catch(err => {
    console.error('Failed to start:', err);
    process.exit(1);
});
