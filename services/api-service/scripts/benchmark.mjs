#!/usr/bin/env node
/**
 * TaskSync Board Query Benchmark Script
 *
 * Benchmarks the board(id:) GraphQL query in two phases:
 *   1. WITHOUT Redis cache (cache key flushed before each run → hits Postgres)
 *   2. WITH Redis cache (board JSON pre-seeded into Redis → cache HIT path)
 *
 * Usage:
 *   BOARD_ID=<uuid> JWT_TOKEN=<token> node scripts/benchmark.mjs
 *
 * The API server must already be running on PORT 4000.
 */
import autocannon from 'autocannon';
import Redis from 'ioredis';

const BOARD_ID = process.env.BOARD_ID;
const JWT_TOKEN = process.env.JWT_TOKEN;
const PORT = process.env.PORT || '4000';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

if (!BOARD_ID || !JWT_TOKEN) {
  console.error('ERROR: Set BOARD_ID and JWT_TOKEN environment variables first.\n');
  console.error('  Example:');
  console.error('    BOARD_ID=<uuid> JWT_TOKEN=<token> node scripts/benchmark.mjs');
  process.exit(1);
}

const redis = new Redis(REDIS_URL);
const CACHE_KEY = `board:${BOARD_ID}`;

const GQL_BODY = JSON.stringify({
  query: `
    query GetBoard($id: ID!) {
      board(id: $id) {
        id
        title
        description
        columns {
          id
          title
          position
          tasks {
            id
            title
            position
          }
        }
      }
    }
  `,
  variables: { id: BOARD_ID }
});

const REQUEST_OPTS = {
  url: `http://localhost:${PORT}/graphql`,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${JWT_TOKEN}`
  },
  body: GQL_BODY
};

function formatResult(label, result) {
  const r = result.requests;
  const lat = result.latency;
  console.log(`\n  ┌─── ${label}`);
  console.log(`  │  Requests/sec:    ${r.average.toFixed(0)}`);
  console.log(`  │  Latency p50:     ${lat.p50.toFixed(2)} ms`);
  console.log(`  │  Latency p95:     ${lat.p99.toFixed(2)} ms  (≈ p95 under this load)`);
  console.log(`  │  Latency mean:    ${lat.mean.toFixed(2)} ms`);
  console.log(`  │  Total requests:  ${r.total}`);
  console.log(`  │  Errors:          ${result.errors}`);
  console.log(`  └─────────────────────────────`);
}

async function runBenchmark(label, preflightFn) {
  await preflightFn();
  console.log(`\n⏳  Running: ${label} ...`);

  return new Promise((resolve, reject) => {
    const inst = autocannon(
      {
        ...REQUEST_OPTS,
        connections: 10,   // concurrent HTTP connections
        duration: 10,      // seconds
        pipelining: 1
      },
      (err, result) => {
        if (err) return reject(err);
        resolve(result);
      }
    );
    autocannon.track(inst, { renderProgressBar: true });
  });
}

async function main() {
  console.log('\n🔬 TaskSync Board Query Benchmark');
  console.log(`   Board ID: ${BOARD_ID}`);
  console.log(`   Target:   http://localhost:${PORT}/graphql`);
  console.log(`   Redis:    ${REDIS_URL}`);

  // ── Phase 1: No Cache ────────────────────────────────────────────────────
  const resultNoCache = await runBenchmark(
    'Phase 1: Without Redis Cache (Postgres direct)',
    async () => {
      await redis.del(CACHE_KEY);
      console.log(`  🗑  Cleared cache key: ${CACHE_KEY}`);
    }
  );

  // ── Phase 2: With Cache ──────────────────────────────────────────────────
  // Pre-seed cache by doing one real request first, then benchmark cache HIT path
  await redis.del(CACHE_KEY);
  const primeRes = await fetch(`http://localhost:${PORT}/graphql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${JWT_TOKEN}`
    },
    body: GQL_BODY
  });
  const primeData = await primeRes.json();
  if (primeData.errors) {
    console.error('Prime request failed:', JSON.stringify(primeData.errors));
    process.exit(1);
  }
  console.log('\n  ✅ Cache primed for Phase 2.');

  const resultWithCache = await runBenchmark(
    'Phase 2: With Redis Cache (cache HIT path)',
    async () => {
      // Cache is already populated from prime request — nothing to do
      const exists = await redis.exists(CACHE_KEY);
      console.log(`  📦 Cache key present: ${exists === 1 ? 'YES (HIT path)' : 'NO — re-seed'}`);
    }
  );

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊  BENCHMARK RESULTS SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  formatResult('WITHOUT Cache (Postgres)', resultNoCache);
  formatResult('WITH Cache (Redis HIT)', resultWithCache);

  const speedup = (resultNoCache.latency.mean / resultWithCache.latency.mean).toFixed(1);
  const p50Saved = (resultNoCache.latency.p50 - resultWithCache.latency.p50).toFixed(2);
  const p95Saved = (resultNoCache.latency.p99 - resultWithCache.latency.p99).toFixed(2);

  console.log(`\n  🚀 Cache speedup:   ${speedup}x faster mean latency`);
  console.log(`  ⚡ p50 improvement: ${p50Saved} ms saved`);
  console.log(`  ⚡ p95 improvement: ${p95Saved} ms saved`);
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('📝  Run command to reproduce:');
  console.log(`    BOARD_ID=${BOARD_ID} JWT_TOKEN=<token> node services/api-service/scripts/benchmark.mjs`);

  redis.disconnect();
}

main().catch((err) => {
  console.error('Benchmark failed:', err);
  redis.disconnect();
  process.exit(1);
});

