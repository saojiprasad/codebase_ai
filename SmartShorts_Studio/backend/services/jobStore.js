/**
 * Job Store — In-memory state management for video processing jobs
 *
 * Each job tracks:
 *  - status:          'uploaded' | 'processing' | 'completed' | 'failed'
 *  - progress:        0–100 percentage
 *  - totalClips:      total number of segments detected
 *  - processedClips:  how many segments have been fully processed
 *  - clips:           array of { name, path, partNumber, size, duration }
 *  - error:           error message if status === 'failed'
 *  - originalFile:    path to the uploaded file
 *  - options:         { clipDuration, addSubtitles, aspectRatio, mode, clippingMode, subtitleStyle, cropMode }
 *  - currentStep:     name of current pipeline step
 *  - pipelineSteps:   list of all steps
 *  - viralScore:      overall job score
 *  - thumbnails:      generated thumbnail paths
 *  - titles:          generated titles
 */

const { EventEmitter } = require('events');

const jobs = new Map();
const jobEvents = new EventEmitter();

const JobStatus = {
  UPLOADED: 'uploaded',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed'
};

function createJob(jobId, originalFile) {
  const job = {
    jobId,
    status: JobStatus.UPLOADED,
    progress: 0,
    totalClips: 0,
    processedClips: 0,
    clips: [],
    error: null,
    originalFile,
    options: {},
    currentStep: null,
    currentStepDescription: null,
    pipelineSteps: [],
    analysis: null,
    viralScore: 0,
    thumbnails: [],
    titles: [],
    createdAt: new Date().toISOString()
  };
  jobs.set(jobId, job);
  jobEvents.emit('updated', job);
  return job;
}

function getJob(jobId) {
  return jobs.get(jobId) || null;
}

function updateJob(jobId, updates) {
  const job = jobs.get(jobId);
  if (!job) return null;
  Object.assign(job, updates);
  jobEvents.emit('updated', job);
  return job;
}

function getAllJobs() {
  return Array.from(jobs.values());
}

module.exports = {
  JobStatus,
  createJob,
  getJob,
  updateJob,
  getAllJobs,
  jobEvents
};
