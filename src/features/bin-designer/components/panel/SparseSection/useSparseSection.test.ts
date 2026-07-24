import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSparseSection } from './useSparseSection';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';

describe('useSparseSection', () => {
  beforeEach(() => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS },
    });
  });

  it('toggleSparseBase enables the sparse base', () => {
    const { result } = renderHook(() => useSparseSection());

    expect(result.current.state.sparseBase.enabled).toBe(false);

    act(() => {
      result.current.handlers.toggleSparseBase();
    });

    expect(useDesignerStore.getState().params.sparseBase.enabled).toBe(true);
  });

  it('toggleSparseBase disables the sparse base again', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        sparseBase: { ...DEFAULT_BIN_PARAMS.sparseBase, enabled: true },
      },
    });

    const { result } = renderHook(() => useSparseSection());

    act(() => {
      result.current.handlers.toggleSparseBase();
    });

    expect(useDesignerStore.getState().params.sparseBase.enabled).toBe(false);
  });

  it('setCornerLegLength updates cornerLegLength', () => {
    const { result } = renderHook(() => useSparseSection());

    act(() => {
      result.current.handlers.setCornerLegLength(18);
    });

    expect(useDesignerStore.getState().params.sparseBase.cornerLegLength).toBe(18);
  });

  it('setEdgeSegmentLength updates edgeSegmentLength', () => {
    const { result } = renderHook(() => useSparseSection());

    act(() => {
      result.current.handlers.setEdgeSegmentLength(15);
    });

    expect(useDesignerStore.getState().params.sparseBase.edgeSegmentLength).toBe(15);
  });

  it('setCentralLength updates centralLength', () => {
    const { result } = renderHook(() => useSparseSection());

    act(() => {
      result.current.handlers.setCentralLength(24);
    });

    expect(useDesignerStore.getState().params.sparseBase.centralLength).toBe(24);
  });

  it('setLocatorBand updates locatorBand', () => {
    const { result } = renderHook(() => useSparseSection());

    act(() => {
      result.current.handlers.setLocatorBand(8);
    });

    expect(useDesignerStore.getState().params.sparseBase.locatorBand).toBe(8);
  });

  it('setExtraClearance updates extraClearance', () => {
    const { result } = renderHook(() => useSparseSection());

    act(() => {
      result.current.handlers.setExtraClearance(0.5);
    });

    expect(useDesignerStore.getState().params.sparseBase.extraClearance).toBe(0.5);
  });

  it('toggleEdgeLocators flips edgeLocators', () => {
    const { result } = renderHook(() => useSparseSection());

    expect(result.current.state.sparseBase.edgeLocators).toBe(true);

    act(() => {
      result.current.handlers.toggleEdgeLocators();
    });

    expect(useDesignerStore.getState().params.sparseBase.edgeLocators).toBe(false);
  });

  it('toggleCentralLocators flips centralLocators', () => {
    const { result } = renderHook(() => useSparseSection());

    expect(result.current.state.sparseBase.centralLocators).toBe(true);

    act(() => {
      result.current.handlers.toggleCentralLocators();
    });

    expect(useDesignerStore.getState().params.sparseBase.centralLocators).toBe(false);
  });

  it('no disabledReason when base is standard', () => {
    const { result } = renderHook(() => useSparseSection());

    expect(result.current.state.disabledReason).toBeUndefined();
  });

  it('disabledReason set when base style is flat', () => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, base: { ...DEFAULT_BIN_PARAMS.base, style: 'flat' } },
    });

    const { result } = renderHook(() => useSparseSection());

    expect(result.current.state.disabledReason).toBeDefined();
  });

  it('toggleSparseBase is a no-op when unavailable', () => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, base: { ...DEFAULT_BIN_PARAMS.base, style: 'flat' } },
    });

    const { result } = renderHook(() => useSparseSection());

    act(() => {
      result.current.handlers.toggleSparseBase();
    });

    expect(useDesignerStore.getState().params.sparseBase.enabled).toBe(false);
  });
});
