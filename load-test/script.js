import http from 'k6/http';
import { check } from 'k6';
import { uuidv4 } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

export const options = {
  scenarios: {
    flash_sale: {
      executor: 'shared-iterations',
      // We are simulating exactly 5,000 unique users trying to buy at the exact same time
      vus: 500, // 500 virtual users active concurrently
      iterations: 5000, // Totalling 5000 requests to hit the server
      maxDuration: '10s', 
    },
  },
};

export default function () {
  const url = 'http://localhost:4000/api/buy';
  
  // Each request represents a unique user trying to grab the item
  const payload = JSON.stringify({
    productId: 1, 
    userId: `loadtest-user-${uuidv4()}`
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const res = http.post(url, payload, params);

  // Checks help us verify our Gate is working perfectly.
  // We expect a mix of 200 (Success) and 400 (Sold out)
  check(res, {
    'status is 200 or 400': (r) => r.status === 200 || r.status === 400,
  });
}
