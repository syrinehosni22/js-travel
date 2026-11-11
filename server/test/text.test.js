import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanText, pdfText } from '../src/services/text.js';

test('numéro copié depuis WhatsApp : caractères invisibles retirés', () => {
  assert.equal(cleanText('‪+216 24 500 358‬'), '+216 24 500 358');
});
test('bon PDF : flèche remplacée, accents conservés', () => {
  assert.equal(pdfText('Aéroport Tunis-Carthage (TUN) → Sousse'), 'Aéroport Tunis-Carthage (TUN) – Sousse');
  assert.equal(pdfText('297,60 € · Hôtel'), '297,60 € · Hôtel');
});
