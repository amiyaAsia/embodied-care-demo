import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeTrajectory } from './motion.js';
import { createState, respond, evaluateMotion } from './engine.js';

const close = (actual, expected, tolerance = 1e-8) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} ≈ ${expected}`);
const points = pairs => pairs.map(([t, value]) => ({ t, value }));
function smooth({ fps = 60, before = 0, after = 0, jitter = false } = {}) {
  const result = [];
  const total = before + 5 + after;
  for (let i = 0; i <= Math.round(total * fps); i++) {
    const t = i / fps + (jitter && i > 0 && i < total * fps ? Math.sin(i) * 0.2 / fps : 0);
    const phase = t - before;
    const value = phase <= 0 || phase >= 5 ? 0
      : phase < 2 ? 0.55 * (1 - Math.cos(Math.PI * phase / 2)) / 2
        : phase <= 3 ? 0.55 : 0.55 * (1 + Math.cos(Math.PI * (phase - 3) / 2)) / 2;
    result.push({ t, value });
  }
  return result;
}

test('五秒平滑55%前伸回收给出正常节奏和良好engine分数', () => {
  const result = analyzeTrajectory(smooth());
  assert.equal(result.valid, true);
  close(result.amplitude, 55);
  close(result.duration, 5);
  assert.ok(result.tempo > 3 && result.tempo < 4);
  assert.ok(result.hold > 1 && result.hold < 2);
  close(result.tempo + result.hold, result.duration);
  assert.ok(result.smoothness > 90);
  let state = createState();
  for (const action of ['explain', 'posture', 'slow', 'check']) state = respond(state, { action }).state;
  assert.ok(evaluateMotion(state, result).metrics.score >= 75);
  assert.deepEqual(Object.keys(result).sort(),
    ['valid', 'amplitude', 'tempo', 'hold', 'smoothness', 'duration', 'activeStart', 'activeEnd'].sort());
});

test('开始多等三秒和结尾静止不改变运动指标', () => {
  const baseline = analyzeTrajectory(smooth());
  const waited = analyzeTrajectory(smooth({ before: 3, after: 7 }));
  for (const key of ['amplitude', 'tempo', 'hold', 'smoothness', 'duration']) close(waited[key], baseline[key]);
  close(waited.activeStart, 3);
  close(waited.activeEnd, 8);
});

test('92%阈值使用时间插值并累计分开的峰值区间', () => {
  const result = analyzeTrajectory(points([[0, 0], [1, 0.5], [2, 0.5], [3, 0.4], [4, 0.5], [5, 0]]));
  assert.equal(result.valid, true);
  close(result.hold, 1.96);
  close(result.tempo, 3.04);
  const plateau = analyzeTrajectory(points([[0, 0], [1, 0.5], [2, 0.46], [4, 0.46], [5, 0]]));
  close(plateau.hold, 3.08);
});

test('30/60/144Hz与非均匀rAF近似一致且冻结输入不变', () => {
  const baseline = analyzeTrajectory(smooth());
  for (const fps of [30, 60, 144]) {
    const samples = Object.freeze(smooth({ fps, jitter: true }).map(Object.freeze));
    const snapshot = JSON.stringify(samples);
    const result = analyzeTrajectory(samples);
    assert.equal(result.valid, true);
    close(result.tempo, baseline.tempo, 0.01);
    close(result.smoothness, baseline.smoothness, 1);
    assert.equal(JSON.stringify(samples), snapshot);
  }
});

test('未完整回收、起点过高、幅度不足和没有前伸均返回中文原因', () => {
  for (const pairs of [
    [[0, 0], [1, 0.55], [2, 0.2]],
    [[0, 0.2], [1, 0.55], [2, 0]],
    [[0, 0], [1, 0.149], [2, 0]],
    [[0, 0.15], [1, 0.15], [2, 0.1]],
    [[0, 0], [1, 0], [2, 0]],
  ]) {
    const result = analyzeTrajectory(points(pairs));
    assert.equal(result.valid, false);
    assert.match(result.reason, /[\u4e00-\u9fff]/);
    assert.deepEqual(Object.keys(result).sort(), ['reason', 'valid']);
  }
});

test('无效采样与重复或倒序时间被拒绝', () => {
  for (const samples of [undefined, [], [{ t: 0, value: 0 }],
    points([[0, 0], [0, 0.5], [1, 0]]), points([[1, 0], [0, 0.5], [2, 0]]),
    points([[0, 0], [1, NaN], [2, 0]]), points([[0, 0], [Infinity, 0.5], [2, 0]]),
    points([[0, 0], [1, 1.1], [2, 0]]), [null, {}, {}]]) {
    assert.equal(analyzeTrajectory(samples).valid, false);
  }
});

test('突跳加长等待仍然rough，网格之间的短突跳也不漏判', () => {
  for (const wait of [0, 30, 120]) {
    const samples = points([[0, 0], [3, 0], [3.016, 0.55], [3.116 + wait, 0.55],
      [3.132 + wait, 0], [10 + wait, 0]]);
    const result = analyzeTrajectory(samples);
    assert.equal(result.valid, true);
    assert.ok(result.smoothness < 30);
  }
  const shortSpike = analyzeTrajectory(points([[0, 0], [0.01, 0.55], [0.02, 0], [5, 0]]));
  assert.equal(shortSpike.valid, true);
  assert.ok(shortSpike.smoothness < 30);
});

test('接受恰好15%阈值，幅度是绝对peak且时长不clamp', () => {
  const minimum = analyzeTrajectory(points([[0, 0], [1, 0.15], [2, 0]]));
  assert.equal(minimum.valid, true);
  close(minimum.amplitude, 15);
  const result = analyzeTrajectory(points([[10, 0.15], [12, 0.15], [22, 0.55],
    [32, 0.55], [42, 0.15], [50, 0.15]]));
  assert.equal(result.valid, true);
  close(result.amplitude, 55);
  close(result.activeStart, 12);
  close(result.activeEnd, 42);
  close(result.duration, 30);
  close(result.hold, 12.2);
  close(result.tempo, 17.8);
});
