const { getJob } = require('./jobStore');
const { processVideo } = require('./videoProcessor');

let Queue;
let Worker;
let IORedis;
let queue;
let worker;

function isQueueEnabled() {
  return String(process.env.QUEUE_ENABLED || '').toLowerCase() === 'true' && Boolean(process.env.REDIS_URL);
}

function loadQueueLibraries() {
  if (Queue && Worker && IORedis) return true;
  try {
    ({ Queue, Worker } = require('bullmq'));
    IORedis = require('ioredis');
    return true;
  } catch (error) {
    console.warn(`[Queue] BullMQ/Redis libraries unavailable, using direct processing. ${error.message}`);
    return false;
  }
}

function createConnection() {
  return new IORedis(process.env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false
  });
}

function getVideoQueue() {
  if (!isQueueEnabled() || !loadQueueLibraries()) return null;
  if (!queue) {
    queue = new Queue('smartshorts-video-processing', {
      connection: createConnection(),
      defaultJobOptions: {
        attempts: Number(process.env.QUEUE_JOB_ATTEMPTS || 1),
        removeOnComplete: 50,
        removeOnFail: 100
      }
    });
  }
  return queue;
}

function startQueueWorker() {
  if (!isQueueEnabled() || !loadQueueLibraries() || worker) return Boolean(worker);
  worker = new Worker(
    'smartshorts-video-processing',
    async queuedJob => {
      const job = getJob(queuedJob.data.jobId);
      if (!job) throw new Error(`Job ${queuedJob.data.jobId} not found in local job store`);
      await processVideo(job);
    },
    {
      connection: createConnection(),
      concurrency: Math.max(1, Number(process.env.VIDEO_WORKER_CONCURRENCY || 1))
    }
  );

  worker.on('failed', (queuedJob, error) => {
    console.error(`[Queue] Job ${queuedJob?.data?.jobId || 'unknown'} failed: ${error.message}`);
  });

  console.log('[Queue] BullMQ video worker started');
  return true;
}

async function enqueueVideoJob(jobId) {
  const videoQueue = getVideoQueue();
  if (!videoQueue) return false;
  await videoQueue.add('process-video', { jobId }, { jobId });
  return true;
}

module.exports = {
  isQueueEnabled,
  startQueueWorker,
  enqueueVideoJob
};
