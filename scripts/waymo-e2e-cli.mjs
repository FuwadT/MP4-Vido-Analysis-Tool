import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import protobuf from 'protobufjs';
import { getCameraLabel } from '../src/utils/waymo/constants.js';

const DEFAULT_BUCKET = 'gs://waymo_open_dataset_end_to_end_camera_v_1_0_0';
const DEFAULT_RECORD_COUNT = 15;
const HEADER_BYTES = 12;
const FOOTER_BYTES = 4;
const INTENT_LABELS = {
    0: 'Unknown',
    1: 'Go Straight',
    2: 'Go Left',
    3: 'Go Right'
};
const SPLIT_PREFIXES = {
    training: 'training_',
    validation: 'val_',
    testing: 'test_'
};

function printHelp() {
    console.log(`
Waymo E2E CLI

Usage:
  node scripts/waymo-e2e-cli.mjs list [options]
  node scripts/waymo-e2e-cli.mjs sample [options]

Commands:
  list      List remote E2E shards in the official Waymo bucket.
  sample    Download one shard, extract a small local TFRecord sample, and emit metadata.

Common options:
  --bucket <gs://...>      Override the Waymo bucket.
  --split <name>           training | validation | testing. Default: validation
  --contains <text>        Filter remote shard names by substring.

List options:
  --limit <n>              Number of shards to print. Default: 10

Sample options:
  --remote <gs://...>      Exact remote shard path to use.
  --local-shard <path>     Use an existing local shard instead of downloading first.
  --index <n>              Shard index after filtering. Default: 0
  --records <n>            Number of records to extract. Default: 15
  --cache-dir <path>       Raw shard cache directory. Default: data/waymo/e2e/raw
  --out-dir <path>         Sample output directory. Default: data/waymo/e2e/samples
  --force-download         Re-download the raw shard even if cached locally.
  --cleanup-raw            Delete the raw cached shard after the sample is created.
  --output <path>          Write the sample TFRecord to an explicit path.

Examples:
  node scripts/waymo-e2e-cli.mjs list --split validation --limit 5
  node scripts/waymo-e2e-cli.mjs sample --split validation --records 15 --cleanup-raw
  node scripts/waymo-e2e-cli.mjs sample --remote gs://waymo_open_dataset_end_to_end_camera_v_1_0_0/test_202504211836-202504220845.tfrecord-00000-of-00266 --records 15
`.trim());
}

function parseArgs(argv) {
    const [command, ...rest] = argv;
    const options = {};
    const positional = [];

    for (let index = 0; index < rest.length; index += 1) {
        const token = rest[index];
        if (!token.startsWith('--')) {
            positional.push(token);
            continue;
        }

        const key = token.slice(2);
        const next = rest[index + 1];
        if (!next || next.startsWith('--')) {
            options[key] = true;
            continue;
        }

        options[key] = next;
        index += 1;
    }

    return { command, options, positional };
}

function toPositiveInteger(value, fallback, label) {
    if (value === undefined || value === null || value === '') {
        return fallback;
    }

    const parsed = Number.parseInt(String(value), 10);
    if (!Number.isFinite(parsed) || parsed < 0) {
        throw new Error(`${label} must be a non-negative integer.`);
    }

    return parsed;
}

function getSplit(options) {
    const split = String(options.split || 'validation').toLowerCase();
    if (!SPLIT_PREFIXES[split]) {
        throw new Error(`Unsupported split "${split}". Use training, validation, or testing.`);
    }
    return split;
}

function getBucket(options) {
    return String(options.bucket || DEFAULT_BUCKET).replace(/\/+$/, '');
}

function runCommand(command, args, { cwd = process.cwd() } = {}) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            cwd,
            shell: true,
            stdio: ['ignore', 'pipe', 'pipe']
        });

        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (chunk) => {
            stdout += chunk.toString();
        });

        child.stderr.on('data', (chunk) => {
            stderr += chunk.toString();
        });

        child.on('error', reject);
        child.on('close', (code) => {
            if (code === 0) {
                resolve({ stdout, stderr });
                return;
            }

            reject(new Error(stderr.trim() || stdout.trim() || `${command} exited with code ${code}`));
        });
    });
}

async function listRemoteShards({ bucket, split, contains }) {
    const prefix = SPLIT_PREFIXES[split];
    const { stdout } = await runCommand('gsutil', ['ls', `${bucket}/${prefix}*`]);
    const shards = stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .filter((line) => !contains || line.includes(contains));

    return shards;
}

function readLengthFromHeader(header) {
    const view = new DataView(header.buffer, header.byteOffset, header.byteLength);
    const length = Number(view.getBigUint64(0, true));
    if (!Number.isSafeInteger(length)) {
        throw new Error('Encountered a TFRecord record larger than Node can safely address.');
    }
    return length;
}

function firstDefined(source, keys, fallback = undefined) {
    const candidates = Array.isArray(keys) ? keys : [keys];
    for (const key of candidates) {
        if (source?.[key] !== undefined && source?.[key] !== null) {
            return source[key];
        }
    }

    return fallback;
}

async function loadE2EDFrameType() {
    const basePath = path.resolve('public/waymo-protos');
    const entryPath = path.resolve(basePath, 'waymo_open_dataset/protos/end_to_end_driving_data.proto');
    const root = new protobuf.Root();
    root.resolvePath = (_origin, target) => (/^[A-Za-z]:/.test(target) ? target : path.resolve(basePath, target));
    await root.load(entryPath);
    root.resolveAll();
    return root.lookupType('waymo.open_dataset.E2EDFrame');
}

function summarizeDecodedRecord(decoded, recordIndex) {
    const frame = decoded.frame || {};
    const context = frame.context || {};
    const images = frame.images || [];
    const pastStates = decoded.pastStates || {};
    const futureStates = decoded.futureStates || {};
    const intentValue = Number(decoded.intent || 0);

    return {
        recordIndex,
        frameId: context.name || null,
        intent: {
            value: intentValue,
            label: INTENT_LABELS[intentValue] || INTENT_LABELS[0]
        },
        timestampMicros: Number(frame.timestampMicros || 0),
        cameraNames: images.map((image) => Number(image.name)),
        cameraLabels: images.map((image) => getCameraLabel(Number(image.name))),
        imageCount: images.length,
        pastSamples: Array.isArray(pastStates.posX) ? pastStates.posX.length : 0,
        futureSamples: Array.isArray(futureStates.posX) ? futureStates.posX.length : 0,
        preferenceTrajectoryCount: Array.isArray(decoded.preferenceTrajectories) ? decoded.preferenceTrajectories.length : 0
    };
}

function buildAggregate(records) {
    const intents = new Map();
    const imageCounts = new Map();
    const pastSampleCounts = new Map();
    const futureSampleCounts = new Map();
    const cameraLabels = new Set();

    for (const record of records) {
        intents.set(record.intent.label, (intents.get(record.intent.label) || 0) + 1);
        imageCounts.set(record.imageCount, (imageCounts.get(record.imageCount) || 0) + 1);
        pastSampleCounts.set(record.pastSamples, (pastSampleCounts.get(record.pastSamples) || 0) + 1);
        futureSampleCounts.set(record.futureSamples, (futureSampleCounts.get(record.futureSamples) || 0) + 1);
        for (const label of record.cameraLabels) {
            cameraLabels.add(label);
        }
    }

    return {
        intents: Object.fromEntries([...intents.entries()].sort(([a], [b]) => a.localeCompare(b))),
        imageCounts: Object.fromEntries([...imageCounts.entries()].sort((a, b) => Number(a[0]) - Number(b[0]))),
        pastSampleCounts: Object.fromEntries([...pastSampleCounts.entries()].sort((a, b) => Number(a[0]) - Number(b[0]))),
        futureSampleCounts: Object.fromEntries([...futureSampleCounts.entries()].sort((a, b) => Number(a[0]) - Number(b[0]))),
        cameraLabels: [...cameraLabels.values()].sort()
    };
}

async function ensureDownloaded(remoteShard, cacheDir, forceDownload) {
    await fsp.mkdir(cacheDir, { recursive: true });
    const localPath = path.resolve(cacheDir, path.basename(remoteShard));

    if (!forceDownload && fs.existsSync(localPath)) {
        return localPath;
    }

    console.log(`Downloading ${remoteShard}`);
    await runCommand('gsutil', ['cp', remoteShard, localPath]);
    return localPath;
}

function defaultSamplePath(sourceShardPath, outDir, recordCount) {
    const baseName = path.basename(sourceShardPath);
    return path.resolve(outDir, `${baseName}.records-${String(recordCount).padStart(5, '0')}.tfrecord`);
}

async function extractSample({
    rawShardPath,
    samplePath,
    recordCount
}) {
    const e2eFrameType = await loadE2EDFrameType();
    const outputDir = path.dirname(samplePath);
    await fsp.mkdir(outputDir, { recursive: true });

    const handle = await fsp.open(rawShardPath, 'r');
    const writer = fs.createWriteStream(samplePath);
    const records = [];

    try {
        let offset = 0;
        let index = 0;

        while (index < recordCount) {
            const header = Buffer.alloc(HEADER_BYTES);
            const { bytesRead } = await handle.read(header, 0, HEADER_BYTES, offset);
            if (bytesRead === 0) {
                break;
            }

            const payloadLength = readLengthFromHeader(header);
            const payload = Buffer.alloc(payloadLength);
            const footer = Buffer.alloc(FOOTER_BYTES);

            await handle.read(payload, 0, payloadLength, offset + HEADER_BYTES);
            await handle.read(footer, 0, FOOTER_BYTES, offset + HEADER_BYTES + payloadLength);

            writer.write(header);
            writer.write(payload);
            writer.write(footer);

            const decoded = e2eFrameType.toObject(e2eFrameType.decode(payload), {
                arrays: true,
                bytes: Uint8Array,
                defaults: false,
                enums: Number,
                longs: Number
            });

            records.push(summarizeDecodedRecord(decoded, index));
            offset += HEADER_BYTES + payloadLength + FOOTER_BYTES;
            index += 1;
        }

        await new Promise((resolve, reject) => {
            writer.end((error) => {
                if (error) {
                    reject(error);
                    return;
                }

                resolve();
            });
        });
    } finally {
        await handle.close();
    }

    return records;
}

async function writeMetadata({
    metadataPath,
    split,
    remoteShard,
    rawShardPath,
    samplePath,
    recordsRequested,
    records
}) {
    const payload = {
        createdAt: new Date().toISOString(),
        workflow: 'waymo-e2e-ego-sample',
        split,
        remoteShard,
        rawShardPath,
        samplePath,
        recordsRequested,
        recordsExtracted: records.length,
        aggregate: buildAggregate(records),
        records
    };

    await fsp.writeFile(metadataPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

async function main() {
    const { command, options, positional } = parseArgs(process.argv.slice(2));
    if (!command || options.help) {
        printHelp();
        return;
    }

    if (positional[0] && options.split === undefined) {
        options.split = positional[0];
    }

    if (positional[1] && options.limit === undefined && command === 'list') {
        options.limit = positional[1];
    }

    if (positional[1] && options.records === undefined && command === 'sample') {
        options.records = positional[1];
    }

    const bucket = getBucket(options);

    if (command === 'list') {
        const split = getSplit(options);
        const limit = toPositiveInteger(options.limit, 10, 'limit');
        const shards = await listRemoteShards({
            bucket,
            split,
            contains: options.contains ? String(options.contains) : ''
        });

        if (shards.length === 0) {
            throw new Error('No shards matched the requested filter.');
        }

        shards.slice(0, limit).forEach((shard, index) => {
            console.log(`${index}. ${shard}`);
        });
        console.log(`Listed ${Math.min(limit, shards.length)} of ${shards.length} matching shard(s).`);
        return;
    }

    if (command === 'sample') {
        const split = getSplit(options);
        const recordsRequested = toPositiveInteger(options.records, DEFAULT_RECORD_COUNT, 'records');
        const shardIndex = toPositiveInteger(options.index, 0, 'index');
        const cacheDir = path.resolve(options['cache-dir'] || 'data/waymo/e2e/raw');
        const outDir = path.resolve(options['out-dir'] || 'data/waymo/e2e/samples');
        const contains = options.contains ? String(options.contains) : '';
        let remoteShard = options.remote ? String(options.remote) : '';
        let rawShardPath = options['local-shard'] ? path.resolve(String(options['local-shard'])) : '';

        if (!rawShardPath && !remoteShard) {
            const shards = await listRemoteShards({ bucket, split, contains });
            if (shards.length === 0) {
                throw new Error('No remote shards matched the requested filter.');
            }
            if (shardIndex >= shards.length) {
                throw new Error(`Requested shard index ${shardIndex} but only ${shards.length} shard(s) matched.`);
            }
            remoteShard = shards[shardIndex];
        }

        if (!rawShardPath) {
            rawShardPath = await ensureDownloaded(remoteShard, cacheDir, Boolean(options['force-download']));
        } else if (!fs.existsSync(rawShardPath)) {
            throw new Error(`Local shard not found: ${rawShardPath}`);
        }

        const samplePath = path.resolve(options.output || defaultSamplePath(remoteShard || rawShardPath, outDir, recordsRequested));
        const records = await extractSample({
            rawShardPath,
            samplePath,
            recordCount: recordsRequested
        });

        if (records.length === 0) {
            throw new Error('No records were extracted from the shard.');
        }

        const metadataPath = `${samplePath}.json`;
        await writeMetadata({
            metadataPath,
            split,
            remoteShard,
            rawShardPath,
            samplePath,
            recordsRequested,
            records
        });

        if (options['cleanup-raw'] && remoteShard) {
            await fsp.unlink(rawShardPath);
        }

        if (remoteShard) {
            console.log(`Remote shard: ${remoteShard}`);
        }
        console.log(`Raw shard: ${rawShardPath}`);
        console.log(`Sample TFRecord: ${samplePath}`);
        console.log(`Metadata JSON: ${metadataPath}`);
        console.log(`Extracted ${records.length} record(s) from split "${split}".`);
        console.log(`Intent summary: ${JSON.stringify(buildAggregate(records).intents)}`);
        return;
    }

    throw new Error(`Unknown command "${command}". Use list or sample.`);
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
});
