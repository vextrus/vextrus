/**
 * The spine (ADR-0005): what every module builds on. Modules import from here; core never
 * imports a module (enforced by eslint.config.js).
 */
export { compareCanonical } from "./order";
export {
  ACT_TYPES,
  BASES,
  CAMPAIGN_FRESHNESS_REFUSALS,
  CAMPAIGN_FRESHNESS_VERDICTS,
  CAMPAIGN_PINS,
  CAMPAIGN_STATES,
  DISCIPLINES,
  ELEMENT_TYPES,
  LEVEL_BASES,
  LEVEL_HEIGHT_BASES,
  MEASUREMENT_ALGEBRAS,
  QUANTITY_DIMENSIONS,
  QUANTITY_KINDS,
  REFUSED_SIGHTING_CAUSES,
  SI_UNITS,
  type ActType,
  type Basis,
  type CampaignFreshnessRefusal,
  type CampaignFreshnessVerdict,
  type CampaignPin,
  type CampaignState,
  type Discipline,
  type ElementType,
  type LevelBasis,
  type LevelHeightBasis,
  type MeasurementAlgebra,
  type QuantityDimension,
  type QuantityKind,
  type RefusedSightingCause,
  type SiUnit,
} from "./enums";
export {
  BEARS,
  BEARS_PAIRS,
  CATALOGUE_DIGEST,
  CATALOGUE_DIGEST_REFUSALS,
  KIND_ALGEBRA,
  KIND_AUTHORITATIVE_DISCIPLINE,
  KIND_NAMING_REFUSALS,
  UNBORNE_CAUSE,
  UNBORNE_ELEMENT_TYPES,
  bornKinds,
  catalogueDigest,
  kindNamingViolation,
  type BearingElementType,
  type BearsPair,
  type CatalogueDigestRefusal,
  type KindNamingRefusal,
  type KindNamingViolation,
  type UnborneElementType,
} from "./kinds";
export {
  DIMENSION_SI_UNIT,
  DOCUMENT_PRECISIONS,
  WORK_ITEM_CATALOGUE,
  type CatalogueDescription,
  type DocumentPrecision,
  type WorkItemCatalogueEntry,
} from "./work-items";
export { drawingSetRevisionDigest, type DrawingSetMember } from "./identity";
export {
  RULE_SET_EDITION_SCOPES,
  RULE_SET_PARAMETER_KEYS,
  RULE_SET_SEED_IDS,
  SEED_RULE_SET,
  SEED_RULE_SET_ID,
  ruleSetEditionKey,
  type RuleSetContent,
  type RuleSetEditionScope,
  type RuleSetMethod,
  type RuleSetParameter,
  type RuleSetParameterKey,
  type RuleSetSeedId,
} from "./rule-set";
export { forkProjectRuleSetEdition, mintTenantRuleSetTemplate, type RuleSetEditionRef } from "./rule-set-editions";
export { createProject, listProjects } from "./projects";
export {
  catalogueDigestInForce,
  catalogueInForce,
  openCampaign,
  pinCampaign,
  type Campaign,
  type OpenCampaignInput,
} from "./campaigns";
export {
  campaignFreshness,
  campaignFreshnessOf,
  type CampaignFreshness,
  type CampaignPins,
} from "./freshness";
export { entityGraphSchema, entitySchema, type Entity, type EntityGraph } from "./entitygraph";
export { forTenant, mintTenantCtx, runAsSystem, type TenantCtx, type Tx } from "./db";
export {
  callModel,
  fixtureTransport,
  liveTransport,
  proposalSchema,
  recordFixture,
  type ModelId,
  type ModelTransport,
  type Proposal,
  type Refusal,
  type SourceKey,
} from "./model";
export { dbRecorder } from "./model-ledger";
