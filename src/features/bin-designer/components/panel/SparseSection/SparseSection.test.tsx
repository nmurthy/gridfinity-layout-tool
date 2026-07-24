import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SparseSection } from './SparseSection';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS, DEFAULT_UI_STATE } from '@/features/bin-designer/constants';

describe('SparseSection', () => {
  beforeEach(() => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS },
      ui: { ...DEFAULT_UI_STATE },
    });
  });

  it('renders the sparse base toggle', () => {
    render(<SparseSection />);
    expect(screen.getByText('Sparse base')).toBeDefined();
  });

  it('shows the tuning sliders and sub-toggles when enabled', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        sparseBase: { ...DEFAULT_BIN_PARAMS.sparseBase, enabled: true },
      },
    });

    render(<SparseSection />);
    expect(screen.getByText('Corner leg length')).toBeDefined();
    expect(screen.getByText('Edge segment length')).toBeDefined();
    expect(screen.getByText('Central cross length')).toBeDefined();
    expect(screen.getByText('Locator band width')).toBeDefined();
    expect(screen.getByText('Extra clearance')).toBeDefined();
    expect(screen.getByText('Edge locators')).toBeDefined();
    expect(screen.getByText('Central locators')).toBeDefined();
  });

  it('shows disabled reason for a flat base', () => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, base: { ...DEFAULT_BIN_PARAMS.base, style: 'flat' } },
    });

    render(<SparseSection />);
    expect(screen.getByText(/Cannot combine|Flat base/)).toBeDefined();
  });
});
