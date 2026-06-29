// Quick test to verify if Hono sub-app context propagates to parent middleware
const { Hono } = require('hono');

// Parent app with middleware that runs AFTER
const parentApp = new Hono();
let auditTriggered = false;

parentApp.use('/api/*', async (c, next) => {
  await next();
  console.log('📋 Audit middleware running (AFTER next)');
  console.log('   c.get("auth"):', c.get('auth'));
  if (c.get('auth')) auditTriggered = true;
});

// Child/sub-app that sets auth
const childRoutes = new Hono();
childRoutes.post('/', async (c, next) => {
  console.log('1. Child route handler');
  c.set('auth', { sub: 'test-user', type: 'merchant_user' });
  console.log('2. Child set auth:', c.get('auth'));
  return c.json({ ok: true });
});

parentApp.route('/api/child', childRoutes);

// Simulate request
async function test() {
  console.log('\n=== Testing Hono sub-app context propagation ===\n');
  const res = await parentApp.request('/api/child', { method: 'POST' });
  console.log('\nResponse status:', res.status);
  console.log('Audit middleware triggered with auth context:', auditTriggered);
  console.log('\nConclusion:', auditTriggered 
    ? '✅ Context DOES propagate' 
    : '❌ Context DOES NOT propagate (BUG!)');
}

test().catch(console.error);
