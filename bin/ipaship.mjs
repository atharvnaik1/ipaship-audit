#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';
import { compareFiles } from '../src/lib/binary-compare.mjs';

function usage() {
  console.log(`Usage:
  ipaship compare --file <path-a> --file <path-b> [--json] [--out <path>] [--chunk-size <bytes>]

Examples:
  ipaship compare --file app-1.0.0.ipa --file app-1.0.1.ipa
  ipaship compare --file a.bin --file b.bin --json --out diff.json
`);
}

function parseArgs(argv) {
  const parsed = { command: argv[0], files: [], json: false, out: null, chunkSize: null, help: false };

  for (let i = 1; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--file') {
      parsed.files.push(argv[++i]);
    } else if (arg.startsWith('--file=')) {
      parsed.files.push(arg.slice('--file='.length));
    } else if (arg === '--json') {
      parsed.json = true;
    } else if (arg === '--out') {
      parsed.out = argv[++i];
    } else if (arg.startsWith('--out=')) {
      parsed.out = arg.slice('--out='.length);
    } else if (arg === '--chunk-size') {
      parsed.chunkSize = Number(argv[++i]);
    } else if (arg.startsWith('--chunk-size=')) {
      parsed.chunkSize = Number(arg.slice('--chunk-size='.length));
    } else if (arg === '--help' || arg === '-h') {
      parsed.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return parsed;
}

function printHuman(result) {
  console.log(`A: ${result.fileA.path} (${result.fileA.size} bytes, sha256 ${result.fileA.sha256})`);
  console.log(`B: ${result.fileB.path} (${result.fileB.size} bytes, sha256 ${result.fileB.sha256})`);
  console.log(`Identical: ${result.identical ? 'yes' : 'no'}`);
  console.log(`Similarity: ${(result.similarity * 100).toFixed(2)}%`);
  console.log(`First difference: ${result.firstDifference === null ? 'none' : `byte ${result.firstDifference}`}`);

  const counts = result.segments.reduce((acc, segment) => {
    acc[segment.type] = (acc[segment.type] || 0) + 1;
    return acc;
  }, {});
  console.log(`Segments: equal=${counts.equal || 0} modified=${counts.modified || 0} added=${counts.added || 0} removed=${counts.removed || 0}`);
  console.log(`Knowledge graph: ${result.knowledgeGraph.nodes.length} nodes, ${result.knowledgeGraph.edges.length} edges`);

  const differing = result.segments.filter(segment => segment.type !== 'equal').slice(0, 20);
  if (differing.length > 0) {
    console.log('First differing segments:');
    for (const segment of differing) {
      console.log(`  ${segment.type} A[${segment.aOffset}:${segment.aOffset + segment.aLength}] B[${segment.bOffset}:${segment.bOffset + segment.bLength}]`);
    }
  }
}

async function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    usage();
    process.exitCode = 2;
    return;
  }

  if (args.help || !args.command || args.command === 'help') {
    usage();
    return;
  }

  if (args.command !== 'compare') {
    console.error(`Unknown command: ${args.command}`);
    usage();
    process.exitCode = 2;
    return;
  }

  if (args.files.length !== 2 || args.files.some(file => !file)) {
    console.error('compare requires exactly two --file arguments.');
    usage();
    process.exitCode = 2;
    return;
  }

  try {
    const result = await compareFiles(args.files[0], args.files[1], {
      chunkSize: Number.isFinite(args.chunkSize) && args.chunkSize > 0 ? args.chunkSize : undefined,
    });

    if (args.out) {
      await writeFile(args.out, `${JSON.stringify(result, null, 2)}\n`);
    }

    if (args.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      printHuman(result);
    }

    process.exitCode = result.identical ? 0 : 1;
  } catch (error) {
    console.error(`compare failed: ${error.message}`);
    process.exitCode = 2;
  }
}

main();
