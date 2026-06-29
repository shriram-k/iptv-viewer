'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { makeKvClient, makePurge } = require('../src/cf-kv');

const ENV_KEYS = ['CF_ACCOUNT_ID', 'CF_KV_NAMESPACE_ID', 'CF_API_TOKEN', 'CF_ZONE_ID'];
function withEnv(env, fn) {
  const saved = {};
  for (const k of ENV_KEYS) { saved[k] = process.env[k]; delete process.env[k]; }
  Object.assign(process.env, env);
  const realFetch = global.fetch;
  return Promise.resolve(fn()).finally(() => {
    global.fetch = realFetch;
    for (const k of ENV_KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
  });
}

test('makeKvClient throws a clear error when a required env var is missing', () =>
  withEnv({ CF_API_TOKEN: 't' }, () => {
    assert.throws(() => makeKvClient(), /Missing required environment variable: CF_ACCOUNT_ID/);
  }));

test('put builds an account/namespace-scoped, key-encoded URL and sends the token', () =>
  withEnv({ CF_ACCOUNT_ID: 'acct', CF_KV_NAMESPACE_ID: 'ns', CF_API_TOKEN: 'tok' }, async () => {
    let seen;
    global.fetch = async (url, opts) => { seen = { url, opts }; return { ok: true }; };
    await makeKvClient().put('country:gb', '[]');
    assert.ok(seen.url.includes('/accounts/acct/storage/kv/namespaces/ns/values/country%3Agb'));
    assert.equal(seen.opts.headers.Authorization, 'Bearer tok');
    assert.equal(seen.opts.method, 'PUT');
  }));

test('purge is a no-op when CF_ZONE_ID is unset', () =>
  withEnv({ CF_API_TOKEN: 'tok' }, async () => {
    let called = false;
    global.fetch = async () => { called = true; return { ok: true }; };
    await makePurge()();
    assert.equal(called, false);
  }));

test('fetchResilient retries a transient 500 then succeeds', () =>
  withEnv({ CF_ACCOUNT_ID: 'a', CF_KV_NAMESPACE_ID: 'n', CF_API_TOKEN: 't' }, async () => {
    let calls = 0;
    global.fetch = async () => { calls++; return calls < 2 ? { ok: false, status: 500 } : { ok: true }; };
    await makeKvClient().put('k', 'v');
    assert.equal(calls, 2);
  }));

test('a 4xx fails fast without retry', () =>
  withEnv({ CF_ACCOUNT_ID: 'a', CF_KV_NAMESPACE_ID: 'n', CF_API_TOKEN: 't' }, async () => {
    let calls = 0;
    global.fetch = async () => { calls++; return { ok: false, status: 403 }; };
    await assert.rejects(() => makeKvClient().put('k', 'v'), /HTTP 403/);
    assert.equal(calls, 1, '4xx must not retry');
  }));
