import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { assertBoundingBoxMatchesParams } from '../__kernel-tests__/meshAssertions';
import { defineScenario } from '../__kernel-tests__/scenarioTypes';
import type { ScenarioCase } from '../__kernel-tests__/scenarioTypes';

const sparse = { ...DEFAULT_BIN_PARAMS.sparseBase, enabled: true };

export const sparseBase: ScenarioCase[] = [
  defineScenario('sparseBase', '2×2 sparse', {
    assert: 'structural',
    params: { width: 2, depth: 2, sparseBase: sparse },
    customAssert: (result, params) => assertBoundingBoxMatchesParams(result, params, '2x2-sparse'),
  }),
  defineScenario('sparseBase', '2×3 sparse', {
    assert: 'structural',
    params: { width: 2, depth: 3, sparseBase: sparse },
    customAssert: (result, params) => assertBoundingBoxMatchesParams(result, params, '2x3-sparse'),
  }),

  // Half sockets shell each quarter-cell; sparse feet must still carve cleanly.
  defineScenario('sparseBase', '2×2 sparse, half sockets', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 2,
      sparseBase: sparse,
      base: { ...DEFAULT_BIN_PARAMS.base, halfSockets: true },
    },
    customAssert: (result, params) =>
      assertBoundingBoxMatchesParams(result, params, '2x2-sparse-half-sockets'),
  }),

  defineScenario('sparseBase', '2×2 sparse + no lip', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 2,
      sparseBase: sparse,
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false },
    },
  }),

  defineScenario('sparseBase', '2×2 sparse, edge locators off', {
    assert: 'structural',
    params: { width: 2, depth: 2, sparseBase: { ...sparse, edgeLocators: false } },
  }),

  defineScenario('sparseBase', '2×2 sparse, central locators off', {
    assert: 'structural',
    params: { width: 2, depth: 2, sparseBase: { ...sparse, centralLocators: false } },
  }),

  defineScenario('sparseBase', '2×2 sparse, extra clearance 0.5', {
    assert: 'structural',
    params: { width: 2, depth: 2, sparseBase: { ...sparse, extraClearance: 0.5 } },
  }),

  defineScenario('sparseBase', '2×2 sparse, coverage 0', {
    assert: 'structural',
    params: { width: 2, depth: 2, sparseBase: { ...sparse, locatorCoverage: 0 } },
  }),

  defineScenario('sparseBase', '2×2 sparse, coverage 100', {
    assert: 'structural',
    params: { width: 2, depth: 2, sparseBase: { ...sparse, locatorCoverage: 100 } },
  }),

  // Multiple interior junctions (2 columns × 2 rows of interior crosses).
  defineScenario('sparseBase', '3×3 sparse', {
    assert: 'structural',
    params: { width: 3, depth: 3, sparseBase: sparse },
    customAssert: (result, params) => assertBoundingBoxMatchesParams(result, params, '3x3-sparse'),
  }),

  // It actually did something: sparse feet differ from the standard full-feet base.
  defineScenario('sparseBase', '2×2 sparse differs from standard', {
    assert: 'structural',
    params: { width: 2, depth: 2, sparseBase: sparse },
    compareWith: {
      params: {
        width: 2,
        depth: 2,
        sparseBase: { ...DEFAULT_BIN_PARAMS.sparseBase, enabled: false },
      },
      assert: (sparseResult, standard) => {
        if (sparseResult.triangleCount === standard.triangleCount) {
          throw new Error(
            `sparse mesh (${sparseResult.triangleCount} tris) identical to standard — feet were not carved`
          );
        }
      },
    },
  }),
];
