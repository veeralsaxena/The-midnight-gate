const express = require('express');
const { executeAgent } = require('../agent/commander');

const router = express.Router();

// ============================================================
// POST /api/admin/chat — The Agentic Commander
// Receives commands from the War Room Dashboard and uses LLM
// Tool Calling to execute system operations atomically.
// ============================================================
router.post('/chat', async (req, res) => {
    const { prompt } = req.body;
    
    if (!prompt) {
        return res.status(400).json({ error: "Missing prompt" });
    }
    
    try {
        // Pass the Express `app` instance so the agent can access global metrics & io
        const reply = await executeAgent(prompt, req.app);
        res.json({ reply });
    } catch (err) {
        console.error("Agent Route Error:", err);
        res.status(500).json({ error: "Agent encountered a critical failure.", details: err.message });
    }
});

module.exports = router;
