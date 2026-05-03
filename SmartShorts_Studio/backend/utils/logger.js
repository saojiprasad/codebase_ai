function logStage(stage, message, data = null) {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${stage}]`;
  if (data === null || data === undefined) {
    console.log(`${prefix} ${message}`);
    return;
  }
  console.log(`${prefix} ${message}`, data);
}

function logAi(message, data = null) {
  logStage('AI', message, data);
}

function logRender(message, data = null) {
  logStage('RENDER', message, data);
}

function logWhisper(message, data = null) {
  logStage('WHISPER', message, data);
}

module.exports = {
  logStage,
  logAi,
  logRender,
  logWhisper
};
