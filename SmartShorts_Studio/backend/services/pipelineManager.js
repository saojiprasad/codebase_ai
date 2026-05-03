const { updateJob, JobStatus } = require('./jobStore');

async function runPipeline(jobId, context, steps, onStepProgress = () => {}) {
  const totalSteps = steps.length;
  updateJob(jobId, {
    status: JobStatus.PROCESSING,
    progress: 0,
    pipelineSteps: steps.map(step => step.name)
  });

  let currentContext = { ...context };

  for (let i = 0; i < totalSteps; i++) {
    const step = steps[i];
    const stepStartProgress = (i / totalSteps) * 100;
    const stepEndProgress = ((i + 1) / totalSteps) * 100;
    const stepProgressRange = stepEndProgress - stepStartProgress;

    console.log(`[Job ${jobId}] Step ${i + 1}/${totalSteps}: ${step.name}`);
    updateJob(jobId, {
      currentStep: step.name,
      currentStepDescription: step.description,
      progress: Math.round(stepStartProgress)
    });

    try {
      const result = await step.execute(currentContext, percent => {
        const overallProgress = stepStartProgress + (percent / 100) * stepProgressRange;
        updateJob(jobId, { progress: Math.min(Math.round(overallProgress), 99) });
        onStepProgress(step.name, percent);
      });

      currentContext = { ...currentContext, ...result };
    } catch (error) {
      console.error(`[Job ${jobId}] Step '${step.name}' failed: ${error.message}`);
      updateJob(jobId, {
        status: JobStatus.FAILED,
        error: `Step '${step.name}' failed: ${error.message}`
      });
      throw error;
    }
  }

  updateJob(jobId, {
    status: JobStatus.COMPLETED,
    progress: 100,
    currentStep: null,
    currentStepDescription: 'Complete'
  });

  return currentContext;
}

module.exports = {
  runPipeline
};
