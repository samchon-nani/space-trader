import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanCallsign, isAllowedGamePath, isSameSite } from '../src/lib/gameRules.ts';

test('callsigns are cleaned and checked', () => {
  assert.equal(cleanCallsign(' halcyon-01 '), 'HALCYON-01');
  for (const bad of ['ab', 'THIS-IS-TOO-LONG', 'bad name', '', null]) assert.equal(cleanCallsign(bad), null);
});
test('only game routes are allowed', () => {
  assert.ok(isAllowedGamePath('GET', ['systems', 'X1-AB', 'waypoints']));
  assert.ok(isAllowedGamePath('POST', ['my', 'ships', 'A-1', 'dock']));
  assert.ok(!isAllowedGamePath('POST', ['register']));
  assert.ok(!isAllowedGamePath('POST', ['systems', 'X1']));
  assert.ok(!isAllowedGamePath('GET', ['my', '..', 'register']));
  assert.ok(!isAllowedGamePath('DELETE', ['my', 'agent']));
  assert.ok(!isAllowedGamePath('GET', []));
});
test('changes must come from this site', () => {
  assert.ok(isSameSite('http://localhost:3000', 'localhost:3000'));
  assert.ok(!isSameSite('https://example.com', 'localhost:3000'));
  assert.ok(!isSameSite(null, 'localhost:3000'));
  assert.ok(!isSameSite('nonsense', 'localhost:3000'));
});
