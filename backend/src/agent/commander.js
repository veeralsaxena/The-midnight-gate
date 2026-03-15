const { GoogleGenAI, Type } = require('@google/genai');
const { getMetrics, setInventory } = require('../redis/scripts');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Define the tools (Agent Capabilities)
const getSystemMetricsTool = {
    name: "get_system_metrics",
    description: "Returns the real-time system metrics including active connections, queue length, load shedding status, and requests per second (RPS).",
    parameters: { type: Type.OBJECT, properties: {} }
};

const resetSystemTool = {
    name: "reset_system",
    description: "Flushes the Redis inventory, deletes all reservations, and resets the product stock to a specified amount.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            stock: { type: Type.INTEGER, description: "The amount of stock to reset to. Usually 10." }
        },
        required: ["stock"]
    }
};

const setLoadSheddingTool = {
    name: "set_load_shedding_override",
    description: "Forces the load shedding state of the API on or off. Useful to manually stop traffic if an anomaly is detected.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            active: { type: Type.BOOLEAN, description: "True to enable load shedding (block new traffic), false to disable." }
        },
        required: ["active"]
    }
};

const tools = [{ functionDeclarations: [getSystemMetricsTool, resetSystemTool, setLoadSheddingTool] }];

async function executeAgent(prompt, app) {
    const chat = ai.chats.create({
        model: "gemini-2.5-flash",
        config: {
            systemInstruction: "You are the Agentic Commander for 'The Midnight Gate', an enterprise flash sale system. You monitor traffic, queue depth, and inventory. You have access to tools to manage the system. Provide concise, professional, military-style updates. Do NOT conversationalize excessively. When asked to perform an action, use the appropriate function call, then report the result. If a user asks a general question, answer it based on the system architecture (Redis Lua, BullMQ, WebSocket heartbeats, ML Traffic Filtering, Vector DB Soft Landing).",
            tools: tools,
            temperature: 0.1
        }
    });

    let responseText = "";
    
    try {
        let response = await chat.sendMessage({ message: prompt });
        
        // Handle function calls if Gemini decides to use a tool
        if (response.functionCalls && response.functionCalls.length > 0) {
            const call = response.functionCalls[0];
            const name = call.name;
            const args = call.args;
            
            let resultData = {};
            
            if (name === "get_system_metrics") {
                const metrics = app.get('requestMetrics');
                const io = app.get('io');
                const loadSheddingActive = app.get('loadSheddingActive');
                const productMetrics = await getMetrics(1); // Item 1
                
                resultData = {
                    activeConnections: io ? io.engine.clientsCount : 0,
                    loadSheddingActive: loadSheddingActive || false,
                    requestsPerSecond: metrics ? metrics.rps : 0,
                    stock: productMetrics.stock,
                    reservedCount: productMetrics.reservedCount
                };
            } 
            else if (name === "reset_system") {
                const inv = args.stock || 10;
                await setInventory(1, inv);
                
                const io = app.get('io');
                if (io) {
                    io.emit('inventoryUpdate', { productId: 1, remainingStock: inv, reservedCount: 0, confirmedCount: 0 });
                    io.emit('activityEvent', { type: 'SYSTEM_RESET', timestamp: Date.now() });
                }
                resultData = { success: true, message: `System reset to ${inv} stock.` };
            }
            else if (name === "set_load_shedding_override") {
                app.set('loadSheddingActive', args.active);
                const io = app.get('io');
                if (io) {
                    io.emit('loadShedding', { active: args.active, queueDepth: -1 });
                    io.emit('activityEvent', { type: args.active ? 'LOAD_SHEDDING_ON' : 'LOAD_SHEDDING_OFF', timestamp: Date.now() });
                }
                resultData = { success: true, state: args.active ? "Shedding ON" : "Shedding OFF" };
            }

            // Send the tool result back to Gemini to get the final text response
            const toolResponseResult = [{
                functionResponse: {
                    name: name,
                    response: resultData
                }
            }];
            
            response = await chat.sendMessage(toolResponseResult);
        }

        responseText = response.text || "Command executed.";
        
    } catch (err) {
        console.error("Agent Error:", err);
        responseText = `Agent encountered a cognitive failure: ${err.message}`;
    }

    return responseText;
}

module.exports = { executeAgent };
