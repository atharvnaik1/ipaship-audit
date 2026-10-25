import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const DEFAULT_CHUNK_SIZE = 64;
const MAX_CHUNKS = 4096;
const LOOKAHEAD = 64;

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function chooseChunkSize(aLength, bLength) {
  const maxLength = Math.max(aLength, bLength);
  return Math.max(DEFAULT_CHUNK_SIZE, Math.ceil(maxLength / MAX_CHUNKS));
}

function toChunks(buffer, chunkSize) {
  const chunks = [];
  for (let offset = 0; offset < buffer.length; offset += chunkSize) {
    const data = buffer.subarray(offset, Math.min(offset + chunkSize, buffer.length));
    chunks.push({ offset, length: data.length, hash: sha256(data) });
  }
  return chunks;
}

function firstDifference(a, b) {
  const limit = Math.min(a.length, b.length);
  for (let i = 0; i < limit; i += 1) {
    if (a[i] !== b[i]) return i;
  }
  return a.length === b.length ? null : limit;
}

function pushSegment(segments, segment) {
  const last = segments[segments.length - 1];
  if (
    last &&
    last.type === segment.type &&
    last.aOffset + last.aLength === segment.aOffset &&
    last.bOffset + last.bLength === segment.bOffset
  ) {
    last.aLength += segment.aLength;
    last.bLength += segment.bLength;
    last.aHash = null;
    last.bHash = null;
    return;
  }
  segments.push(segment);
}

function buildSegments(aChunks, bChunks, aLength, bLength) {
  const segments = [];
  let i = 0;
  let j = 0;

  while (i < aChunks.length || j < bChunks.length) {
    if (i < aChunks.length && j < bChunks.length && aChunks[i].hash === bChunks[j].hash) {
      pushSegment(segments, {
        type: 'equal',
        aOffset: aChunks[i].offset,
        aLength: aChunks[i].length,
        bOffset: bChunks[j].offset,
        bLength: bChunks[j].length,
        aHash: aChunks[i].hash,
        bHash: bChunks[j].hash,
      });
      i += 1;
      j += 1;
      continue;
    }

    let foundA = -1;
    if (j < bChunks.length) {
      const end = Math.min(aChunks.length, i + LOOKAHEAD);
      for (let k = i + 1; k < end; k += 1) {
        if (aChunks[k].hash === bChunks[j].hash) {
          foundA = k;
          break;
        }
      }
    }

    let foundB = -1;
    if (i < aChunks.length) {
      const end = Math.min(bChunks.length, j + LOOKAHEAD);
      for (let k = j + 1; k < end; k += 1) {
        if (bChunks[k].hash === aChunks[i].hash) {
          foundB = k;
          break;
        }
      }
    }

    if (foundA !== -1 && (foundB === -1 || foundA - i <= foundB - j)) {
      for (let k = i; k < foundA; k += 1) {
        pushSegment(segments, {
          type: 'removed',
          aOffset: aChunks[k].offset,
          aLength: aChunks[k].length,
          bOffset: bChunks[j]?.offset ?? bLength,
          bLength: 0,
          aHash: aChunks[k].hash,
          bHash: null,
        });
      }
      i = foundA;
    } else if (foundB !== -1) {
      for (let k = j; k < foundB; k += 1) {
        pushSegment(segments, {
          type: 'added',
          aOffset: aChunks[i]?.offset ?? aLength,
          aLength: 0,
          bOffset: bChunks[k].offset,
          bLength: bChunks[k].length,
          aHash: null,
          bHash: bChunks[k].hash,
        });
      }
      j = foundB;
    } else if (i < aChunks.length && j < bChunks.length) {
      pushSegment(segments, {
        type: 'modified',
        aOffset: aChunks[i].offset,
        aLength: aChunks[i].length,
        bOffset: bChunks[j].offset,
        bLength: bChunks[j].length,
        aHash: aChunks[i].hash,
        bHash: bChunks[j].hash,
      });
      i += 1;
      j += 1;
    } else if (i < aChunks.length) {
      pushSegment(segments, {
        type: 'removed',
        aOffset: aChunks[i].offset,
        aLength: aChunks[i].length,
        bOffset: bLength,
        bLength: 0,
        aHash: aChunks[i].hash,
        bHash: null,
      });
      i += 1;
    } else {
      pushSegment(segments, {
        type: 'added',
        aOffset: aLength,
        aLength: 0,
        bOffset: bChunks[j].offset,
        bLength: bChunks[j].length,
        aHash: null,
        bHash: bChunks[j].hash,
      });
      j += 1;
    }
  }

  return segments;
}

function buildKnowledgeGraph(fileA, fileB, segments) {
  const nodes = [
    { id: 'file:a', type: 'file', label: fileA.path, size: fileA.size, sha256: fileA.sha256 },
    { id: 'file:b', type: 'file', label: fileB.path, size: fileB.size, sha256: fileB.sha256 },
  ];
  const edges = [{ from: 'file:a', to: 'file:b', type: 'compared' }];

  segments.forEach((segment, index) => {
    const id = `segment:${index}`;
    nodes.push({
      id,
      type: segment.type,
      aOffset: segment.aOffset,
      aLength: segment.aLength,
      bOffset: segment.bOffset,
      bLength: segment.bLength,
    });

    if (segment.aLength > 0) {
      edges.push({ from: 'file:a', to: id, type: 'contains' });
    }
    if (segment.bLength > 0) {
      edges.push({ from: 'file:b', to: id, type: 'contains' });
    }
    if (segment.type === 'modified') {
      edges.push({ from: id, to: id, type: 'modified' });
    }
  });

  return { nodes, edges };
}

export async function compareFiles(fileAPath, fileBPath, options = {}) {
  const [a, b] = await Promise.all([readFile(fileAPath), readFile(fileBPath)]);
  const chunkSize = options.chunkSize || chooseChunkSize(a.length, b.length);
  const aHash = sha256(a);
  const bHash = sha256(b);
  const identical = aHash === bHash && a.length === b.length;
  const firstDiff = identical ? null : firstDifference(a, b);

  let segments;
  if (identical) {
    segments = [{
      type: 'equal',
      aOffset: 0,
      aLength: a.length,
      bOffset: 0,
      bLength: b.length,
      aHash,
      bHash,
    }];
  } else {
    const aChunks = toChunks(a, chunkSize);
    const bChunks = toChunks(b, chunkSize);
    segments = buildSegments(aChunks, bChunks, a.length, b.length);
  }

  const matchedBytes = segments
    .filter(segment => segment.type === 'equal')
    .reduce((sum, segment) => sum + segment.aLength, 0);
  const maxLength = Math.max(a.length, b.length);
  const similarity = maxLength === 0 ? 1 : matchedBytes / maxLength;

  const fileA = { path: fileAPath, size: a.length, sha256: aHash };
  const fileB = { path: fileBPath, size: b.length, sha256: bHash };
  const knowledgeGraph = buildKnowledgeGraph(fileA, fileB, segments);
  const differingSegments = segments.filter(segment => segment.type !== 'equal').length;

  return {
    identical,
    fileA,
    fileB,
    chunkSize,
    similarity,
    firstDifference: firstDiff,
    segments,
    knowledgeGraph,
    summary: identical
      ? 'Files are byte-for-byte identical.'
      : `${differingSegments} differing segment(s); similarity ${(similarity * 100).toFixed(2)}%.`,
  };
}
