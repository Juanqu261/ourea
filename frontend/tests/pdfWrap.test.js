import assert from 'node:assert/strict';
import test from 'node:test';
import { wrapLine } from '../src/domain/pdfDocument.js';

test('wrapLine splits a URL longer than 200 characters', () => {
  const url = `https://example.test/${'section/'.repeat(30)}document.pdf?query=${'a'.repeat(40)}&lang=en`;
  assert.ok(url.length > 200);
  const lines = wrapLine(url, 180, 9, false);
  assert.ok(lines.length > 1);
  assert.equal(lines.join('').replace(/\s/g, ''), url.replace(/\s/g, ''));
});

test('wrapLine splits a long source title with tildes', () => {
  const title = 'Alcaldía de Medellín — Informe de obras hidráulicas de prefactibilidad para corredores de drenaje en ladera urbana 2026';
  const lines = wrapLine(title, 160, 9, false);
  assert.ok(lines.length >= 2);
});

test('wrapLine keeps a source without a date readable', () => {
  const line = 'Alcaldía de Medellín - hydraulic works. date not stated. municipal public-works report.';
  const lines = wrapLine(line, 200, 9, false);
  assert.ok(lines.join(' ').includes('date not stated'));
});
