/**
 * Takeoff — drawing ingestion orchestration, view graph, grid backbone,
 * member-type registry (schedule reading), instance placement, BBS synthesis,
 * quantity fan-out. Populates the spine's register; owns no pricing.
 *
 * This file is the module's only public surface (ADR-0001).
 */
export {
  MAX_SOURCE_BYTES,
  drawingStatus,
  runIngestJob,
  uploadRevision,
  type IngestFidelity,
  type RevisionStatus,
  type Upload,
  type UploadInput,
} from "./ingestion";
export { CAD_TIMEOUT_MS, runCadIngest } from "./cad";
export {
  axisFamilies,
  georeferenceGrid,
  type AxisFamily,
  type GridAxis,
  type GridBackbone,
  type GridDeferral,
} from "./grid";
export {
  PLACEMENT_SHARES,
  REVISION_CARRY_SHARE,
  carryBounds,
  classWitnesses,
  isMemberMark,
  levelSlotOf,
  markFamilyOf,
  normalizeMark,
  placeInstances,
  placementDispositionCodes,
  type GridRef,
  type PlacedInstance,
  type PlacementDeferral,
  type PlacementDisposition,
  type PlacementDispositionCode,
  type ViewPlacement,
} from "./placement";
export {
  DEFAULT_TUNING,
  classifyCaption,
  mayYieldInstances,
  partitionViews,
  viewReasonCodes,
  viewTypes,
  type CaptionClass,
  type View,
  type ViewPartition,
  type ViewReason,
  type ViewReasonCode,
  type ViewTuning,
  type ViewType,
} from "./views";
