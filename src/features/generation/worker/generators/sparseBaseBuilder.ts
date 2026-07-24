/**
 * Sparse base builder.
 *
 * Replaces the solid socket underside with a minimal locator lattice: corner
 * L-legs (always present) plus optional edge-midpoint segments and central
 * cross clusters at interior 1u-grid junctions, plus an optional uniform
 * coverage-density fill grid. Unlike the lightweight base (which shells each
 * foot), the floor itself stays solid — only the socket's underside material
 * is trimmed, keeping just enough of the taper profile to register on a
 * standard baseplate.
 *
 * Construction: build the full per-cell feet (shrunk by `extraClearance` on
 * top of the standard `CLEARANCE`), fuse them into one solid, then intersect
 * that solid with a single global union of "keep" prisms (corner L's, edge
 * segments, central crosses, coverage-grid squares). Every keep prism is a
 * frustum, not a vertical box: its top rectangle (at Z≈0) is wider than its
 * bottom rectangle (at Z≈-SOCKET_HEIGHT) by `FLARE_REACH` on every side, so
 * the loft's side walls slope outward at (approximately) 45° as they rise.
 * Bins print feet-down, so a flat Z=0 floor bridging the gap between two
 * locators is an unsupported horizontal span — droop. Flaring every locator
 * outward as it approaches Z=0 turns each gap-facing wall into a ≤45°
 * self-supporting ramp instead, and where two opposing flares meet, the
 * floor above is continuously supported rather than bridged. Growing a
 * keep-prism's footprint is always safe even where it overshoots a foot's
 * true boundary: the single global `intersect` against the true foot union
 * clips the overgrowth back to the foot, so only the gap-facing ramps
 * survive and a locator's own registration on the foot's outer taper is
 * unaffected.
 *
 * Every keep prism still spans the full socket depth padded by
 * `COPLANAR_MARGIN` top and bottom, so the intersect never produces a face
 * coplanar with the foot's own Z=0 / Z=-SOCKET_HEIGHT faces. Perimeter
 * prisms (corners, edges) are additionally anchored to the shrunk foot's own
 * outer edge — not the raw grid envelope — and pad `COPLANAR_MARGIN` past it
 * in XY too (at the *bottom* rectangle; the flare grows from there), so
 * their outward face is never coplanar with the foot's own outer face. The
 * central cross arms and coverage-grid squares need no such XY padding: they
 * sit away from any single foot's own boundary by construction (a junction
 * cross straddles 4 feet; a grid square's pitch is chosen not to line up
 * with the foot pitch), so they never sit flush against a foot's own
 * boundary.
 *
 * The keep-prism union must be built globally (all corners/edges/crosses/grid
 * squares fused together) and intersected once against the whole feet union
 * — a central cross at a 4-cell junction straddles four separate feet by
 * construction, so it can't be resolved with a per-cell intersect.
 *
 * The coverage-density grid (`cfg.locatorCoverage`, 0–100%) is an additional,
 * purely additive lattice of flared square locators stepped across the whole
 * envelope at a coverage-controlled pitch — denser coverage packs locators
 * (and therefore self-supporting ramps) more tightly, independent of the
 * fixed corner/edge/central pattern above.
 *
 * Coordinate system matches the socket: Z=0 top (mates with body),
 * Z=-SOCKET_HEIGHT bottom. XY-centered on the bin footprint.
 */

import {
  box,
  drawRectangle,
  unwrap,
  fuseAll,
  intersect,
  translate,
  clone,
  withScope,
} from 'brepjs';
import type { Shape3D, ValidSolid, Sketch, DisposalScope } from 'brepjs';
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
 * Lateral spread (mm) a flared keep-prism's top rectangle grows past its
 * bottom rectangle, on every side. Equal to `SOCKET_HEIGHT` (5mm) so a wall
 * rising the full socket depth grows 5mm outward over that same 5mm rise —
 * a true 45° flare, closing gaps up to 2×5=10mm between opposing locators.
 * (The Z padding each prism adds past the real socket depth for coplanarity
 * safety, see `COPLANAR_MARGIN`, rides along on the same loft and only makes
 * the wall a little shallower than 45° — strictly safer, never a droop
 * risk.) Tried and kept at the full 5mm: it didn't add excessive volume in
 * testing, and a smaller cap would leave wider gaps unsupported.
 */
const FLARE_REACH = SOCKET_HEIGHT;

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
    const keepPrisms: Shape3D[] = [];

    // Center + full length of a perimeter band along one axis: `reach`
    // inward from the foot's outer edge (`out`, on the `sign` side),
    // extended `COPLANAR_MARGIN` outward past it so the prism's outward face
    // never lands coplanar with the foot's own outer face. This is the
    // BOTTOM-rectangle footprint the flare then grows outward from.
    const bandLen = (reach: number): number => reach + COPLANAR_MARGIN;
    const bandCenter = (sign: number, out: number, reach: number): number =>
      sign * (out + (COPLANAR_MARGIN - reach) / 2);

    // Flared-prism templates, keyed by quantized (wBottom, dBottom): every
    // corner leg / edge segment / central arm / coverage-grid square repeats
    // its exact footprint size across several positions (all 4 corners share
    // 2 sizes; every interior junction shares the same 2 central-arm sizes;
    // every coverage-grid square shares 1 size), so lofting once and cloning
    // per position turns what would be dozens-to-hundreds of ThruSections
    // calls into a handful, mirroring `getCellSocketTemplate` in socketBuilder.
    const flareTemplates = new Map<string, Shape3D>();
    const flaredTemplate = (wBottom: number, dBottom: number): Shape3D => {
      const key = `${quantize(wBottom)}x${quantize(dBottom)}`;
      const cached = flareTemplates.get(key);
      if (cached) return cached;
      const zBot = -SOCKET_HEIGHT - COPLANAR_MARGIN;
      const zTop = COPLANAR_MARGIN;
      const bottomSketch = drawRectangle(wBottom, dBottom).sketchOnPlane('XY', zBot) as Sketch;
      const topSketch = drawRectangle(
        wBottom + 2 * FLARE_REACH,
        dBottom + 2 * FLARE_REACH
      ).sketchOnPlane('XY', zTop) as Sketch;
      const frustum = scope.register(bottomSketch.loftWith(topSketch, { ruled: true }));
      flareTemplates.set(key, frustum);
      return frustum;
    };

    // Build one 45°-flared keep-prism centered at `(cx, cy)`: bottom
    // rectangle `wBottom × dBottom` (the footprint the old vertical box
    // prism used), top rectangle grown by `FLARE_REACH` on every side,
    // spanning the same padded Z range the box prisms did.
    const flaredPrism = (cx: number, cy: number, wBottom: number, dBottom: number): Shape3D =>
      translate(scope.register(unwrap(clone(flaredTemplate(wBottom, dBottom)))), [cx, cy, 0]);

    // Corner L's — always built, one per foot-outer-edge corner: two
    // overlapping legs (hugging the Y edge and the X edge) meeting inward
    // from the corner.
    for (const [sx, sy] of CORNER_SIGNS) {
      // Horizontal leg — hugs the Y edge, reaches inward along X.
      keepPrisms.push(
        flaredPrism(
          bandCenter(sx, xOut, cfg.cornerLegLength),
          bandCenter(sy, yOut, cfg.locatorBand),
          bandLen(cfg.cornerLegLength),
          bandLen(cfg.locatorBand)
        )
      );
      // Vertical leg — hugs the X edge, reaches inward along Y.
      keepPrisms.push(
        flaredPrism(
          bandCenter(sx, xOut, cfg.locatorBand),
          bandCenter(sy, yOut, cfg.cornerLegLength),
          bandLen(cfg.locatorBand),
          bandLen(cfg.cornerLegLength)
        )
      );
    }

    // Edge-midpoint locators — skipped on a single-cell grid, where they'd be
    // redundant with the corner L's.
    if (cfg.edgeLocators && !(gridW === 1 && gridD === 1)) {
      for (const sx of [-1, 1] as const) {
        keepPrisms.push(
          flaredPrism(
            bandCenter(sx, xOut, cfg.locatorBand),
            0,
            bandLen(cfg.locatorBand),
            cfg.edgeSegmentLength
          )
        );
      }
      for (const sy of [-1, 1] as const) {
        keepPrisms.push(
          flaredPrism(
            0,
            bandCenter(sy, yOut, cfg.locatorBand),
            cfg.edgeSegmentLength,
            bandLen(cfg.locatorBand)
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
          keepPrisms.push(flaredPrism(jx, jy, cfg.centralLength, cfg.locatorBand));
          keepPrisms.push(flaredPrism(jx, jy, cfg.locatorBand, cfg.centralLength));
        }
      }
    }

    // Coverage-density fill — a single continuous solid "web" spanning the
    // whole footprint that keeps the top `webThickness` of every foot, on top
    // of the sparse locators. Because it is continuous it FULLY SUPPORTS THE
    // BIN FLOOR (no floor droop) at any coverage that yields a printable web,
    // and it scales smoothly from nothing (0% → just the flared locators, max
    // savings) to the full foot depth (100% → the socket is solid feet again,
    // fully covered). It is one box intersected with the feet, so it stays
    // cheap regardless of bin size — unlike a discrete lattice it can reach full
    // coverage without a boolean blow-up. The web's own underside (between the
    // locators, deep inside the socket) is the only face left bridging; the 45°
    // flares shorten it and it faces the baseplate, hidden. The web box spans
    // Z ∈ [−webThickness, +COPLANAR_MARGIN] so its top clears the foot's Z=0
    // face (never coplanar) and its bottom cuts a clean web-underside plane.
    if (cfg.locatorCoverage > 0) {
      const webThickness = (cfg.locatorCoverage / 100) * SOCKET_HEIGHT;
      keepPrisms.push(
        scope.register(
          box(
            totalW + 2 * COPLANAR_MARGIN,
            totalD + 2 * COPLANAR_MARGIN,
            webThickness + COPLANAR_MARGIN,
            { at: [0, 0, (COPLANAR_MARGIN - webThickness) / 2] }
          )
        )
      );
    }

    // Degenerate (should not happen — corner L's are unconditional): keep the
    // whole solid foot rather than intersect against nothing.
    if (keepPrisms.length === 0) return base;

    const keepUnion = unwrap(fuseAll(keepPrisms as ValidSolid[], { optimisation: 'commonFace' }));
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
      quantize(cfg.extraClearance),
      quantize(cfg.locatorCoverage)
    )
  );
}
