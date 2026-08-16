/**
 * The spine (ADR-0005): what every module builds on. Modules import from here; core never
 * imports a module (enforced by eslint.config.js).
 */
export { compareCanonical } from "./order";
export {
  ACT_TYPES,
  BASES,
  DISCIPLINES,
  ELEMENT_TYPES,
  LEVEL_BASES,
  LEVEL_HEIGHT_BASES,
  REFUSED_SIGHTING_CAUSES,
  type ActType,
  type Basis,
  type Discipline,
  type ElementType,
  type LevelBasis,
  type LevelHeightBasis,
  type RefusedSightingCause,
} from "./enums";
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
