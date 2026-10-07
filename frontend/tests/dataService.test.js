import test from 'node:test';
import assert from 'node:assert/strict';
import { loadOureaData } from '../src/services/dataService.js';

function response({ status = 200, body = '{}' } = {}) {
  return {
    status,
    ok: status >= 200 && status < 300,
    async text() {
      return body;
    },
  };
}

test('required cost context is not optional', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).includes('cost_context.json')) {
      return { status: 404, ok: false, async text() { return 'Not found'; } };
    }
    return response({ body: '{}' });
  };

  try {
    await assert.rejects(
      () => loadOureaData(),
      /Failed to load .*cost_context\.json: HTTP 404/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('required climate context is not optional', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).includes('climate_context.json')) {
      return { status: 404, ok: false, async text() { return 'Not found'; } };
    }
    return response({ body: '{}' });
  };

  try {
    await assert.rejects(
      () => loadOureaData(),
      /Failed to load .*climate_context\.json: HTTP 404/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('malformed required JSON fails visibly', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).includes('buildings.geojson')) {
      return response({ body: 'not-json' });
    }
    return response({ body: '{}' });
  };

  try {
    await assert.rejects(
      () => loadOureaData(),
      /Failed to parse \/data\/buildings\.geojson as JSON/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('required HTTP errors propagate with the source path', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).includes('hazard.geojson')) {
      return response({ status: 503, body: 'unavailable' });
    }
    return response({ body: '{}' });
  };

  try {
    await assert.rejects(
      () => loadOureaData(),
      /Failed to load \/data\/hazard\.geojson: HTTP 503/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('optional community evidence file may be absent without failing required data', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).includes('community_evidence.json')) {
      return { status: 404, ok: false, async text() { return 'Not found'; } };
    }
    return response({ body: '{}' });
  };

  try {
    const data = await loadOureaData();
    assert.equal(data.communityEvidence, null);
    assert.ok(Array.isArray(data.evidence.global_guardrails));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('empty community sentinel loads as not assessed rather than 404', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).includes('community_evidence.json')) {
      return response({
        body: JSON.stringify({
          schema: 'ourea-community-evidence',
          schema_version: 1,
          status: 'absent',
          template: false,
          records: [],
        }),
      });
    }
    return response({ body: '{}' });
  };

  try {
    const data = await loadOureaData();
    assert.equal(data.communityEvidence.status, 'absent');
    assert.deepEqual(data.communityEvidence.records, []);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('SPA HTML fallback for community evidence is absent rather than invalid', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).includes('community_evidence.json')) {
      return response({ body: '<!doctype html><html></html>' });
    }
    return response({ body: '{}' });
  };

  try {
    const data = await loadOureaData();
    assert.equal(data.communityEvidence, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('malformed optional community evidence is invalid rather than absent', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).includes('community_evidence.json')) {
      return response({ body: '{not-json' });
    }
    return response({ body: '{}' });
  };

  try {
    const data = await loadOureaData();
    assert.equal(data.communityEvidence.__invalid, true);
    assert.notEqual(data.communityEvidence, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
