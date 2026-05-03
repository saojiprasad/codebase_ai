const PLATFORM_HASHTAGS = {
  shorts: ['#shorts', '#youtube', '#viral'],
  reels: ['#reels', '#instagram', '#creator'],
  tiktok: ['#tiktok', '#fyp', '#viral']
};

const MODE_HASHTAGS = {
  auto_viral: ['#storytime', '#mindset'],
  podcast: ['#podcast', '#interview'],
  podcast_viral: ['#podcast', '#interview'],
  debate: ['#debate', '#drama'],
  motivational: ['#motivation', '#success'],
  educational: ['#learn', '#explained'],
  gaming: ['#gaming', '#streamer'],
  finance: ['#finance', '#money'],
  dark_documentary: ['#documentary', '#mystery'],
  comedy: ['#funny', '#comedy'],
  documentary: ['#documentary', '#story'],
  meme_style: ['#meme', '#funny'],
  cinematic_storytelling: ['#storytelling', '#cinematic']
};

function cleanText(text = '') {
  return text
    .replace(/\s+/g, ' ')
    .replace(/^["'“”]+|["'“”]+$/g, '')
    .trim();
}

function titleCaseStart(text) {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function truncate(text, limit) {
  const cleaned = cleanText(text);
  if (cleaned.length <= limit) return cleaned;
  return `${cleaned.slice(0, Math.max(0, limit - 3)).trim()}...`;
}

function inferAngle(clip = {}, mode = 'auto_viral') {
  const reason = (clip.reason || '').toLowerCase();
  const emotion = (clip.emotion || '').toLowerCase();
  const hook = (clip.hookText || '').toLowerCase();

  if (mode.includes('finance') || /\b(money|business|million|sales|invest|cash)\b/.test(hook)) return 'money';
  if (mode.includes('comedy') || /\b(laugh|funny|crazy|wild)\b/.test(hook)) return 'funny';
  if (mode.includes('debate') || reason.includes('controvers') || /\b(wrong|lie|truth|debate|argument)\b/.test(hook)) return 'truth';
  if (mode.includes('educational') || /\b(why|how|learn|lesson|mistake|steps)\b/.test(hook)) return 'learn';
  if (mode.includes('motivational') || emotion.includes('positive')) return 'motivation';
  if (emotion.includes('negative') || mode.includes('dark')) return 'warning';
  return 'curiosity';
}

function buildTitle(clip = {}, mode = 'auto_viral') {
  const hook = truncate(clip.hookText || '', 54);
  if (hook && hook.length >= 16) {
    return titleCaseStart(hook.replace(/[.?!]+$/, ''));
  }

  const angle = inferAngle(clip, mode);
  const templates = {
    money: 'This Money Lesson Changes Everything',
    funny: 'This Moment Got Out Of Control',
    truth: 'Nobody Wants To Admit This',
    learn: 'This One Lesson Saves Years',
    motivation: 'This Is The Mindset Shift',
    warning: 'This Mistake Can Cost Everything',
    curiosity: 'Wait Until You Hear This'
  };
  return templates[angle] || templates.curiosity;
}

function buildHashtags(mode = 'auto_viral', clip = {}) {
  const base = ['#shorts', '#viral', '#fyp'];
  const modeTags = MODE_HASHTAGS[mode] || MODE_HASHTAGS.auto_viral;
  const extra = [];
  const hook = (clip.hookText || '').toLowerCase();

  if (/\b(ai|artificial intelligence|chatgpt)\b/.test(hook)) extra.push('#ai');
  if (/\b(business|founder|startup)\b/.test(hook)) extra.push('#business');
  if (/\b(fitness|discipline|mindset)\b/.test(hook)) extra.push('#mindset');
  if (/\b(game|stream|player)\b/.test(hook)) extra.push('#gaming');

  return [...new Set([...base, ...modeTags, ...extra])].slice(0, 10);
}

function buildSeoPackage(clip = {}, mode = 'auto_viral') {
  const title = buildTitle(clip, mode);
  const hashtags = buildHashtags(mode, clip);
  const angle = inferAngle(clip, mode);
  const cta = angle === 'learn'
    ? 'Follow for more useful clips.'
    : angle === 'money'
      ? 'Save this before you forget it.'
      : 'Watch the full moment and share your take.';

  const hookLine = clip.hookText ? `Hook: ${truncate(clip.hookText, 120)}` : 'A high-retention moment selected automatically.';
  const description = `${hookLine}\n\n${cta}\n\n${hashtags.join(' ')}`;

  return {
    title,
    description,
    hashtags,
    cta,
    platform: {
      youtubeShorts: {
        title: truncate(title, 70),
        description,
        hashtags: [...new Set([...hashtags, ...PLATFORM_HASHTAGS.shorts])]
      },
      instagramReels: {
        title: truncate(title, 90),
        description: `${title}\n\n${hashtags.concat(PLATFORM_HASHTAGS.reels).join(' ')}`
      },
      tiktok: {
        title: truncate(`${title} ${hashtags.slice(0, 4).join(' ')}`, 110),
        hashtags: [...new Set([...hashtags, ...PLATFORM_HASHTAGS.tiktok])]
      }
    }
  };
}

module.exports = {
  buildSeoPackage,
  buildTitle,
  buildHashtags
};
