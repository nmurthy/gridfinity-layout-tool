// @vitest-environment node
import { runScenarios } from './__kernel-tests__/scenarioRunner';
import { sparseBase } from './scenarios/sparseBase';

runScenarios(sparseBase);
