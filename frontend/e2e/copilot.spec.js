import { expect, test } from '@playwright/test';

// The decision AI service is mocked: no Python, no key. The build itself has a blank AI URL.
const API = 'http://127.0.0.1:8787/api';
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST',
};

const ANSWER = {
  status: 'answered',
  tools: [{ tool: 'price_of_constraint', fingerprint: 'ourea-3e283bb2' }],
  answer: {
    respuesta: 'Exigir infraestructura gris baja el puntaje de 2,81 a 2,38, una pérdida de 15%.',
    cifras: [
      { valor: 2.8125, texto: '2,81', unidad: '', herramienta: 'price_of_constraint', huella: 'ourea-3e283bb2' },
      { valor: 2.38, texto: '2,38', unidad: '', herramienta: 'price_of_constraint', huella: 'ourea-3e283bb2' },
      { valor: 0.153778, texto: '15%', unidad: '%', herramienta: 'price_of_constraint', huella: 'ourea-3e283bb2' },
    ],
    etiquetas: ['Inferencia del equipo'],
    brechas_relacionadas: ['gap-company-road'],
    fuentes: ['reto-brief-2026'],
    enfoque_mapa: { intervention_id: 'infra_resilient' },
  },
};

const sse = (events) => events.map(([event, data]) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`).join('');

async function mockService(page) {
  await page.addInitScript((url) => { window.__OUREA_AI_API_URL = url; }, API);
  await page.route(`${API}/**`, async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    if (path.endsWith('/health')) return route.fulfill({ headers: CORS, json: { ok: true, ai_enabled: true, tools: [], engine_pending: [] } });
    if (path.endsWith('/audit')) {
      return route.fulfill({ headers: CORS, json: { findings: [], critical: 0, major: 0, minor: 0, verified_claims: 11, claims: 19, export_allowed: true } });
    }
    if (path.endsWith('/agents/copilot')) {
      return route.fulfill({
        headers: { ...CORS, 'Content-Type': 'text/event-stream' },
        body: sse([['start', { thread_id: 'thread-e2e', run_id: 'run-e2e' }], ['tool', { name: 'price_of_constraint' }], ['answer', ANSWER]]),
      });
    }
    return route.fulfill({ status: 404, headers: CORS, json: {} });
  });
}

test('copilot answers with traced figures and moves the map', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await mockService(page);
  await page.goto('/');
  await page.getByTestId('open-copilot').click();
  await page.getByRole('button', { name: '¿Y si exigimos infraestructura gris?' }).click();
  await expect(page.getByTestId('copilot-answer')).toContainText('2,38');
  await expect(page.getByTestId('copilot-figures')).toContainText('ourea-3e283bb2');
  await expect(page.getByTestId('copilot-figures')).toContainText('price_of_constraint');
  await page.getByTestId('copilot-map').click();
  await expect(page.getByTestId('copilot-drawer-body')).toHaveCount(0);
  await expect(page.getByTestId('map-focus-card')).toContainText('Infraestructura resiliente', { timeout: 20000 });

  while (await page.getByTestId('step-followup').count() === 0) {
    await page.getByTestId('step-next').click();
  }
  await expect(page.getByTestId('audit-badge')).toContainText('0 hallazgos críticos · 11 afirmaciones verificadas');
});

test('without the service no AI control renders', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('app-title')).toHaveText('Ourea');
  await expect(page.getByTestId('open-copilot')).toHaveCount(0);
  while (await page.getByTestId('step-followup').count() === 0) {
    await page.getByTestId('step-next').click();
  }
  await expect(page.getByTestId('audit-badge')).toHaveText('Auditoría disponible con el servicio local');
});
