import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compareFiles } from './binary-compare.mjs';

async function withTempDir(fn) {
  const dir = await mkdtemp(join(tmpdir(), 'ipaship-compare-'));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test('reports identical files', async () => {
  await withTempDir(async dir => {
    const a = join(dir, 'a.bin');
    const b = join(dir, 'b.bin');
    await writeFile(a, Buffer.from('same bytes'));
    await writeFile(b, Buffer.from('same bytes'));

    const result = await compareFiles(a, b);

    assert.equal(result.identical, true);
    assert.equal(result.similarity, 1);
    assert.equal(result.firstDifference, null);
    assert.equal(result.segments.length, 1);
    assert.equal(result.segments[0].type, 'equal');
    assert.ok(result.knowledgeGraph.nodes.length >= 3);
    assert.ok(result.knowledgeGraph.edges.length >= 3);
  });
});

test('reports differing files with segments and graph', async () => {
  await withTempDir(async dir => {
    const a = join(dir, 'a.bin');
    const b = join(dir, 'b.bin');
    await writeFile(a, Buffer.from('hello world'));
    await writeFile(b, Buffer.from('hello brave world'));

    const result = await compareFiles(a, b, { chunkSize: 4 });

    assert.equal(result.identical, false);
    assert.equal(result.firstDifference, 6);
    assert.ok(result.similarity > 0 && result.similarity < 1);
    assert.ok(result.segments.some(segment => segment.type !== 'equal'));
    assert.ok(result.knowledgeGraph.nodes.some(node => node.type === 'file'));
    assert.ok(result.knowledgeGraph.edges.some(edge => edge.type === 'compared'));
  });
});

test('handles empty files', async () => {
  await withTempDir(async dir => {
    const a = join(dir, 'a.bin');
    const b = join(dir, 'b.bin');
    await writeFile(a, Buffer.alloc(0));
    await writeFile(b, Buffer.alloc(0));

    const result = await compareFiles(a, b);

    assert.equal(result.identical, true);
    assert.equal(result.similarity, 1);
    assert.equal(result.firstDifference, null);
  });
});
