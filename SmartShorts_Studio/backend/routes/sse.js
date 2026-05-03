/**
 * Server-Sent Events (SSE) — Real-time progress updates
 * 
 * Replaces REST polling with a persistent connection to push
 * job updates to the frontend immediately.
 */

const express = require('express');
const { getJob, JobStatus, jobEvents } = require('../services/jobStore');

const router = express.Router();

// Store active connections: jobId -> res[]
const clients = new Map();

jobEvents.on('updated', (job) => {
  broadcastJobUpdate(job.jobId, job);
});

/**
 * Register a new SSE connection for a specific job.
 * GET /api/events/:jobId
 */
router.get('/:jobId', (req, res) => {
  const jobId = req.params.jobId;

  // Standard headers for SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*' // Or restrict to specific origins
  });

  // Send an initial connected event
  res.write(`event: connected\ndata: {"jobId": "${jobId}"}\n\n`);

  // Add to clients map
  if (!clients.has(jobId)) {
    clients.set(jobId, []);
  }
  clients.get(jobId).push(res);

  // Send current job state immediately
  const job = getJob(jobId);
  if (job) {
    res.write(`event: update\ndata: ${JSON.stringify(job)}\n\n`);
  }

  // Cleanup on disconnect
  req.on('close', () => {
    const jobClients = clients.get(jobId) || [];
    const index = jobClients.indexOf(res);
    if (index !== -1) {
      jobClients.splice(index, 1);
    }
    if (jobClients.length === 0) {
      clients.delete(jobId);
    }
  });
});

/**
 * Broadcast an update to all clients listening to a specific job.
 * @param {string} jobId
 * @param {object} jobData
 * @param {string} eventName - Default is 'update'
 */
function broadcastJobUpdate(jobId, jobData, eventName = 'update') {
  const jobClients = clients.get(jobId);
  if (jobClients && jobClients.length > 0) {
    const dataString = JSON.stringify(jobData);
    jobClients.forEach(res => {
      res.write(`event: ${eventName}\ndata: ${dataString}\n\n`);
      // Automatically close connection if job is terminal
      if (eventName === 'update' && (jobData.status === JobStatus.COMPLETED || jobData.status === JobStatus.FAILED)) {
         // optionally close, or let the client close it
      }
    });
  }
}

module.exports = {
  router,
  broadcastJobUpdate
};
