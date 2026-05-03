const { logAi } = require('../utils/logger');

function isPythonAiEnabled() {
  return String(process.env.PYTHON_AI_ENABLED || '').toLowerCase() === 'true';
}

function getPythonAiBaseUrl() {
  return (process.env.PYTHON_AI_URL || 'http://127.0.0.1:8001').replace(/\/$/, '');
}

async function postJson(path, payload, timeoutMs = 300000) {
  if (!isPythonAiEnabled() || typeof fetch !== 'function') {
    logAi('Python AI service skipped', {
      enabled: isPythonAiEnabled(),
      fetchAvailable: typeof fetch === 'function'
    });
    return null;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    logAi(`Python AI request: ${path}`, payload);
    const response = await fetch(`${getPythonAiBaseUrl()}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    if (!response.ok) {
      logAi(`Python AI response not OK: ${path}`, { status: response.status });
      return null;
    }
    const json = await response.json();
    logAi(`Python AI response: ${path}`, {
      success: json?.success,
      keys: json && typeof json === 'object' ? Object.keys(json) : []
    });
    return json;
  } catch (error) {
    console.warn(`[PythonAI] ${path} unavailable: ${error.message}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function transcribeWithPythonAi(videoPath, outputDir, model) {
  const result = await postJson('/transcribe', {
    video_path: videoPath,
    output_dir: outputDir,
    model
  });

  if (result?.success && result.srt_path) {
    return result.srt_path;
  }
  return null;
}

module.exports = {
  isPythonAiEnabled,
  transcribeWithPythonAi
};
