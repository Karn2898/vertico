const test = require('node:test');
const assert = require('node:assert/strict');
const { ApiClient } = require('./ApiClient.js');

test('normalizes the default API base URL', () => {
  const client = new ApiClient('http://localhost:8000/api');
  assert.equal(client.baseUrl, 'http://localhost:8000');
});

test('preserves a root URL without the /api suffix', () => {
  const client = new ApiClient('http://localhost:8000');
  assert.equal(client.baseUrl, 'http://localhost:8000');
});
