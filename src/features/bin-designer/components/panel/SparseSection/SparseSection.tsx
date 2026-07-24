/**
 * Sparse base section: replaces full feet with corner/edge/central locators,
 * saving material and print time while keeping the socket registration.
 *
 * Controls: toggle on/off, five mm-tuning sliders (corner leg length, edge
 * segment length, central cross length, locator band width, extra clearance)
 * and two sub-toggles (edge locators, central locators). Mutually exclusive
 * with flat/lightweight bases and magnet/screw holes — see useSparseSection.
 */

import { CheckboxRow, SliderInput } from '@/design-system';
import { FeatureToggle } from '../FeatureToggle';
import { DESIGNER_CONSTRAINTS } from '@/features/bin-designer/constants';
import { useSparseSection } from './useSparseSection';

export function SparseSection() {
  const { state, handlers, t } = useSparseSection();
  const { sparseBase, disabledReason } = state;

  return (
    <FeatureToggle
      label={t('binDesigner.sparseBase')}
      checked={sparseBase.enabled}
      onChange={handlers.toggleSparseBase}
      disabledReason={disabledReason}
    >
      <SliderInput
        label={t('binDesigner.sparseBaseCornerLegLength')}
        value={sparseBase.cornerLegLength}
        onChange={handlers.setCornerLegLength}
        min={DESIGNER_CONSTRAINTS.MIN_SPARSE_CORNER_LEG_LENGTH}
        max={DESIGNER_CONSTRAINTS.MAX_SPARSE_CORNER_LEG_LENGTH}
        step={DESIGNER_CONSTRAINTS.SPARSE_CORNER_LEG_LENGTH_STEP}
        unit="mm"
      />
      <SliderInput
        label={t('binDesigner.sparseBaseEdgeSegmentLength')}
        value={sparseBase.edgeSegmentLength}
        onChange={handlers.setEdgeSegmentLength}
        min={DESIGNER_CONSTRAINTS.MIN_SPARSE_EDGE_SEGMENT_LENGTH}
        max={DESIGNER_CONSTRAINTS.MAX_SPARSE_EDGE_SEGMENT_LENGTH}
        step={DESIGNER_CONSTRAINTS.SPARSE_EDGE_SEGMENT_LENGTH_STEP}
        unit="mm"
      />
      <SliderInput
        label={t('binDesigner.sparseBaseCentralLength')}
        value={sparseBase.centralLength}
        onChange={handlers.setCentralLength}
        min={DESIGNER_CONSTRAINTS.MIN_SPARSE_CENTRAL_LENGTH}
        max={DESIGNER_CONSTRAINTS.MAX_SPARSE_CENTRAL_LENGTH}
        step={DESIGNER_CONSTRAINTS.SPARSE_CENTRAL_LENGTH_STEP}
        unit="mm"
      />
      <SliderInput
        label={t('binDesigner.sparseBaseLocatorBand')}
        value={sparseBase.locatorBand}
        onChange={handlers.setLocatorBand}
        min={DESIGNER_CONSTRAINTS.MIN_SPARSE_LOCATOR_BAND}
        max={DESIGNER_CONSTRAINTS.MAX_SPARSE_LOCATOR_BAND}
        step={DESIGNER_CONSTRAINTS.SPARSE_LOCATOR_BAND_STEP}
        unit="mm"
      />
      <SliderInput
        label={t('binDesigner.sparseBaseExtraClearance')}
        value={sparseBase.extraClearance}
        onChange={handlers.setExtraClearance}
        min={DESIGNER_CONSTRAINTS.MIN_SPARSE_EXTRA_CLEARANCE}
        max={DESIGNER_CONSTRAINTS.MAX_SPARSE_EXTRA_CLEARANCE}
        step={DESIGNER_CONSTRAINTS.SPARSE_EXTRA_CLEARANCE_STEP}
        unit="mm"
      />

      <CheckboxRow
        label={t('binDesigner.sparseBaseEdgeLocators')}
        checked={sparseBase.edgeLocators}
        onChange={handlers.toggleEdgeLocators}
      />
      <CheckboxRow
        label={t('binDesigner.sparseBaseCentralLocators')}
        checked={sparseBase.centralLocators}
        onChange={handlers.toggleCentralLocators}
      />
    </FeatureToggle>
  );
}
