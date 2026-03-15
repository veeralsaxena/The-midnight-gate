/**
 * Edge ML Anomaly Detector (Hackathon Edition)
 * ===========================================
 * A lightweight, sub-millisecond edge filter that calculates an anomaly score 
 * for incoming traffic to block Layer 7 DDoS or aggressive scrapers.
 * 
 * In a full production system, this could load a pre-trained TensorFlow.js 
 * isolation forest model or forward to a dedicated inference API. 
 * For real-time sub-ms latency, we use a sliding-window statistical model.
 */

class EdgeAnomalyDetector {
    constructor() {
        this.historyMap = new Map();
        this.CLEANUP_INTERVAL = 10000; // 10s
        
        // Auto-cleanup memory leak protection
        setInterval(() => this.cleanup(), this.CLEANUP_INTERVAL);
    }

    /**
     * Scores a request based on frequency, burst patterns, and velocity.
     * @returns {number} Anomaly score from 0.0 (safe) to 1.0 (malicious bot)
     */
    scoreRequest(reqContext) {
        const { ip, userId, userAgent } = reqContext;
        // Construct a signature for the requester
        const signature = `${ip}:${userId}`;
        const now = Date.now();

        if (!this.historyMap.has(signature)) {
            this.historyMap.set(signature, [now]);
            return 0.1; // Baseline score
        }

        const timeline = this.historyMap.get(signature);
        timeline.push(now);

        // Keep last 5 seconds of data for sliding window
        while (timeline.length > 0 && timeline[0] < now - 5000) {
            timeline.shift();
        }

        // Feature 1: Velocity (Requests per second)
        const requestCount = timeline.length;
        const velocity = requestCount / 5; 

        // Feature 2: Time Deltas (Are requests perfectly spaced? i.e., a script)
        let isProgrammatic = false;
        if (requestCount > 5) {
            const deltas = [];
            for (let i = 1; i < timeline.length; i++) {
                deltas.push(timeline[i] - timeline[i-1]);
            }
            // Calculate variance of deltas
            const meanDelta = deltas.reduce((a, b) => a + b) / deltas.length;
            const variance = deltas.reduce((a, b) => a + Math.pow(b - meanDelta, 2), 0) / deltas.length;
            
            // If variance is extremely low, it's a fixed-interval bot script
            if (variance < 50 && meanDelta < 500) {
                isProgrammatic = true;
            }
        }

        // Calculate final Anomaly Score (0.0 to 1.0)
        let score = 0.0;
        
        // High velocity penalty (Flash sale humans might click fast, but >10/sec is a bot)
        if (velocity > 2) score += 0.3;
        if (velocity > 5) score += 0.5;
        if (velocity > 10) score += 0.8;

        // Robotic pattern penalty
        if (isProgrammatic) score += 0.4;

        // Missing User-Agent is highly suspicious for API traffic
        if (!userAgent) score += 0.2;

        return Math.min(score, 1.0);
    }

    cleanup() {
        const now = Date.now();
        for (const [key, timeline] of this.historyMap.entries()) {
            if (timeline.length === 0 || timeline[timeline.length - 1] < now - this.CLEANUP_INTERVAL) {
                this.historyMap.delete(key);
            }
        }
    }
}

const detector = new EdgeAnomalyDetector();

module.exports = {
    anomalyMiddleware: (req, res, next) => {
        const reqContext = {
            ip: req.ip || req.connection.remoteAddress || 'unknown-ip',
            userId: req.body?.userId || 'anonymous',
            userAgent: req.headers['user-agent'] || ''
        };

        const score = detector.scoreRequest(reqContext);
        
        // Broadcast inference globally for War Room UI
        const io = req.app.get('io');
        if (io && score > 0.6) {
            io.emit('anomalyDetected', {
                score,
                ip: reqContext.ip,
                userId: reqContext.userId.substring(0, 8),
                timestamp: Date.now()
            });
        }

        // The Gate: Drop requests > 0.85 immediately
        if (score >= 0.85) {
            console.log(`🛡️ [ML FILTER] Dropped Malicious Request - Score: ${score.toFixed(2)} | IP: ${reqContext.ip}`);
            return res.status(403).json({
                error: "Traffic pattern flagged as anomalous. Connection dropped.",
                code: "ANOMALY_BLOCKED",
                score
            });
        }

        next();
    }
};
