const express = require('express');
const { atomicReserve, releaseReservation, confirmReservation, setInventory, getInventory, getMetrics } = require('../redis/scripts');
const { enqueueOrder } = require('../queue/orderQueue');
const pool = require('../database/client');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// Active simulation state
let simulationRunning = false;

// Ensure simulation_runs table exists
(async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS simulation_runs (
                id SERIAL PRIMARY KEY,
                total_users INT NOT NULL,
                inventory INT NOT NULL,
                abandon_rate DECIMAL(5,2),
                reserved INT DEFAULT 0,
                confirmed INT DEFAULT 0,
                rejected INT DEFAULT 0,
                abandoned INT DEFAULT 0,
                heartbeat_released INT DEFAULT 0,
                duration_ms INT DEFAULT 0,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('[DB] simulation_runs table ready');
    } catch (err) {
        console.error('[DB] Could not create simulation_runs:', err.message);
    }
})();

// ============================================================
// POST /api/simulate — Thundering Herd Visual Simulator
// ============================================================
router.post('/simulate', async (req, res) => {
    if (simulationRunning) {
        return res.status(409).json({ error: "Simulation already in progress." });
    }

    const totalUsers = Math.min(req.body.totalUsers || 1000, 50000);
    const inventory = req.body.inventory || 50;
    const abandonRate = Math.min(Math.max(req.body.abandonRate || 0.3, 0), 1);

    const io = req.app.get('io');
    simulationRunning = true;

    res.json({ message: "Simulation started.", totalUsers, inventory, abandonRate });

    try {
        // Reset
        await setInventory(1, inventory);
        io.emit('inventoryUpdate', { productId: 1, remainingStock: inventory, reservedCount: 0, confirmedCount: 0 });
        io.emit('simulationEvent', { phase: 'RESET', message: `System reset. Inventory: ${inventory}`, timestamp: Date.now() });
        await sleep(500);

        io.emit('simulationEvent', { phase: 'START', totalUsers, inventory, abandonRate, timestamp: Date.now() });
        await sleep(400);

        const stats = {
            totalUsers, inventory,
            cdnPassed: 0, rateLimited: 0,
            waitingRoomEntered: 0, waitingRoomReleased: 0, waitingRoomRejected: 0,
            redisReserved: 0, redisRejected: 0,
            bullmqEnqueued: 0, postgresWritten: 0,
            abandoned: 0, heartbeatReleased: 0, ttlReleased: 0, errors: 0,
            startTime: Date.now()
        };

        // Process in waves
        const WAVE_SIZE = Math.min(500, totalUsers);
        const NUM_WAVES = Math.ceil(totalUsers / WAVE_SIZE);
        let inventoryDepleted = false;

        for (let wave = 0; wave < NUM_WAVES; wave++) {
            const waveStart = wave * WAVE_SIZE;
            const waveEnd = Math.min(waveStart + WAVE_SIZE, totalUsers);
            const waveCount = waveEnd - waveStart;

            // ═══════════════════════════════════════════════
            // INSTANT GLOBAL REJECTION — if inventory is already 0,
            // reject ALL remaining users across ALL remaining waves at once
            // ═══════════════════════════════════════════════
            if (inventoryDepleted) {
                // Calculate ALL remaining users across this and all future waves
                let totalRemainingUsers = 0;
                for (let w = wave; w < NUM_WAVES; w++) {
                    const ws = w * WAVE_SIZE;
                    const we = Math.min(ws + WAVE_SIZE, totalUsers);
                    totalRemainingUsers += (we - ws);
                }

                // CDN pass-through for remaining
                stats.cdnPassed += totalRemainingUsers;
                io.emit('simulationEvent', {
                    phase: 'PHASE_CDN', entering: totalRemainingUsers, passed: totalRemainingUsers, blocked: 0,
                    totalCdnPassed: stats.cdnPassed, timestamp: Date.now()
                });
                await sleep(300);

                // Rate limit
                const remainingBots = Math.floor(totalRemainingUsers * 0.02);
                const remainingLegit = totalRemainingUsers - remainingBots;
                stats.rateLimited += remainingBots;
                io.emit('simulationEvent', {
                    phase: 'PHASE_RATE_LIMIT', entering: totalRemainingUsers, passed: remainingLegit, blocked: remainingBots,
                    totalRateLimited: stats.rateLimited, timestamp: Date.now()
                });
                await sleep(300);

                // Waiting room → ALL instantly rejected with SOLD OUT
                stats.waitingRoomEntered += remainingLegit;
                stats.waitingRoomRejected += remainingLegit;
                stats.redisRejected += remainingLegit;
                io.emit('simulationEvent', {
                    phase: 'PHASE_WAITING_ROOM',
                    entering: remainingLegit, released: 0, waiting: 0,
                    rejectedSoldOut: remainingLegit,
                    totalWaitingEntered: stats.waitingRoomEntered,
                    totalWaitingReleased: stats.waitingRoomReleased,
                    totalWaitingRejected: stats.waitingRoomRejected,
                    message: `🚫 SOLD OUT — ${remainingLegit.toLocaleString()} remaining users instantly rejected`,
                    timestamp: Date.now()
                });
                await sleep(400);

                // Emit rejection node update
                io.emit('simulationEvent', {
                    phase: 'PHASE_REDIS_GATE',
                    entering: 0, reserved: 0, rejected: remainingLegit,
                    totalReserved: stats.redisReserved, totalRejected: stats.redisRejected,
                    inventoryRemaining: 0,
                    timestamp: Date.now()
                });
                await sleep(200);

                // We are DONE — break out of all waves immediately
                break;
            }

            io.emit('simulationEvent', {
                phase: 'WAVE_START', waveNumber: wave + 1, totalWaves: NUM_WAVES,
                usersInWave: waveCount, timestamp: Date.now()
            });
            await sleep(250);

            // ── Phase 1: CDN ──
            stats.cdnPassed += waveCount;
            io.emit('simulationEvent', {
                phase: 'PHASE_CDN', entering: waveCount, passed: waveCount, blocked: 0,
                totalCdnPassed: stats.cdnPassed, timestamp: Date.now()
            });
            await sleep(350);

            // ── Phase 2: Rate Limiter ──
            const botCount = Math.floor(waveCount * 0.02);
            const rateLimitPassed = waveCount - botCount;
            stats.rateLimited += botCount;
            io.emit('simulationEvent', {
                phase: 'PHASE_RATE_LIMIT', entering: waveCount, passed: rateLimitPassed, blocked: botCount,
                totalRateLimited: stats.rateLimited, timestamp: Date.now()
            });
            await sleep(350);

            // ── Phase 3: WAITING ROOM ──
            stats.waitingRoomEntered += rateLimitPassed;

            // Release users from waiting room in batches to the Redis Gate
            const BATCH_SIZE = Math.min(100, rateLimitPassed);
            let waitingRemaining = rateLimitPassed;
            let waveBatchReleased = 0;
            let waveBatchRejectedSoldOut = 0;

            while (waitingRemaining > 0 && !inventoryDepleted) {
                const batchCount = Math.min(BATCH_SIZE, waitingRemaining);
                waitingRemaining -= batchCount;
                waveBatchReleased += batchCount;
                stats.waitingRoomReleased += batchCount;

                // Fire actual Redis reserve calls for this batch
                const reservePromises = [];
                for (let i = 0; i < batchCount; i++) {
                    const userId = `sim-${wave}-${waveBatchReleased - batchCount + i}-${Date.now()}`;
                    reservePromises.push(
                        atomicReserve(1, userId)
                            .then(result => ({ userId, result }))
                            .catch(err => ({ userId, result: 'error', error: err.message }))
                    );
                }

                const reserveResults = await Promise.all(reservePromises);
                let batchReserved = 0;
                let batchRejected = 0;
                const reservedUsers = [];

                for (const r of reserveResults) {
                    if (r.result === 'error') {
                        stats.errors++;
                        batchRejected++;
                    } else if (r.result >= 0) {
                        // Success: result is remaining stock (0 = last item)
                        batchReserved++;
                        stats.redisReserved++;
                        reservedUsers.push(r.userId);
                        if (r.result === 0) inventoryDepleted = true;
                    } else if (r.result === -3) {
                        // Sold out
                        batchRejected++;
                        stats.redisRejected++;
                    } else {
                        // -1 (already reserved) or -2 (already confirmed)
                        batchRejected++;
                        stats.redisRejected++;
                    }
                }

                // Emit Redis Gate phase for this batch
                io.emit('simulationEvent', {
                    phase: 'PHASE_REDIS_GATE',
                    entering: batchCount, reserved: batchReserved, rejected: batchRejected,
                    totalReserved: stats.redisReserved, totalRejected: stats.redisRejected,
                    inventoryRemaining: Math.max(0, inventory - stats.redisReserved),
                    timestamp: Date.now()
                });

                await sleep(250);

                // Confirm & abandon logic for reserved users
                const abandonCount = Math.floor(reservedUsers.length * abandonRate);
                const confirmUsers = reservedUsers.slice(0, reservedUsers.length - abandonCount);
                const abandonUsers = reservedUsers.slice(reservedUsers.length - abandonCount);

                // Confirm → BullMQ → Postgres
                for (const userId of confirmUsers) {
                    try {
                        const confirmResult = await confirmReservation(1, userId);
                        if (confirmResult === 1) {
                            stats.bullmqEnqueued++;
                            await enqueueOrder(1, userId, uuidv4());
                            stats.postgresWritten++;
                        }
                    } catch { stats.errors++; }
                }

                if (confirmUsers.length > 0) {
                    io.emit('simulationEvent', {
                        phase: 'PHASE_BULLMQ', enqueued: confirmUsers.length,
                        totalEnqueued: stats.bullmqEnqueued, timestamp: Date.now()
                    });
                    await sleep(200);
                    io.emit('simulationEvent', {
                        phase: 'PHASE_POSTGRES', written: confirmUsers.length,
                        totalWritten: stats.postgresWritten, timestamp: Date.now()
                    });
                    await sleep(200);
                }

                // Heartbeat release for abandoned
                for (const userId of abandonUsers) {
                    try {
                        const releaseResult = await releaseReservation(1, userId);
                        if (releaseResult >= 0) {
                            stats.heartbeatReleased++;
                            stats.abandoned++;
                            // Item returned → inventory not fully depleted anymore
                            inventoryDepleted = false;
                        }
                    } catch { stats.errors++; }
                }

                if (abandonUsers.length > 0) {
                    io.emit('simulationEvent', {
                        phase: 'PHASE_HEARTBEAT_RELEASE', released: abandonUsers.length,
                        totalHeartbeatReleased: stats.heartbeatReleased,
                        totalAbandoned: stats.abandoned, timestamp: Date.now()
                    });
                    await sleep(200);
                }

                // ═══════════════════════════════════════════════
                // CHECK: If inventory just hit 0 mid-batch,
                // instantly reject everyone still in this wave's waiting room
                // ═══════════════════════════════════════════════
                if (inventoryDepleted && waitingRemaining > 0) {
                    stats.waitingRoomRejected += waitingRemaining;
                    stats.redisRejected += waitingRemaining;
                    waveBatchRejectedSoldOut = waitingRemaining;

                    io.emit('simulationEvent', {
                        phase: 'PHASE_WAITING_ROOM',
                        entering: rateLimitPassed,
                        released: waveBatchReleased,
                        waiting: 0,
                        rejectedSoldOut: waitingRemaining,
                        totalWaitingEntered: stats.waitingRoomEntered,
                        totalWaitingReleased: stats.waitingRoomReleased,
                        totalWaitingRejected: stats.waitingRoomRejected,
                        message: `🚫 INVENTORY ZERO — ${waitingRemaining} users in waiting room instantly rejected`,
                        timestamp: Date.now()
                    });
                    await sleep(300);

                    // Break out of this wave's batch loop → next iteration of
                    // the outer wave loop will hit the global instant rejection
                    break;
                }
            }

            // Normal waiting room summary (only if we didn't already reject mid-batch)
            if (!inventoryDepleted) {
                io.emit('simulationEvent', {
                    phase: 'PHASE_WAITING_ROOM',
                    entering: rateLimitPassed,
                    released: waveBatchReleased,
                    waiting: 0,
                    rejectedSoldOut: waveBatchRejectedSoldOut,
                    totalWaitingEntered: stats.waitingRoomEntered,
                    totalWaitingReleased: stats.waitingRoomReleased,
                    totalWaitingRejected: stats.waitingRoomRejected,
                    message: 'Users released to Redis Gate',
                    timestamp: Date.now()
                });
            }

            // Emit current metrics
            const currentMetrics = await getMetrics(1);
            io.emit('inventoryUpdate', {
                productId: 1, remainingStock: currentMetrics.stock,
                reservedCount: currentMetrics.reservedCount, confirmedCount: currentMetrics.confirmedCount
            });

            io.emit('simulationEvent', {
                phase: 'WAVE_COMPLETE', waveNumber: wave + 1,
                stats: { ...stats }, timestamp: Date.now()
            });
            await sleep(300);
        }

        // ── FINAL ──
        stats.endTime = Date.now();
        stats.duration = stats.endTime - stats.startTime;
        const finalMetrics = await getMetrics(1);

        io.emit('simulationEvent', {
            phase: 'COMPLETE', stats,
            finalInventory: finalMetrics.stock,
            finalReserved: finalMetrics.reservedCount,
            finalConfirmed: finalMetrics.confirmedCount,
            timestamp: Date.now()
        });

        // Persist to database
        try {
            await pool.query(
                `INSERT INTO simulation_runs (total_users, inventory, abandon_rate, reserved, confirmed, rejected, abandoned, heartbeat_released, duration_ms) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                [totalUsers, inventory, abandonRate, stats.redisReserved, stats.postgresWritten, stats.redisRejected, stats.abandoned, stats.heartbeatReleased, stats.duration]
            );
            console.log('[Simulation] Run saved to database');
        } catch (err) {
            console.error('[Simulation] Failed to save run:', err.message);
        }

    } catch (err) {
        console.error('[Simulation Error]', err);
        io.emit('simulationEvent', { phase: 'ERROR', message: err.message, timestamp: Date.now() });
    } finally {
        simulationRunning = false;
    }
});

// GET /api/simulate/history — Previous simulation runs
router.get('/simulate/history', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM simulation_runs ORDER BY created_at DESC LIMIT 20'
        );
        res.json({ runs: result.rows });
    } catch (err) {
        res.json({ runs: [], error: err.message });
    }
});

// GET /api/simulate/status
router.get('/simulate/status', (req, res) => {
    res.json({ running: simulationRunning });
});

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = router;
