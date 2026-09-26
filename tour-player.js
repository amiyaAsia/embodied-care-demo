/** Deterministic playback clock. No wall-clock catch-up after pause or tab hiding. */
export function createPlayer(chapters) {
  if (!chapters.length || chapters.some(c => !c.steps.length)) throw new Error('Empty story');
  let chapter = 0, step = 0, elapsed = 0, playing = false, ended = false;
  const snapshot = () => ({ chapter, step, elapsed, playing, ended });
  const current = () => chapters[chapter].steps[step];
  return {
    snapshot, current,
    play() { if (!ended) playing = true; return snapshot(); },
    pause() { playing = false; return snapshot(); },
    restart() { chapter = 0; step = 0; elapsed = 0; playing = false; ended = false; return snapshot(); },
    select(index) {
      if (!Number.isInteger(index) || index < 0 || index >= chapters.length) throw new RangeError('Invalid chapter');
      chapter = index; step = 0; elapsed = 0; playing = false; ended = false; return snapshot();
    },
    advance(ms, duration = current().duration, holdForSpeech = false) {
      if (!playing || !Number.isFinite(ms) || ms < 0) return false;
      // Large gaps are ignored: a throttled/background tab must never skip captions.
      if (ms > 250) return false;
      elapsed = Math.min(duration, elapsed + ms);
      if (elapsed < duration || holdForSpeech) return false;
      if (step + 1 < chapters[chapter].steps.length) step++;
      else if (chapter + 1 < chapters.length) { chapter++; step = 0; }
      else { ended = true; playing = false; return true; }
      elapsed = 0;
      return true;
    },
    preserveReadingPosition(oldDuration, newDuration) {
      elapsed = Math.min(newDuration, elapsed / Math.max(1, oldDuration) * newDuration);
      return snapshot();
    },
  };
}

/** Includes record excerpts and physical-action captions, not just dialogue. */
export function readingDuration(step, locale = 'en') {
  const texts = [step.text?.[locale], step.action?.[locale], step.record?.title?.[locale],
    ...(step.record?.fields || []).flatMap(f => [f.label[locale], f.value[locale]])].filter(Boolean);
  const count = locale === 'zh' ? texts.join('').replace(/\s/g, '').length : texts.join(' ').split(/\s+/).length;
  return Math.max(step.duration, 3500 + count * (locale === 'zh' ? 210 : 410));
}
