/**
 * API Routes - SmartShorts Studio
 *
 * Endpoints:
 *   POST /api/upload           Upload an MP4 video
 *   POST /api/process          Start processing a previously uploaded video
 *   GET  /api/status/:jobId    Get job processing status + progress
 *   GET  /api/clips/:jobId     Get list of processed clips for a job
 *   GET  /api/download/:jobId/:clipName   Download a specific clip
 *   GET  /api/jobs             List all jobs (debug/management)
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const { createJob, getJob, updateJob, getAllJobs } = require('../services/jobStore');
const { processVideo } = require('../services/videoProcessor');
const { enqueueVideoJob } = require('../services/queueManager');

const router = express.Router();

// ── Multer configuration ──────────────────────────────────────────────
const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || './uploads');
const MAX_FILE_SIZE = (parseInt(process.env.MAX_FILE_SIZE_MB) || 2000) * 1024 * 1024;

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Create a job-specific upload directory
    const jobId = uuidv4();
    const jobDir = path.join(UPLOAD_DIR, jobId);
    fs.mkdirSync(jobDir, { recursive: true });
    req.jobId = jobId; // Attach job ID to the request
    cb(null, jobDir);
  },
  filename: (req, file, cb) => {
    // Keep the original filename
    cb(null, file.originalname);
  }
});

// Accept all common video formats — FFmpeg can handle them all
const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    'video/mp4', 'video/x-matroska', 'video/x-msvideo', 'video/quicktime',
    'video/x-ms-wmv', 'video/x-flv', 'video/webm', 'video/mpeg',
    'video/3gpp', 'video/3gpp2', 'video/ogg', 'video/x-m4v',
    'video/mp2t', 'video/avi', 'video/x-ms-asf'
  ];
  const allowedExts = [
    '.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm',
    '.mpeg', '.mpg', '.3gp', '.m4v', '.ts', '.mts', '.vob', '.ogv'
  ];
  const ext = '.' + file.originalname.split('.').pop().toLowerCase();
  if (allowedMimes.includes(file.mimetype) || allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('INVALID_FILE_TYPE'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE }
});

const EFFECT_LEVELS = new Set(['low', 'medium', 'aggressive']);
const FIXED_CLIP_DURATIONS = new Set([30, 45, 60, 75, 90, 120, 150, 180]);

function normalizeEffectsLevel(value) {
  if (EFFECT_LEVELS.has(value)) return value;
  const fallback = process.env.DEFAULT_EFFECTS_LEVEL || 'aggressive';
  return EFFECT_LEVELS.has(fallback) ? fallback : 'aggressive';
}

function normalizeClipDuration(value) {
  const parsed = parseInt(value || process.env.DEFAULT_CLIP_DURATION || 45, 10);
  if (!Number.isFinite(parsed)) return 45;
  return FIXED_CLIP_DURATIONS.has(parsed) ? parsed : 45;
}

function normalizeClippingMode(value) {
  return value === 'fixed' || value === 'subtitle_only' ? value : 'smart';
}

// ── POST /api/upload ──────────────────────────────────────────────────
// Upload a video file. Returns a job ID for tracking.
router.post('/upload', upload.single('video'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No video file provided' });
  }

  const jobId = req.jobId;
  const filePath = req.file.path;
  const fileSizeMB = (req.file.size / (1024 * 1024)).toFixed(2);

  // Create the job in the store
  createJob(jobId, filePath);

  console.log(`📤 Upload complete: ${req.file.originalname} (${fileSizeMB} MB) → Job ${jobId}`);

  res.json({
    jobId,
    filename: req.file.originalname,
    size: `${fileSizeMB} MB`,
    status: 'uploaded',
    message: 'Video uploaded successfully. Send POST /api/process to start processing.'
  });
});

// ── POST /api/process ─────────────────────────────────────────────────
// Start processing an uploaded video.
// Body: { jobId, clipDuration?: number, mode?: string, aspectRatio?: string }
router.post('/process', async (req, res) => {
  const {
    jobId,
    clipDuration,
    addSubtitles,
    aspectRatio,
    cropMode,
    enableBroll,
    subtitleStyle,
    clippingMode,
    mode,
    enableAudio,
    enableSfx,
    enableBgm,
    effectsLevel,
    musicVolume
  } = req.body;

  if (!jobId) {
    return res.status(400).json({ error: 'jobId is required' });
  }

  const job = getJob(jobId);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  if (job.status === 'processing') {
    return res.status(409).json({ error: 'Job is already being processed' });
  }

  const normalizedClippingMode = normalizeClippingMode(clippingMode);
  const resolvedMode = normalizedClippingMode === 'smart' ? (mode || 'auto_viral') : normalizedClippingMode;
  const aiModeEnabled = normalizedClippingMode === 'smart';

  // Store processing options
  updateJob(jobId, {
    options: {
      clipDuration: normalizeClipDuration(clipDuration),
      addSubtitles: normalizedClippingMode !== 'fixed',
      aspectRatio: process.env.FORCE_VERTICAL_OUTPUT === 'false' ? (aspectRatio || '9:16') : '9:16',
      cropMode: cropMode || 'smart_crop',
      enableBroll: aiModeEnabled && Boolean(enableBroll),
      enableAudio: enableAudio !== false,
      enableSfx: aiModeEnabled && enableSfx !== false,
      enableBgm: aiModeEnabled && enableBgm !== false,
      effectsLevel: aiModeEnabled ? normalizeEffectsLevel(effectsLevel) : 'low',
      musicVolume: typeof musicVolume === 'number' ? musicVolume : 0.14,
      subtitleStyle: subtitleStyle || 'hormozi',
      clippingMode: normalizedClippingMode,
      mode: resolvedMode,
      aiModeEnabled
    }
  });

  const updatedJob = getJob(jobId);
  try {
    const queued = await enqueueVideoJob(jobId);
    if (!queued) {
      processVideo(updatedJob).catch(error => {
        console.error(`Processing failed for job ${jobId}:`, error);
      });
    }
  } catch (error) {
    console.warn(`[Queue] Enqueue failed, processing directly. ${error.message}`);
    processVideo(updatedJob).catch(processError => {
      console.error(`Processing failed for job ${jobId}:`, processError);
    });
  }

  res.json({
    jobId,
    status: 'processing',
    message: 'Processing started. Poll GET /api/status/:jobId for progress.'
  });
});

// ── GET /api/status/:jobId ────────────────────────────────────────────
// Get the current processing status of a job.
router.get('/status/:jobId', (req, res) => {
  const job = getJob(req.params.jobId);

  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  res.json({
    jobId: job.jobId,
    status: job.status,
    progress: job.progress,
    totalClips: job.totalClips,
    processedClips: job.processedClips,
    clips: job.clips,
    analysis: job.analysis,
    thumbnails: job.thumbnails,
    titles: job.titles,
    options: job.options,
    currentStep: job.currentStep,
    currentStepDescription: job.currentStepDescription,
    pipelineSteps: job.pipelineSteps,
    error: job.error
  });
});

// ── GET /api/clips/:jobId ─────────────────────────────────────────────
// Get the list of processed clips for a completed job.
router.get('/clips/:jobId', (req, res) => {
  const job = getJob(req.params.jobId);

  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  if (job.status !== 'completed') {
    return res.json({
      jobId: job.jobId,
      status: job.status,
      clips: job.clips,
      message: job.status === 'processing' ? 'Still processing...' : 'Processing not started.'
    });
  }

  res.json({
    jobId: job.jobId,
    status: 'completed',
    totalClips: job.totalClips,
    clips: job.clips,
    analysis: job.analysis,
    thumbnails: job.thumbnails,
    titles: job.titles
  });
});

// ── GET /api/download/:jobId/:clipName ────────────────────────────────
// Download a specific processed clip.
router.get('/download/:jobId/:clipName', (req, res) => {
  const { jobId, clipName } = req.params;
  const OUTPUT_DIR = path.resolve(process.env.OUTPUT_DIR || './outputs');
  const filePath = path.join(OUTPUT_DIR, jobId, clipName);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Clip not found' });
  }

  res.download(filePath, clipName);
});

// ── GET /api/jobs ─────────────────────────────────────────────────────
// List all jobs. Useful for debugging and the batch view.
router.get('/jobs', (req, res) => {
  const jobs = getAllJobs().map(j => ({
    jobId: j.jobId,
    status: j.status,
    progress: j.progress,
    totalClips: j.totalClips,
    processedClips: j.processedClips,
    createdAt: j.createdAt
  }));
  res.json({ jobs });
});

module.exports = router;
