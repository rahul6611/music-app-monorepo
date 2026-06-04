import http from 'k6/http';
import { check, sleep, group } from 'k6';

// Configuration
const BASE_URL = `${__ENV.JITSI_URL || 'https://192.168.29.138:8443'}`;
const ROOM_NAME = __ENV.ROOM_NAME || 'loadtest-' + new Date().getTime();

// Test stages: ramp up to peak, then sustain
export const options = {
  stages: [
    { duration: '30s', target: 5 },      // Ramp up to 5 users
    { duration: '1m', target: 10 },      // Ramp to 10 users
    { duration: '2m', target: 20 },      // Ramp to 20 users
    { duration: '2m', target: 20 },      // Sustain 20 users
    { duration: '1m', target: 10 },      // Ramp down to 10
    { duration: '30s', target: 0 },      // Ramp down to 0
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],  // 95% requests < 500ms, 99% < 1s
    http_req_failed: ['rate<0.1'],                   // Error rate < 10%
  },
};

export default function () {
  const userId = `user-${__VU}-${__ITER}`;
  const roomUrl = `${BASE_URL}/${ROOM_NAME}?jwt=${generateMockJWT(userId)}`;

  group('Join Meeting', () => {
    // Fetch the room page
    let res = http.get(roomUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      insecureSkipTLSVerify: true, // For self-signed certs
      timeout: '30s',
    });

    check(res, {
      'status is 200': (r) => r.status === 200,
      'page load < 2s': (r) => r.timings.duration < 2000,
      'has iframe': (r) => r.body.includes('iframe'),
    });
  });

  // Simulate API calls for room stats
  group('Room Statistics', () => {
    let statsRes = http.get(
      `${BASE_URL}/api/v1/rooms/${ROOM_NAME}/stats`,
      { insecureSkipTLSVerify: true }
    );
    
    check(statsRes, {
      'stats endpoint responds': (r) => r.status === 200 || r.status === 404, // 404 if no stats endpoint
    });
  });

  // Simulate WebSocket-like polling for real-time updates
  sleep(Math.random() * 5 + 5); // Simulate user in room for 5-10 seconds

  group('Leave Meeting', () => {
    let leaveRes = http.post(
      `${BASE_URL}/api/v1/rooms/${ROOM_NAME}/leave`,
      null,
      { insecureSkipTLSVerify: true }
    );
    
    check(leaveRes, {
      'leave request completes': (r) => r.status < 500, // Accept any non-server error
    });
  });
}

// Helper to generate a mock JWT (Jitsi doesn't require auth in this config, but we can simulate it)
function generateMockJWT(userId) {
  // This is a simplified mock. Real JWT would need proper signing.
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({
    sub: userId,
    aud: 'jitsi',
    iss: 'jitsi',
    name: userId,
    exp: Math.floor(Date.now() / 1000) + 3600,
  }));
  return `${header}.${payload}.mock-signature`;
}
