/**
 * Sparse base builder.
 *
 * Replaces the solid socket underside with a minimal locator lattice: corner
 * L-legs (always present) plus optional edge-midpoint segments and central
 * cross clusters at interior 1u-grid junctions. Unlike the lightweight base
 * (which shells each foot), the floor itself stays solid — only the socket's
 * underside material is trimmed, keeping just enough of the taper profile to
 * register on a standard baseplate.
 *
 * Construction: build the full per-cell feet (shrunk by `extraClearance` on
 * top of the standard `CLEARANCE`), fuse them into one solid, then intersect
 * that solid with a single global union of axis-aligned "keep" prisms (corner
 * L's, edge segments, central crosses). Every keep prism spans the full
 * socket depth padded by `COPLANAR_MARGIN` top and bottom, so the intersect
 * never produces a face coplanar with the foot's own Z=0 / Z=-SOCKET_HEIGHT
 * faces. Perimeter prisms (corners, edges) are additionally anchored to the
 * shrunk foot's own outer edge — not the raw grid envelope — and pad
 * `COPLANAR_MARGIN` past it in XY too, so their outward face is never
 * coplanar with the foot's own outer face. The central cross arms need no
 * such XY padding: they span the inter-foot gap and reach into all 4
 * neighboring feet, so they never sit flush against a foot's own boundary.
 *
 * The keep-prism union must be built globally (all corners/edges/crosses
 * fused together) and intersected once against the whole feet union — a
 * central cross at a 4-cell junction straddles four separate feet by
 * construction, so it can't be resolved with a per-cell intersect.
 *
 * Coordinate system matches the socket: Z=0 top (mates with body),
 * Z=-SOCKET_HEIGHT bottom. XY-centered on the bin footprint.
 */

import { box, unwrap, fuseAll, intersect, translate, withScope } from 'brepjs';
import type { Shape3D, ValidSolid, DisposalScope } from 'brepjs';
import { SIZE, CLEARANCE, SOCKET_HEIGHT, COPLANAR_MARGIN } from './generatorConstants';
import { resolvePitch, pitchKeySegments, type GridUnitInput } from './gridPitch';
import {
  buildSingleCellSocket,
  buildSimplifiedCellSocket,
  forEachSocketCell,
  DEFAULT_FRACTIONAL_EDGE,
  type FractionalEdge,
} from './socketBuilder';
import { hashMask, isPartialMask, isRegionFilled, type CellMask } from '@/shared/utils/cellMask';
import { buildCacheKey, compactKey, quantize } from './cacheKeyUtils';
import type { SparseBaseConfig } from '@/shared/types/bin';

/** Corner sign combinations `[sx, sy]` — bottom-left, bottom-right, top-left, top-right. */
const CORNER_SIGNS: ReadonlyArray<readonly [number, number]> = [
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1],
];

/**
 * Build the sparse-locator base for a bin footprint.
 *
 * @param forExport Full 5-section foot profile when true; simplified for preview.
 */
export function buildSparseBase(
  gridW: number,
  gridD: number,
  cfg: SparseBaseConfig,
  forExport = false,
  halfSockets = false,
  gridUnitMm: GridUnitInput = SIZE,
  cellMask?: CellMask,
  fractionalEdge: FractionalEdge = DEFAULT_FRACTIONAL_EDGE
): Shape3D {
  const usingMask = isPartialMask(cellMask);
  // Per-axis pitch: unitX scales width/columns, unitY scales depth/rows.
  const { x: unitX, y: unitY } = resolvePitch(gridUnitMm);
  const cellInMask = (
    centerX: number,
    centerY: number,
    wUnits: number,
    dUnits: number
  ): boolean => {
    if (!usingMask) return true;
    const totalW_mm = gridW * unitX;
    const totalD_mm = gridD * unitY;
    const leftUnit = (centerX + totalW_mm / 2 - (wUnits * unitX) / 2) / unitX;
    const bottomUnit = (centerY + totalD_mm / 2 - (dUnits * unitY) / 2) / unitY;
    return isRegionFilled(cellMask, leftUnit, bottomUnit, wUnits, dUnits);
  };

  return withScope((scope: DisposalScope): Shape3D => {
    const buildFoot = (w: number, d: number): Shape3D =>
      forExport ? buildSingleCellSocket(w, d) : buildSimplifiedCellSocket(w, d);

    const feet: Shape3D[] = [];
    forEachSocketCell(
      gridW,
      gridD,
      cellMask,
      gridUnitMm,
      halfSockets,
      (cell) => {
        if (!cellInMask(cell.centerX, cell.centerY, cell.widthUnits, cell.depthUnits)) return;
        const cellW_mm = cell.widthUnits * unitX - CLEARANCE - 2 * cfg.extraClearance;
        const cellD_mm = cell.depthUnits * unitY - CLEARANCE - 2 * cfg.extraClearance;
        // extraClearance too large for this cell — drop the foot rather than
        // emit a degenerate sliver (mirrors the lightweight base's inner-foot guard).
        if (cellW_mm <= 0.2 || cellD_mm <= 0.2) return;
        feet.push(
          translate(scope.register(buildFoot(cellW_mm, cellD_mm)), [cell.centerX, cell.centerY, 0])
        );
      },
      fractionalEdge
    );

    if (feet.length === 0) {
      throw new Error('Sparse base: at least one cell required');
    }

    const base = unwrap(fuseAll(feet as ValidSolid[], { optimisation: 'commonFace' }));
    for (const f of feet) if (f !== base) f.delete();

    // Perimeter keep prisms anchor to the SHRUNK FOOT's own outer edge, not
    // the raw grid envelope. `footInset` is the fixed per-side gap between
    // the nominal grid boundary and a border foot's actual outer face —
    // CLEARANCE is subtracted once from the whole cell (so CLEARANCE/2 per
    // side) and extraClearance is subtracted twice (so extraClearance per
    // side). It doesn't scale with a cell's widthUnits/depthUnits, so it's
    // the same inset for a full, half-socket, or fractional border cell.
    const totalW = gridW * unitX;
    const totalD = gridD * unitY;
    const footInset = CLEARANCE / 2 + cfg.extraClearance;
    const xOut = totalW / 2 - footInset;
    const yOut = totalD / 2 - footInset;
    const H = SOCKET_HEIGHT + 2 * COPLANAR_MARGIN;
    const cz = -SOCKET_HEIGHT / 2;
    const keepPrisms: ValidSolid[] = [];

    // Center + full length of a perimeter band along one axis: `reach`
    // inward from the foot's outer edge (`out`, on the `sign` side),
    // extended `COPLANAR_MARGIN` outward past it so the prism's outward face
    // never lands coplanar with the foot's own outer face.
    const bandLen = (reach: number): number => reach + COPLANAR_MARGIN;
    const bandCenter = (sign: number, out: number, reach: number): number =>
      sign * (out + (COPLANAR_MARGIN - reach) / 2);

    // Corner L's — always built, one per foot-outer-edge corner: two
    // overlapping legs (hugging the Y edge and the X edge) meeting inward
    // from the corner.
    for (const [sx, sy] of CORNER_SIGNS) {
      // Horizontal leg — hugs the Y edge, reaches inward along X.
      keepPrisms.push(
        scope.register(
          box(bandLen(cfg.cornerLegLength), bandLen(cfg.locatorBand), H, {
            at: [
              bandCenter(sx, xOut, cfg.cornerLegLength),
              bandCenter(sy, yOut, cfg.locatorBand),
              cz,
            ],
          })
        )
      );
      // Vertical leg — hugs the X edge, reaches inward along Y.
      keepPrisms.push(
        scope.register(
          box(bandLen(cfg.locatorBand), bandLen(cfg.cornerLegLength), H, {
            at: [
              bandCenter(sx, xOut, cfg.locatorBand),
              bandCenter(sy, yOut, cfg.cornerLegLength),
              cz,
            ],
          })
        )
      );
    }

    // Edge-midpoint locators — skipped on a single-cell grid, where they'd be
    // redundant with the corner L's.
    if (cfg.edgeLocators && !(gridW === 1 && gridD === 1)) {
      for (const sx of [-1, 1] as const) {
        keepPrisms.push(
          scope.register(
            box(bandLen(cfg.locatorBand), cfg.edgeSegmentLength, H, {
              at: [bandCenter(sx, xOut, cfg.locatorBand), 0, cz],
            })
          )
        );
      }
      for (const sy of [-1, 1] as const) {
        keepPrisms.push(
          scope.register(
            box(cfg.edgeSegmentLength, bandLen(cfg.locatorBand), H, {
              at: [0, bandCenter(sy, yOut, cfg.locatorBand), cz],
            })
          )
        );
      }
    }

    // Central cross clusters at interior 1u-grid junctions — arms centered
    // exactly on the junction (no outward XY padding: they span the
    // inter-foot gap, not a foot's own outer edge), gated to junctions whose
    // 4 surrounding unit cells are all present in the mask.
    if (cfg.centralLocators) {
      const junctionFilled = (k: number, l: number): boolean =>
        !usingMask || isRegionFilled(cellMask, k - 1, l - 1, 2, 2);
      const colsInterior = Math.floor(gridW) - 1;
      const rowsInterior = Math.floor(gridD) - 1;
      for (let k = 1; k <= colsInterior; k++) {
        for (let l = 1; l <= rowsInterior; l++) {
          if (!junctionFilled(k, l)) continue;
          const jx = k * unitX - totalW / 2;
          const jy = l * unitY - totalD / 2;
          keepPrisms.push(
            scope.register(box(cfg.centralLength, cfg.locatorBand, H, { at: [jx, jy, cz] }))
          );
          keepPrisms.push(
            scope.register(box(cfg.locatorBand, cfg.centralLength, H, { at: [jx, jy, cz] }))
          );
        }
      }
    }

    // Degenerate (should not happen — corner L's are unconditional): keep the
    // whole solid foot rather than intersect against nothing.
    if (keepPrisms.length === 0) return base;

    const keepUnion = unwrap(fuseAll(keepPrisms, { optimisation: 'commonFace' }));
    for (const p of keepPrisms) if (p !== keepUnion) p.delete();

    try {
      const carved = unwrap(intersect(base, keepUnion));
      if (carved !== base) base.delete();
      if (carved !== keepUnion) keepUnion.delete();
      return carved;
    } catch {
      // Kernel failure on the carve — fall back to the solid full-feet base
      // rather than sinking the whole build.
      if (keepUnion !== base) keepUnion.delete();
      return base;
    }
  });
}

/**
 * Cache key for the sparse base shape produced by {@link buildSparseBase}.
 *
 * No `forExport` segment: the pipeline always calls `buildSparseBase` with
 * `forExport: true` (the full 5-section profile), so it isn't a varying
 * dimension in practice.
 */
export function sparseBaseShapeKey(
  gridW: number,
  gridD: number,
  cfg: SparseBaseConfig,
  halfSockets: boolean,
  gridUnitMm: GridUnitInput,
  cellMask?: CellMask,
  fractionalEdge: FractionalEdge = DEFAULT_FRACTIONAL_EDGE
): string {
  const usingMask = isPartialMask(cellMask);
  const pitch = resolvePitch(gridUnitMm);
  return compactKey(
    buildCacheKey(
      'sparse-base-v1',
      quantize(gridW),
      quantize(gridD),
      quantize(pitch.x),
      ...pitchKeySegments(pitch, quantize),
      halfSockets,
      usingMask ? hashMask(cellMask) : 'rect',
      fractionalEdge.x,
      fractionalEdge.y,
      cfg.enabled,
      quantize(cfg.cornerLegLength),
      cfg.edgeLocators,
      quantize(cfg.edgeSegmentLength),
      cfg.centralLocators,
      quantize(cfg.centralLength),
      quantize(cfg.locatorBand),
      quantize(cfg.extraClearance)
    )
  );
}
