/**
 * The spine (ADR-0005): what every module builds on. Modules import from here; core never
 * imports a module (enforced by eslint.config.js).
 */
export { compareCanonical } from "./order";
export { entityGraphSchema, entitySchema, type Entity, type EntityGraph } from "./entitygraph";
export { forTenant, mintTenantCtx, runAsSystem, type TenantCtx, type Tx } from "./db";
export {
  callModel,
  fixtureTransport,
  proposalSchema,
  type ModelId,
  type ModelTransport,
  type Proposal,
  type Refusal,
  type SourceKey,
} from "./model";
