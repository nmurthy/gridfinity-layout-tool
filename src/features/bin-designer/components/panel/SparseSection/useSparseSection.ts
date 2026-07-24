import { useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useTranslation } from '@/i18n';
import { getFeatureStatus, resolveConstraints } from '@/shared/constraints';

export function useSparseSection() {
  const t = useTranslation();
  const { sparseBase, updateSparseBase, setParams, params } = useDesignerStore(
    useShallow((s) => ({
      sparseBase: s.params.sparseBase,
      updateSparseBase: s.updateSparseBase,
      setParams: s.setParams,
      params: s.params,
    }))
  );

  const status = getFeatureStatus(params, 'sparseBase');
  const disabledReason = status.reason ? t(status.reason) : undefined;

  const toggleSparseBase = useCallback(() => {
    // Only block enabling — allow disabling so users can recover from invalid states
    if (!sparseBase.enabled && !status.available) return;
    const { params: resolved } = resolveConstraints(params, {
      feature: 'sparseBase',
      enabled: !sparseBase.enabled,
    });
    setParams(resolved);
  }, [params, sparseBase.enabled, status.available, setParams]);

  const setCornerLegLength = useCallback(
    (value: number) => {
      updateSparseBase({ cornerLegLength: value });
    },
    [updateSparseBase]
  );

  const setEdgeSegmentLength = useCallback(
    (value: number) => {
      updateSparseBase({ edgeSegmentLength: value });
    },
    [updateSparseBase]
  );

  const setCentralLength = useCallback(
    (value: number) => {
      updateSparseBase({ centralLength: value });
    },
    [updateSparseBase]
  );

  const setLocatorBand = useCallback(
    (value: number) => {
      updateSparseBase({ locatorBand: value });
    },
    [updateSparseBase]
  );

  const setExtraClearance = useCallback(
    (value: number) => {
      updateSparseBase({ extraClearance: value });
    },
    [updateSparseBase]
  );

  const setLocatorCoverage = useCallback(
    (value: number) => {
      updateSparseBase({ locatorCoverage: value });
    },
    [updateSparseBase]
  );

  const toggleEdgeLocators = useCallback(() => {
    updateSparseBase({ edgeLocators: !sparseBase.edgeLocators });
  }, [sparseBase.edgeLocators, updateSparseBase]);

  const toggleCentralLocators = useCallback(() => {
    updateSparseBase({ centralLocators: !sparseBase.centralLocators });
  }, [sparseBase.centralLocators, updateSparseBase]);

  return {
    state: { sparseBase, disabledReason },
    handlers: {
      toggleSparseBase,
      setCornerLegLength,
      setEdgeSegmentLength,
      setCentralLength,
      setLocatorBand,
      setExtraClearance,
      setLocatorCoverage,
      toggleEdgeLocators,
      toggleCentralLocators,
    },
    t,
  };
}
