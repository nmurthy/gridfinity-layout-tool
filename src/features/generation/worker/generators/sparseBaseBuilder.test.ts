// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { initTestKernel } from '@/test/initTestKernel';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { buildSparseBase as BuildSparseBaseFn } from './sparseBaseBuilder';
import type { buildBaseSocket as BuildBaseSocketFn } from './socketBuilder';

let buildSparseBase: typeof BuildSparseBaseFn;
let buildBaseSocket: typeof BuildBaseSocketFn;
let meshShape: (shape: unknown) => { vertices: ArrayLike<number>; triangles: ArrayLike<number> };
let volumeOf: (shape: unknown) => number;

beforeAll(async () => {
  const { mesh: meshFn, measureVolume } = await import('brepjs');
  await initTestKernel();
  const sparseMod = await import('./sparseBaseBuilder');
  buildSparseBase = sparseMod.buildSparseBase;
  const socketMod = await import('./socketBuilder');
  buildBaseSocket = socketMod.buildBaseSocket;
  meshShape = (shape) => meshFn(shape as never, { tolerance: 1, angularTolerance: 30 });
  volumeOf = (shape) => {
    const r = measureVolume(shape as never);
    if (!r.ok) throw new Error('measureVolume failed');
    return r.value;
  };
}, 30000);

const cfg = DEFAULT_BIN_PARAMS.sparseBase;

describe('buildSparseBase', () => {
  it('produces a carved, non-empty solid for a 2x2 grid', () => {
    const sparse = buildSparseBase(2, 2, cfg, true);
    const sparseMesh = meshShape(sparse);
    expect(sparseMesh.triangles.length).toBeGreaterThan(0);

    // Full solid feet built the same way (no locator carving) — sparse must
    // remove material relative to this baseline.
    const fullFeet = buildBaseSocket(2, 2, false, false, 0, 0, 0, true);
    expect(volumeOf(sparse)).toBeLessThan(volumeOf(fullFeet));
  }, 30000);

  it('produces a carved, non-empty solid for a half-socket grid', () => {
    const sparse = buildSparseBase(2, 2, cfg, true, true);
    const sparseMesh = meshShape(sparse);
    expect(sparseMesh.triangles.length).toBeGreaterThan(0);

    const fullFeet = buildBaseSocket(2, 2, false, false, 0, 0, 0, true, true);
    expect(volumeOf(sparse)).toBeLessThan(volumeOf(fullFeet));
  }, 30000);

  it('more coverage adds more material, both still short of full feet', () => {
    const sparseFull = buildSparseBase(2, 2, { ...cfg, locatorCoverage: 100 }, true);
    const sparseNone = buildSparseBase(2, 2, { ...cfg, locatorCoverage: 0 }, true);
    expect(meshShape(sparseFull).triangles.length).toBeGreaterThan(0);
    expect(meshShape(sparseNone).triangles.length).toBeGreaterThan(0);

    const fullFeet = buildBaseSocket(2, 2, false, false, 0, 0, 0, true);
    const volFull = volumeOf(sparseFull);
    const volNone = volumeOf(sparseNone);
    expect(volFull).toBeGreaterThan(volNone);
    expect(volFull).toBeLessThan(volumeOf(fullFeet));
    expect(volNone).toBeLessThan(volumeOf(fullFeet));
  }, 30000);
});
