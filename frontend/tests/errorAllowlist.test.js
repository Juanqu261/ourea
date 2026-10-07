import assert from 'node:assert/strict';
import test from 'node:test';
import { isAllowedConsoleError, isAllowedFailedRequest } from '../e2e/errorAllowlist.js';

test('sparse DEM tile 404s are allowlisted by concrete URL', () => {
  assert.ok(isAllowedFailedRequest('https://ybedoyab.github.io/ourea/terrain/12/1205/1894.png', '404'));
  assert.ok(isAllowedConsoleError('Failed to load resource: the server responded with a status of 404 ()', 'https://ybedoyab.github.io/ourea/terrain/12/1205/1894.png'));
});

test('Chromium URL-less 404 console text is classified without a generic Failed-to-load regex', () => {
  assert.equal(
    isAllowedConsoleError('Failed to load resource: the server responded with a status of 404 ()'),
    true,
  );
  assert.equal(
    isAllowedConsoleError('Failed to load resource: the server responded with a status of 500 ()'),
    false,
  );
  assert.equal(isAllowedConsoleError('Uncaught TypeError: Cannot read properties of null'), false);
  assert.equal(isAllowedFailedRequest('https://ybedoyab.github.io/ourea/data/climate_context.json', '404'), null);
});
