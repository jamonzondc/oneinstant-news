import assert from 'node:assert/strict';
import { test } from 'node:test';
import { page, PAGE_SIZE } from '../src/domain/paging.ts';
import { moreText } from '../src/ui/render.ts';

test('paints one block, then one more per tap, never past the end', () => {
  assert.equal(PAGE_SIZE, 40);
  assert.deepEqual(page(260, PAGE_SIZE), { end: 40, left: 220, next: 40 });
  assert.deepEqual(page(260, 80), { end: 80, left: 180, next: 40 });
  assert.deepEqual(page(100, 80), { end: 80, left: 20, next: 20 });
  assert.deepEqual(page(100, 120), { end: 100, left: 0, next: 0 });
});

test('fewer news than a block: everything painted, nothing left', () => {
  assert.deepEqual(page(14, PAGE_SIZE), { end: 14, left: 0, next: 0 });
  assert.deepEqual(page(0, PAGE_SIZE), { end: 0, left: 0, next: 0 });
  assert.deepEqual(page(14, 0), { end: 14, left: 0, next: 0 }, 'a limit below one block is one block');
});

test('button text says how many come next and how many are left', () => {
  assert.equal(moreText(page(260, 40)), 'Ver 40 más (quedan 220)');
  assert.equal(moreText(page(45, 40)), 'Ver 5 más');
});
