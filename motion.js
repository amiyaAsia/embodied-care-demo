const STEP = 1 / 20;
const EPSILON = 1e-9;
const invalid = reason => ({ valid: false, reason });

/**
 * Analyze one reach–return cycle without modifying samples.
 * All times are seconds; activeStart/activeEnd retain the input time origin.
 * duration excludes leading/trailing rest; tempo = duration - hold.
 * hold integrates time at >= 92% of the absolute peak, with linear crossings.
 * Amplitude and smoothness use a 0–100 scale; engine owns metric clamping.
 */
export function analyzeTrajectory(samples) {
  if (!Array.isArray(samples) || samples.length < 3) {
    return invalid('采样不足，请完成一次前伸和回收。');
  }
  let peak = -Infinity;
  let peakIndex = 0;
  let firstMoving = -1;
  let lastMoving = -1;
  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i];
    if (!sample || !Number.isFinite(sample.t) || !Number.isFinite(sample.value)
      || sample.value < 0 || sample.value > 1) {
      return invalid('采样必须包含有限时间和零到一之间的动作值。');
    }
    if (i > 0) {
      if (sample.t <= samples[i - 1].t) return invalid('采样时间必须严格递增。');
      if (Math.abs(sample.value - samples[i - 1].value) > EPSILON) {
        if (firstMoving < 0) firstMoving = i;
        lastMoving = i;
      }
    }
    if (sample.value > peak) {
      peak = sample.value;
      peakIndex = i;
    }
  }
  if (samples[0].value > 0.15) return invalid('起点过高，请先将手臂收回到起始位置。');
  if (peak < 0.15) return invalid('前伸幅度不足，请至少前伸到百分之十五。');
  if (samples.at(-1).value > 0.15) return invalid('尚未完整回收，请将手臂收回到百分之十五以内。');
  if (firstMoving < 0 || peakIndex < firstMoving || peakIndex >= lastMoving
    || peak - samples[0].value <= EPSILON || peak - samples.at(-1).value <= EPSILON) {
    return invalid('尚未完成一次清晰的前伸和回收。');
  }

  const start = firstMoving - 1;
  const activeStart = samples[start].t;
  const activeEnd = samples[lastMoving].t;
  const duration = activeEnd - activeStart;
  const threshold = peak * 0.92;
  let hold = 0;
  let peakSpeed = 0;
  for (let i = firstMoving; i <= lastMoving; i++) {
    const a = samples[i - 1];
    const b = samples[i];
    const dt = b.t - a.t;
    if (a.value >= threshold && b.value >= threshold) hold += dt;
    else if (a.value < threshold && b.value >= threshold) {
      hold += dt * (b.value - threshold) / (b.value - a.value);
    } else if (a.value >= threshold && b.value < threshold) {
      hold += dt * (a.value - threshold) / (a.value - b.value);
    }
    // Preserve sub-grid jumps that could fall entirely between 20 Hz points.
    peakSpeed = Math.max(peakSpeed, Math.abs(b.value - a.value) / Math.max(STEP, dt));
  }

  // Linear resampling in real time, independent of rAF cadence and rest length.
  // Peak derivatives rather than whole-record means prevent rest dilution.
  let cursor = firstMoving;
  let previousTime = activeStart;
  let previousValue = samples[start].value;
  let previousVelocity = 0;
  let previousDt = STEP;
  let peakAcceleration = 0;
  const count = Math.ceil(duration / STEP);
  for (let i = 1; i <= count; i++) {
    const t = i === count ? activeEnd : activeStart + i * STEP;
    while (cursor < lastMoving && samples[cursor].t < t) cursor++;
    const a = samples[cursor - 1];
    const b = samples[cursor];
    const value = a.value + (b.value - a.value) * ((t - a.t) / (b.t - a.t));
    const dt = t - previousTime;
    if (dt <= EPSILON) continue;
    const velocity = (value - previousValue) / dt;
    peakSpeed = Math.max(peakSpeed, Math.abs(velocity));
    peakAcceleration = Math.max(peakAcceleration,
      Math.abs(velocity - previousVelocity) / ((dt + previousDt) / 2));
    previousTime = t;
    previousValue = value;
    previousVelocity = velocity;
    previousDt = dt;
  }
  peakAcceleration = Math.max(peakAcceleration,
    Math.abs(previousVelocity) / ((previousDt + STEP) / 2));
  // Gentle five-second reaches score highly; fast steps/velocity changes do not.
  const smoothness = 100 / (1 + (peakSpeed / 1.5) ** 4 + (peakAcceleration / 12) ** 2);
  return {
    valid: true, amplitude: peak * 100, tempo: duration - hold, hold,
    smoothness, duration, activeStart, activeEnd,
  };
}
