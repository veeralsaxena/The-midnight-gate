# System Context for UI Generation: "The Midnight Gate"

**To the AI (Stitch/Claude/Gemini) generating the UI:**
You are acting as an expert Lead UX/UI Engineer and Frontend Developer for a highly competitive hackathon. We are building a sophisticated, enterprise-grade flash sale commerce system designed to solve the "Thundering Herd" problem. The backend is completely finished and battle-tested (Node.js, Redis Lua scripts, BullMQ, WebSockets). Your job is to generate a breathtaking, glass-morphism, dark-mode futuristic Next.js (React) Tailwind CSS frontend that perfectly explains and visualizes our system for the judges.

## Core Problem We are Solving
When thousands of users hit 'Buy' simultaneously during a limited-inventory drop (like a sneaker drop or concert tickets), servers crash, inventory goes negative due to race conditions (TOCTOU bugs), and users get stuck on loading screens.

## Our Architecture / The Solution
We implemented a 5-layer funnel to safely process traffic without crashing:
1. **Edge/CDN:** Serves static frontend to absorb initial read spikes.
2. **Rate Limiter Middleware:** Blocks bad actors before they reach the core.
3. **The Redis Gate:** The most crucial layer. We use In-Memory Atomic Redis Lua Scripts to check and deduct stock in a single, unbreakable transaction inside Redis's single-threaded event loop. This makes negative inventory mathematically impossible.
4. **Message Queue (BullMQ):** Successful reservations are placed in a queue to protect the database from massive concurrent write spikes.
5. **PostgreSQL Database:** Safely processes orders asynchronously.

## Our 3 Key Innovations (Must Highlight)
1. **Reactive Heartbeat Reservation:** Standard enterprise solutions use fixed 15-minute timers to hold items. If a user closes their tab, the item is stuck. We tie the item reservation directly to a persistent WebSocket connection (Heartbeat). If the user's connection drops (they close the tab or lose internet), the item is instantly released back to the pool in milliseconds.
2. **Pressure-Adaptive Load Shedding:** Instead of letting the server crash when bombarded, the backend monitors the internal BullMQ queue depth. If the queue hits > 20 pending items, the server proactively throws a `503 Service Unavailable (System Under Pressure)` rejecting new requests instantly to save the system.
3. **Two-Phase Commit with TTL Recovery:** A fail-safe mechanism. Redis Keyspace Notifications are used so that if the Node server dies and misses a dropped WebSocket, the inventory item has a strict 60-second TTL that forces Redis to auto-reclaim the stock.

---

## The Required Pages Structure
You need to generate stunning React code using Framer Motion, Tailwind CSS, and Lucide Icons for the following 3 pages:

### 1. The Landing Page / Pitch Deck (`/`)
*   **Purpose:** The public face of the project aimed at impressing the judges.
*   **Vibe:** Premium, dark mode, glowing accents (blues, purples, cyans), glassmorphism (`backdrop-blur`).
*   **Sections:**
    *   **Hero:** Headline ("The Midnight Gate: Survive the Strike") with glowing text. A bold sub-headline explaining the solution. Two big Call-to-Action buttons: "Launch Drop Simulator" and "Enter War Room".
    *   **The Architecture Funnel:** A visual or card-based layout explaining the 5-layer defense funnel (CDN -> Limiter -> Redis Gate -> BullMQ -> Postgres). Make it look like traffic is being systematically filtered.
    *   **Innovations Bento Grid:** A bento-box grid layout highlighting our 3 innovations (Reactive Heartbeat, Load Shedding, Atomic Lua Scripts) with nice icons and short descriptions.
    *   **Performance Stats:** Large glass counters showing "0 Race Conditions Guaranteed", "< 5ms Rejection Latency", "100% Data Consistency".

### 2. The Interactive Drop Simulator (`/drop`)
*   **Purpose:** Where users actually try to buy the product.
*   **Vibe:** Tense, exciting, high-stakes.
*   **Layout:**
    *   A centered product card (e.g., "Midnight Collector's Edition Sneaker").
    *   A live, animated "Available Stock" counter that updates in real-time.
    *   A big glowing "RESERVE ITEM" button.
    *   **Live Status Indicator:** A persistent "Heartbeat Connection: ACTIVE" glowing dot somewhere on the screen to prove the WebSocket is alive.
    *   **Interaction Flow:**
        1. Idle.
        2. Clicks Reserve -> Show a loading spinner.
        3. Success -> UI turns Green, shows "Item Reserved! You have 60 seconds to confirm." Show a "Confirm Purchase" button.
        4. Rejection -> UI flashes Red, shows "Rejected: Inventory Depleted or System Under Load."
    *   *Note: Instruct the user to open multiple browser tabs and close one mid-reservation to see the Reactive Heartbeat release the item back to the stock counter instantly.*

### 3. The War Room Dashboard (`/admin`)
*   **Purpose:** The god-view for the system administrators/judges to see the backend humming along safely while the Thundering Herd attacks.
*   **Vibe:** Mission control, terminal-style logs, live charts, highly technical.
*   **Layout:**
    *   **Header:** "System Observability / Live Telemetry".
    *   **Top Metric Cards:**
        *   Active WebSocket Connections (Live).
        *   Available Inventory (Live).
        *   BullMQ Pending Queue Depth (Live).
        *   Total Processed Orders.
    *   **The Log Feed:** A scrolling terminal window showing events in real-time (e.g., `[REDIS] Reservation acquired by User789`, `[WS] Heartbeat lost for User123, relinquishing lock`, `[SYS] Load shedding activated! Dropping 450 requests`).
    *   **Load Shedding Indicator:** A distinct visual alert (e.g., a siren icon or red border) that lights up specifically when the load shedding mechanism kicks in (Queue Depth > 20).

## UI Requirements & Constraints:
*   Use standard Tailwind CSS classes. No custom arbitrary values where standard spacing/colors work.
*   Use `lucide-react` for all icons.
*   Ensure text contrasts well against the dark backgrounds.
*   Keep the animations fast and buttery smooth (Framer Motion). Do not overdo animations to the point of lagging.
*   Assume the data (stock, logs, connections) will be fed in via standard React state arrays/variables later. Build the UI structural shells beautifully so the data can just be plugged in.
*   Do NOT use external 3D libraries like Spline or heavy WebGL canvases as they might break or add complexity; rely on CSS gradients, shadows, borders, and Framer Motion for the "wow" factor.
