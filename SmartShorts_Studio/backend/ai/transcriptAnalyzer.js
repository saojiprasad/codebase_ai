/**
 * Transcript Analyzer — NLP analysis of Whisper transcripts
 * 
 * Parses Whisper SRT output and analyzes text for:
 * - Hook phrases ("you won't believe", "the truth about", etc.)
 * - Emotional intensity (sentiment analysis)
 * - Question detection
 * - Keyword spotting
 * - Engagement scoring
 */

const Sentiment = require('sentiment');
const sentiment = new Sentiment();

// ── Hook patterns — phrases that grab attention ─────────────────────
const HOOK_PATTERNS = [
  // Questions
  { pattern: /\b(did you know|have you ever|what if|how to|why do|can you)\b/i, score: 8, type: 'question' },
  { pattern: /\?/, score: 5, type: 'question' },
  // Curiosity gaps
  { pattern: /\b(secret|hidden|truth|nobody|no one|never|shocking|surprising|incredible)\b/i, score: 9, type: 'curiosity' },
  { pattern: /\b(you won't believe|this changed|everything you know|most people don't)\b/i, score: 10, type: 'hook' },
  { pattern: /\b(here's the thing|the problem is|the reality is|let me tell you)\b/i, score: 8, type: 'hook' },
  { pattern: /\b(wait|watch|listen|look|this one mistake|nobody talks about|the truth is)\b/i, score: 10, type: 'hook' },
  { pattern: /\b(cost me|destroyed|changed my life|lost everything|blew up|went viral)\b/i, score: 10, type: 'story_peak' },
  // Urgency
  { pattern: /\b(right now|immediately|stop|wait|listen|watch this|pay attention)\b/i, score: 9, type: 'urgency' },
  // Numbers / specifics
  { pattern: /\b(\d+\s*(ways|tips|steps|reasons|things|mistakes|rules|secrets))\b/i, score: 8, type: 'list' },
  // Emotional
  { pattern: /\b(amazing|insane|crazy|mind-blowing|unbelievable|life-changing)\b/i, score: 7, type: 'emotional' },
  // Controversy
  { pattern: /\b(wrong|lie|fake|scam|myth|truth|actually|contrary)\b/i, score: 7, type: 'controversy' },
  { pattern: /\b(argue|fight|debate|disagree|called out|exposed)\b/i, score: 8, type: 'debate' },
  { pattern: /\b(laugh|funny|hilarious|joke|ridiculous)\b/i, score: 7, type: 'humor' },
  { pattern: /\b(money|business|million|billion|sales|revenue|profit)\b/i, score: 7, type: 'finance' },
  { pattern: /\b(ai|automation|future|technology|robot)\b/i, score: 6, type: 'technology' },
  // Stories
  { pattern: /\b(story|happened|one day|when i|i was|i remember)\b/i, score: 6, type: 'story' }
];

// ── Emphasis words — words to style differently in subtitles ────────
const EMPHASIS_WORDS = new Set([
  'never', 'always', 'absolutely', 'literally', 'actually', 'seriously',
  'incredible', 'amazing', 'insane', 'crazy', 'unbelievable', 'impossible',
  'million', 'billion', 'thousand', 'hundred', 'everything', 'nothing',
  'money', 'free', 'secret', 'truth', 'success', 'failure', 'power',
  'love', 'hate', 'fear', 'die', 'kill', 'destroy', 'explode',
  'best', 'worst', 'first', 'last', 'only', 'biggest', 'smallest'
]);

/**
 * Parse an SRT file into structured segments.
 * @param {string} srtContent - Raw SRT file content
 * @returns {Array<{index: number, start: number, end: number, text: string}>}
 */
function parseSRT(srtContent) {
  const segments = [];
  const blocks = srtContent.trim().split(/\n\s*\n/);

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length < 3) continue;

    const index = parseInt(lines[0]);
    const timeMatch = lines[1].match(/(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})/);
    if (!timeMatch) continue;

    const start = parseInt(timeMatch[1]) * 3600 + parseInt(timeMatch[2]) * 60 +
                  parseInt(timeMatch[3]) + parseInt(timeMatch[4]) / 1000;
    const end = parseInt(timeMatch[5]) * 3600 + parseInt(timeMatch[6]) * 60 +
                parseInt(timeMatch[7]) + parseInt(timeMatch[8]) / 1000;
    const text = lines.slice(2).join(' ').trim();

    segments.push({ index, start, end, text });
  }

  return segments;
}

/**
 * Analyze a single text segment for hook quality and engagement.
 * @param {string} text
 * @returns {{hookScore: number, emotion: string, sentiment: number, hooks: string[], emphasisWords: string[]}}
 */
function analyzeSegment(text) {
  // Sentiment analysis
  const sentResult = sentiment.analyze(text);
  const sentScore = sentResult.score;

  // Hook pattern matching
  let hookScore = 0;
  const hooks = [];
  for (const { pattern, score, type } of HOOK_PATTERNS) {
    if (pattern.test(text)) {
      hookScore += score;
      hooks.push(type);
    }
  }

  // Find emphasis words
  const words = text.toLowerCase().split(/\s+/);
  const emphasisWords = words.filter(w => EMPHASIS_WORDS.has(w.replace(/[^a-z]/g, '')));

  // Determine emotional tone
  let emotion = 'neutral';
  if (sentScore > 3) emotion = 'positive';
  else if (sentScore < -3) emotion = 'negative';
  else if (hooks.includes('humor')) emotion = 'funny';
  else if (hooks.includes('debate') || hooks.includes('controversy')) emotion = 'tense';
  else if (hookScore > 7) emotion = 'exciting';
  else if (hooks.includes('question')) emotion = 'curious';
  else if (hooks.includes('story')) emotion = 'narrative';

  // Bonus for emphasis words
  hookScore += emphasisWords.length * 2;

  // Cap at 100
  hookScore = Math.min(hookScore, 100);

  return { hookScore, emotion, sentiment: sentScore, hooks, emphasisWords };
}

/**
 * Analyze a full transcript (from SRT file content).
 * @param {string} srtContent - Raw SRT content
 * @returns {{segments: Array, overallHookScore: number, bestHookSegment: object, emotionMap: object}}
 */
function analyzeTranscript(srtContent) {
  const parsed = parseSRT(srtContent);
  const analyzed = parsed.map(seg => ({
    ...seg,
    ...analyzeSegment(seg.text)
  }));

  const bestHookSegment = analyzed.length > 0 ? [...analyzed].sort((a, b) => b.hookScore - a.hookScore)[0] : null;
  const overallHookScore = bestHookSegment ? bestHookSegment.hookScore : 0;

  console.log(`  [Transcript] Analyzed ${analyzed.length} blocks. Top hook score: ${overallHookScore}, Emotion: ${bestHookSegment?.emotion || 'neutral'}`);

  // Count emotions
  const emotionMap = {};
  for (const seg of analyzed) {
    emotionMap[seg.emotion] = (emotionMap[seg.emotion] || 0) + 1;
  }

  return { segments: analyzed, overallHookScore, bestHookSegment, emotionMap };
}

/**
 * Score a time range for "hook quality" based on transcript analysis.
 * @param {Array} analyzedSegments - From analyzeTranscript().segments
 * @param {number} startTime
 * @param {number} endTime
 * @returns {{score: number, bestHook: string, emotion: string}}
 */
function scoreTimeRange(analyzedSegments, startTime, endTime) {
  const inRange = analyzedSegments.filter(s => s.start >= startTime && s.end <= endTime);
  if (inRange.length === 0) return { score: 0, bestHook: '', emotion: 'neutral' };

  const avgScore = inRange.reduce((sum, s) => sum + s.hookScore, 0) / inRange.length;
  const best = inRange.reduce((b, s) => s.hookScore > (b?.hookScore || 0) ? s : b, null);

  // Bonus: first segment has hook (strong opening)
  const firstSegHook = inRange[0]?.hookScore > 5 ? 15 : 0;

  return {
    score: Math.min(Math.round(avgScore + firstSegHook), 100),
    bestHook: best?.text || '',
    emotion: best?.emotion || 'neutral'
  };
}

module.exports = {
  parseSRT,
  analyzeSegment,
  analyzeTranscript,
  scoreTimeRange,
  EMPHASIS_WORDS
};
