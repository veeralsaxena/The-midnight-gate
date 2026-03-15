const redis = require('./client');

// ============================================================
// LUA SCRIPT 1: ATOMIC RESERVE
// Checks stock, decrements, creates a reservation with TTL
// KEYS[1] = inventory_key     (product:1:inventory)
// KEYS[2] = reserved_set_key  (product:1:reserved_users)
// KEYS[3] = confirmed_set_key (product:1:confirmed_users)
// KEYS[4] = reservation_key   (reservation:userId:productId)
// ARGV[1] = user_id
// ARGV[2] = ttl_seconds (reservation timeout)
// Returns: remaining stock (>0), 0 (sold out), -1 (already reserved), -2 (already confirmed)
// ============================================================
const ATOMIC_RESERVE_SCRIPT = `
  local inventory_key = KEYS[1]
  local reserved_set = KEYS[2]
  local confirmed_set = KEYS[3]
  local reservation_key = KEYS[4]
  local user_id = ARGV[1]
  local ttl = tonumber(ARGV[2])

  -- Already confirmed? Block duplicate
  if redis.call("SISMEMBER", confirmed_set, user_id) == 1 then
    return -2
  end

  -- Already reserved? Block duplicate
  if redis.call("SISMEMBER", reserved_set, user_id) == 1 then
    return -1
  end

  -- Check stock
  local stock = tonumber(redis.call("GET", inventory_key))
  if stock and stock > 0 then
    redis.call("DECR", inventory_key)
    redis.call("SADD", reserved_set, user_id)
    redis.call("SETEX", reservation_key, ttl, user_id)
    return stock - 1
  else
    return 0
  end
`;

// ============================================================
// LUA SCRIPT 2: RELEASE RESERVATION
// Called when WebSocket disconnects OR TTL expires
// Increments inventory back, removes from reserved set
// KEYS[1] = inventory_key
// KEYS[2] = reserved_set_key
// KEYS[3] = reservation_key
// ARGV[1] = user_id
// Returns: new stock count, or -1 if user wasn't reserved
// ============================================================
const RELEASE_RESERVATION_SCRIPT = `
  local inventory_key = KEYS[1]
  local reserved_set = KEYS[2]
  local reservation_key = KEYS[3]
  local user_id = ARGV[1]

  -- Only release if user is actually in the reserved set
  if redis.call("SISMEMBER", reserved_set, user_id) == 0 then
    return -1
  end

  -- Remove from reserved set
  redis.call("SREM", reserved_set, user_id)
  -- Delete reservation key (may already be gone if TTL expired)
  redis.call("DEL", reservation_key)
  -- Put item back
  local new_stock = redis.call("INCR", inventory_key)
  return new_stock
`;

// ============================================================
// LUA SCRIPT 3: CONFIRM RESERVATION
// Called after payment. Moves user from reserved → confirmed
// Deletes the TTL key so it won't trigger release
// KEYS[1] = reserved_set_key
// KEYS[2] = confirmed_set_key
// KEYS[3] = reservation_key
// ARGV[1] = user_id
// Returns: 1 (success), -1 (not reserved)
// ============================================================
const CONFIRM_RESERVATION_SCRIPT = `
  local reserved_set = KEYS[1]
  local confirmed_set = KEYS[2]
  local reservation_key = KEYS[3]
  local user_id = ARGV[1]

  if redis.call("SISMEMBER", reserved_set, user_id) == 0 then
    return -1
  end

  redis.call("SREM", reserved_set, user_id)
  redis.call("SADD", confirmed_set, user_id)
  redis.call("DEL", reservation_key)
  return 1
`;

// Define custom commands
redis.defineCommand('atomicReserve', {
  numberOfKeys: 4,
  lua: ATOMIC_RESERVE_SCRIPT,
});

redis.defineCommand('releaseReservation', {
  numberOfKeys: 3,
  lua: RELEASE_RESERVATION_SCRIPT,
});

redis.defineCommand('confirmReservation', {
  numberOfKeys: 3,
  lua: CONFIRM_RESERVATION_SCRIPT,
});

// ============================================================
// EXPORTED FUNCTIONS
// ============================================================

const RESERVATION_TTL = 60; // 60 seconds to complete payment

module.exports = {
  RESERVATION_TTL,

  atomicReserve: (productId, userId) => {
    return redis.atomicReserve(
      `product:${productId}:inventory`,
      `product:${productId}:reserved_users`,
      `product:${productId}:confirmed_users`,
      `reservation:${userId}:${productId}`,
      userId,
      RESERVATION_TTL
    );
  },

  releaseReservation: (productId, userId) => {
    return redis.releaseReservation(
      `product:${productId}:inventory`,
      `product:${productId}:reserved_users`,
      `reservation:${userId}:${productId}`,
      userId
    );
  },

  confirmReservation: (productId, userId) => {
    return redis.confirmReservation(
      `product:${productId}:reserved_users`,
      `product:${productId}:confirmed_users`,
      `reservation:${userId}:${productId}`,
      userId
    );
  },

  setInventory: async (productId, amount) => {
    // Full reset: clear all sets and counters
    await redis.del(`product:${productId}:reserved_users`);
    await redis.del(`product:${productId}:confirmed_users`);
    // Clear any leftover reservation keys
    const keys = await redis.keys(`reservation:*:${productId}`);
    if (keys.length > 0) await redis.del(...keys);
    return redis.set(`product:${productId}:inventory`, amount);
  },

  getInventory: (productId) => {
    return redis.get(`product:${productId}:inventory`);
  },

  getMetrics: async (productId) => {
    const [stock, reservedCount, confirmedCount] = await Promise.all([
      redis.get(`product:${productId}:inventory`),
      redis.scard(`product:${productId}:reserved_users`),
      redis.scard(`product:${productId}:confirmed_users`),
    ]);
    return {
      stock: parseInt(stock) || 0,
      reservedCount: reservedCount || 0,
      confirmedCount: confirmedCount || 0,
    };
  },
};
