const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawnSync } = require('child_process');

const projectRoot = path.resolve(__dirname, '..');
const resourcesDir = path.join(projectRoot, 'resources');
const whisperPath = process.platform === 'win32'
  ? path.join(resourcesDir, 'whisper', 'whisper.exe')
  : path.join(resourcesDir, 'whisper', 'whisper');
const ffmpegPath = process.platform === 'win32'
  ? path.join(resourcesDir, 'ffmpeg', 'ffmpeg.exe')
  : path.join(resourcesDir, 'ffmpeg', 'ffmpeg');
const modelsDir = path.join(resourcesDir, 'models');
const testAudioDir = process.env.TEST_AUDIO_DIR
  || path.join(projectRoot, 'test-audio');
const shortDir = path.join(testAudioDir, 'short');
const longDir = path.join(testAudioDir, 'long');

const supportedExtensions = ['.wav', '.mp3', '.m4a', '.ogg', '.flac', '.aac'];
const timestampRegex = /\[\d{2}:\d{2}:\d{2}\.\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}\.\d{3}\]/;
const srtTimestampRegex = /\d{2}:\d{2}:\d{2},\d{3}\s*-->\s*\d{2}:\d{2}:\d{2},\d{3}/;
const keepOutputs = process.env.KEEP_SMOKE_OUTPUT === '1';
const longDurationMs = process.env.LONG_DURATION_MS
  ? Number(process.env.LONG_DURATION_MS)
  : 600000; // default: first 10 minutes for long files
const runShort = process.env.RUN_SHORT !== '0';
const runLong = process.env.RUN_LONG !== '0';
const beamSize = process.env.BEAM_SIZE ? Number(process.env.BEAM_SIZE) : undefined;
const bestOf = process.env.BEST_OF ? Number(process.env.BEST_OF) : undefined;
const threads = process.env.THREADS ? Number(process.env.THREADS) : undefined;
const noFallback = process.env.NO_FALLBACK === '1';
const language = process.env.LANGUAGE || 'auto';
const modelOverride = process.env.MODEL_NAME;

function exitWithError(message) {
  console.error(message);
  process.exit(1);
}

function pickPreferredModel(models) {
  const normalized = models.map((name) => name.toLowerCase());
  const findByKeyword = (keyword) => {
    const index = normalized.findIndex((name) => name.includes(keyword));
    return index >= 0 ? models[index] : undefined;
  };

  return (
    findByKeyword('small') ||
    findByKeyword('base') ||
    findByKeyword('medium') ||
    findByKeyword('large') ||
    findByKeyword('tiny') ||
    models[0]
  );
}

function runCommand(command, args) {
  const result = spawnSync(command, args, { stdio: 'pipe' });
  if (result.error) {
    throw result.error;
  }
  return result;
}

function ensureExists(filePath, label) {
  if (!fs.existsSync(filePath)) {
    exitWithError(`${label} not found at ${filePath}`);
  }
}

function extractTimestampLines(text, maxLines = 3) {
  const lines = text.split(/\r?\n/).filter((line) => timestampRegex.test(line));
  return lines.slice(0, maxLines);
}
function convertSrtToTxt(content) {
  const blocks = content.split(/\r?\n\r?\n/).map((block) => block.trim()).filter(Boolean);
  const lines = [];

  for (const block of blocks) {
    const parts = block.split(/\r?\n/);
    if (parts.length < 2) continue;
    const timestampLine = parts[1];
    const text = parts.slice(2).join(' ').trim();
    if (!text) continue;
    const normalizedTimestamp = timestampLine.replace(/,/g, '.');
    lines.push(`[${normalizedTimestamp}] ${text}`);
  }

  return lines.join('\n') + (lines.length > 0 ? '\n' : '');
}

function formatSample(lines) {
  if (lines.length === 0) return 'No timestamp lines found';
  return lines.join('\n');
}

function extractPreview(text, maxLines = 5) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0);
  return lines.slice(0, maxLines);
}

function normalizeForCompare(text) {
  return text
    .replace(/\[[^\]]+\]/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function compareTextToReference(candidateText, referenceText) {
  const candidateTokens = normalizeForCompare(candidateText).split(' ').filter(Boolean);
  const referenceTokens = normalizeForCompare(referenceText).split(' ').filter(Boolean);

  if (candidateTokens.length === 0 || referenceTokens.length === 0) {
    return { recall: 0, precision: 0, f1: 0 };
  }

  const candidateCounts = new Map();
  for (const token of candidateTokens) {
    candidateCounts.set(token, (candidateCounts.get(token) || 0) + 1);
  }

  let overlap = 0;
  for (const token of referenceTokens) {
    const count = candidateCounts.get(token) || 0;
    if (count > 0) {
      overlap += 1;
      candidateCounts.set(token, count - 1);
    }
  }

  const recall = overlap / referenceTokens.length;
  const precision = overlap / candidateTokens.length;
  const f1 = (precision + recall) > 0 ? (2 * precision * recall) / (precision + recall) : 0;

  return { recall, precision, f1 };
}

function normalizeName(name) {
  return name
    .toLowerCase()
    .replace(/_large$/i, '')
    .replace(/\d+/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findReferenceFile(audioPath) {
  const dir = path.dirname(audioPath);
  const ext = path.extname(audioPath);
  const base = path.basename(audioPath, ext);
  const exact = path.join(dir, `${base}_large.txt`);
  if (fs.existsSync(exact)) {
    return exact;
  }

  const normalizedAudio = normalizeName(base);
  const candidates = fs.readdirSync(dir)
    .filter((name) => name.toLowerCase().endsWith('_large.txt'));

  let bestMatch = null;
  let bestScore = 0;

  for (const candidate of candidates) {
    const candidateBase = candidate.replace(/_large\.txt$/i, '');
    const normalizedCandidate = normalizeName(candidateBase);
    if (!normalizedCandidate) continue;

    const matches = normalizedAudio.includes(normalizedCandidate) || normalizedCandidate.includes(normalizedAudio);
    const score = matches ? normalizedCandidate.length : 0;
    if (score > bestScore) {
      bestScore = score;
      bestMatch = path.join(dir, candidate);
    }
  }

  return bestMatch;
}

ensureExists(whisperPath, 'Whisper executable');
ensureExists(modelsDir, 'Models directory');
ensureExists(testAudioDir, 'Test audio root');
ensureExists(shortDir, 'Short test audio folder');
ensureExists(longDir, 'Long test audio folder');

const modelFiles = fs.readdirSync(modelsDir)
  .filter((name) => /\.(bin|gguf)$/i.test(name));

if (modelFiles.length === 0) {
  exitWithError('No models found in resources/models');
}

const modelName = modelOverride && modelFiles.includes(modelOverride)
  ? modelOverride
  : pickPreferredModel(modelFiles);
const modelPath = path.join(modelsDir, modelName);

function loadAudioFiles(dirPath) {
  return fs.readdirSync(dirPath)
    .filter((name) => supportedExtensions.some((ext) => name.toLowerCase().endsWith(ext)))
    .map((name) => {
      const fullPath = path.join(dirPath, name);
      return { name, fullPath, size: fs.statSync(fullPath).size };
    })
    .sort((a, b) => a.size - b.size);
}

const shortFiles = loadAudioFiles(shortDir);
const longFiles = loadAudioFiles(longDir);

if (shortFiles.length === 0) {
  exitWithError('No short test audio files found.');
}
if (longFiles.length === 0) {
  exitWithError('No long test audio files found.');
}

console.log(`Using model: ${modelName}`);
console.log(`Params: beamSize=${beamSize ?? 'default'}, bestOf=${bestOf ?? 'default'}, threads=${threads ?? 'default'}, noFallback=${noFallback}, language=${language}`);
console.log(`Short files: ${shortFiles.length}`);
console.log(`Long files: ${longFiles.length}`);

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lmt-smoke-'));

function runSuite(label, files, enableVadTest, durationMs, compareIsPartial) {
  console.log(`\n=== ${label} ===`);
  let firstAudio = null;
  for (const audio of files) {
    const ext = path.extname(audio.fullPath).toLowerCase();
    let inputPath = audio.fullPath;
    let cleanupPath = null;

    if (ext !== '.wav') {
      ensureExists(ffmpegPath, 'FFmpeg executable');
      const wavPath = path.join(tempDir, `${path.basename(audio.fullPath, ext)}.wav`);
      const ffmpegResult = runCommand(ffmpegPath, [
        '-y',
        '-i', audio.fullPath,
        '-vn',
        '-ac', '1',
        '-ar', '16000',
        '-c:a', 'pcm_s16le',
        wavPath,
      ]);

      if (ffmpegResult.status !== 0) {
        throw new Error(`FFmpeg failed for ${audio.name}`);
      }
      inputPath = wavPath;
      cleanupPath = wavPath;
    }

    const outputBase = path.join(tempDir, `${path.basename(audio.fullPath, ext)}_out`);
    const args = [
      '-m', modelPath,
      '-f', inputPath,
      '-of', outputBase,
      '--output-srt',
      '-l', language,
    ];
    if (typeof beamSize === 'number' && !Number.isNaN(beamSize)) {
      args.push('-bs', String(beamSize));
    }
    if (typeof bestOf === 'number' && !Number.isNaN(bestOf)) {
      args.push('-bo', String(bestOf));
    }
    if (typeof threads === 'number' && !Number.isNaN(threads)) {
      args.push('-t', String(threads));
    }
    if (noFallback) {
      args.push('-nf');
    }
    if (typeof durationMs === 'number' && durationMs > 0) {
      args.push('-d', String(durationMs));
    }

    const whisperResult = runCommand(whisperPath, args);

    if (whisperResult.status !== 0) {
      const stderrContent = whisperResult.stderr ? whisperResult.stderr.toString('utf-8') : '';
      throw new Error(`Whisper failed for ${audio.name}: ${stderrContent}`);
    }

    const outputPath = `${outputBase}.srt`;
    const outputExists = fs.existsSync(outputPath);
    const outputContent = outputExists ? fs.readFileSync(outputPath, 'utf-8') : '';
    const convertedTxt = outputContent ? convertSrtToTxt(outputContent) : '';
    const stdoutContent = whisperResult.stdout ? whisperResult.stdout.toString('utf-8') : '';
    const stderrContent = whisperResult.stderr ? whisperResult.stderr.toString('utf-8') : '';
    const sampleLines = extractTimestampLines(convertedTxt || stdoutContent || stderrContent);
    const previewLines = extractPreview(convertedTxt || stdoutContent || stderrContent);

    if (!convertedTxt.trim() && !stdoutContent.trim() && !stderrContent.trim()) {
      throw new Error(`Transcript is empty for ${audio.name}`);
    }
    if (!timestampRegex.test(convertedTxt) && !timestampRegex.test(stdoutContent) && !timestampRegex.test(stderrContent)) {
      throw new Error(`Timestamps missing in transcript for ${audio.name}`);
    }

    console.log(`OK: ${audio.name}`);
    console.log(formatSample(sampleLines));
    console.log(previewLines.join('\n'));

    const referencePath = findReferenceFile(audio.fullPath);
    if (!referencePath) {
      console.log(`No reference file found for ${audio.name}`);
    } else {
      const referenceContent = fs.readFileSync(referencePath, 'utf-8');
      const comparison = compareTextToReference(convertedTxt, referenceContent);
      console.log(`Comparison vs _large.txt for ${audio.name}${compareIsPartial ? ' (partial)' : ''}:`);
      console.log(`Recall ${(comparison.recall * 100).toFixed(1)}% | Precision ${(comparison.precision * 100).toFixed(1)}% | F1 ${(comparison.f1 * 100).toFixed(1)}%`);
    }

    if (cleanupPath && fs.existsSync(cleanupPath)) {
      fs.unlinkSync(cleanupPath);
    }
    if (!keepOutputs && outputExists) {
      fs.unlinkSync(outputPath);
    }

    if (!firstAudio) {
      firstAudio = { ...audio };
    }
  }

  if (enableVadTest && firstAudio) {
    const ext = path.extname(firstAudio.fullPath).toLowerCase();
    let inputPath = firstAudio.fullPath;
    let cleanupPath = null;

    if (ext !== '.wav') {
      ensureExists(ffmpegPath, 'FFmpeg executable');
      const wavPath = path.join(tempDir, `${path.basename(firstAudio.fullPath, ext)}_vad.wav`);
      const ffmpegResult = runCommand(ffmpegPath, [
        '-y',
        '-i', firstAudio.fullPath,
        '-vn',
        '-ac', '1',
        '-ar', '16000',
        '-c:a', 'pcm_s16le',
        wavPath,
      ]);

      if (ffmpegResult.status !== 0) {
        throw new Error(`FFmpeg failed for VAD test on ${firstAudio.name}`);
      }
      inputPath = wavPath;
      cleanupPath = wavPath;
    }

    const vadDir = path.join(resourcesDir, 'vad');
    let vadModelPath = null;
    if (fs.existsSync(vadDir)) {
      const vadModels = fs.readdirSync(vadDir).filter((name) => fs.statSync(path.join(vadDir, name)).isFile());
      if (vadModels.length > 0) {
        vadModelPath = path.join(vadDir, vadModels[0]);
      }
    }

    if (!vadModelPath) {
      console.log('Skipping VAD test: no VAD model found in resources/vad');
    } else {
      const outputBase = path.join(tempDir, `${path.basename(firstAudio.fullPath, ext)}_vad_nf`);
      const whisperResult = runCommand(whisperPath, [
        '-m', modelPath,
        '-f', inputPath,
        '-of', outputBase,
        '--output-srt',
        '--vad',
        '--vad-model', vadModelPath,
        '-nf',
        '-l', 'auto',
      ]);

    if (whisperResult.status !== 0) {
      const stderrContent = whisperResult.stderr ? whisperResult.stderr.toString('utf-8') : '';
      throw new Error(`Whisper failed for VAD/noFallback test on ${firstAudio.name}: ${stderrContent}`);
    }

      const outputPath = `${outputBase}.srt`;
      const outputExists = fs.existsSync(outputPath);
      const outputContent = outputExists ? fs.readFileSync(outputPath, 'utf-8') : '';
      const convertedTxt = outputContent ? convertSrtToTxt(outputContent) : '';
      const stdoutContent = whisperResult.stdout ? whisperResult.stdout.toString('utf-8') : '';
      const stderrContent = whisperResult.stderr ? whisperResult.stderr.toString('utf-8') : '';
      const sampleLines = extractTimestampLines(convertedTxt || stdoutContent || stderrContent);
      const previewLines = extractPreview(convertedTxt || stdoutContent || stderrContent);

      if (!convertedTxt.trim() && !stdoutContent.trim() && !stderrContent.trim()) {
        throw new Error(`Transcript is empty for VAD/noFallback test on ${firstAudio.name}`);
      }
      if (!timestampRegex.test(convertedTxt) && !timestampRegex.test(stdoutContent) && !timestampRegex.test(stderrContent)) {
        throw new Error(`Timestamps missing for VAD/noFallback test on ${firstAudio.name}`);
      }

      console.log(`OK (VAD + noFallback): ${firstAudio.name}`);
      console.log(formatSample(sampleLines));
      console.log(previewLines.join('\n'));

      if (cleanupPath && fs.existsSync(cleanupPath)) {
        fs.unlinkSync(cleanupPath);
      }
      if (!keepOutputs && outputExists) {
        fs.unlinkSync(outputPath);
      }
    }
  }
}

try {
  if (runShort) {
    runSuite('Short audio tests', shortFiles, true, 0, false);
  }
  if (runLong) {
    runSuite('Long audio tests', longFiles, false, longDurationMs, longDurationMs > 0);
  }
} finally {
  if (!keepOutputs) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } else {
    console.log(`Keeping outputs in: ${tempDir}`);
  }
}

console.log('Smoke test passed.');
