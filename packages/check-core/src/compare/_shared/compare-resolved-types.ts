// Copyright (c) 2023 Climate Interactive / New Venture Fund

import type { InputVar } from '../../bundle/var-types'
import type { InputPosition } from '../../_shared/scenario'
import type {
  CompareScenarioGroupId,
  CompareScenarioGroupName,
  CompareScenarioId,
  CompareViewGraphId,
  CompareViewGroupName,
  CompareViewName
} from './compare-spec-types'

//
// SCENARIOS
//

export interface CompareResolverUnknownInputError {
  kind: 'unknown-input'
}

export interface CompareResolverInvalidValueError {
  kind: 'invalid-value'
}

export type CompareResolverError = CompareResolverUnknownInputError | CompareResolverInvalidValueError

/** Describes the resolution state for a scenario input relative to a specific model. */
export interface CompareScenarioInputState {
  /** The matched input variable; can be undefined if no input matched. */
  inputVar?: InputVar
  /** The position of the input, if this is a position scenario. */
  position?: InputPosition
  /** The value of the input, for the given position or explicit value. */
  value?: number
  /** The error info if the input could not be resolved. */
  error?: CompareResolverError
}

/** A scenario input that has been checked against both "left" and "right" model. */
export interface CompareScenarioInput {
  /** The requested name of the input. */
  requestedName: string
  /** The resolved state of the input for the "left" model. */
  stateL: CompareScenarioInputState
  /** The resolved state of the input for the "right" model. */
  stateR: CompareScenarioInputState
}

/** A single resolved input scenario with all inputs set to a given position. */
export interface CompareScenarioWithAllInputs {
  kind: 'scenario-with-all-inputs'
  /** The unique identifier for the scenario. */
  id?: CompareScenarioId
  /** The scenario title. */
  title: string
  /** The scenario subtitle. */
  subtitle?: string
  /** The input position that will be applied to all available inputs. */
  position: InputPosition
}

/** A single resolved input scenario with a set of inputs. */
export interface CompareScenarioWithInputs {
  kind: 'scenario-with-inputs'
  /** The unique identifier for the scenario. */
  id?: CompareScenarioId
  /** The scenario title. */
  title: string
  /** The scenario subtitle. */
  subtitle?: string
  /** The resolutions for all inputs in the scenario. */
  resolvedInputs: CompareScenarioInput[]
}

/** A single resolved input scenario. */
export type CompareScenario = CompareScenarioWithAllInputs | CompareScenarioWithInputs

/** An unresolved input scenario reference. */
export interface CompareUnresolvedScenarioRef {
  kind: 'unresolved-scenario-ref'
  /** The ID of the referenced scenario that could not be resolved. */
  scenarioId: CompareScenarioId
}

//
// SCENARIO GROUPS
//

/** A resolved group of input scenarios. */
export interface CompareScenarioGroup {
  kind: 'scenario-group'
  /** The unique identifier for the group. */
  id?: CompareScenarioGroupId
  /** The name of the group. */
  name: CompareScenarioGroupName
  /**
   * The scenarios that are included in this group.  This includes scenario that were successfully
   * resolved as well as scenario references that could not be resolved.
   */
  scenarios: (CompareScenario | CompareUnresolvedScenarioRef)[]
}

/** An unresolved scenario group reference. */
export interface CompareUnresolvedScenarioGroupRef {
  kind: 'unresolved-scenario-group-ref'
  /** The ID of the referenced scenario group that could not be resolved. */
  scenarioGroupId: CompareScenarioGroupId
}

//
// VIEWS
//

/** A resolved view definition.  A view presents a set of graphs for a single input scenario. */
export interface CompareView {
  kind: 'view'
  /** The name of the view. */
  name: CompareViewName
  /** The resolved scenario to be shown in the view. */
  scenario: CompareScenario
  /** The graphs to be shown for each scenario view. */
  graphs: 'all' | CompareViewGraphId[]
}

/** An unresolved view. */
export interface CompareUnresolvedView {
  kind: 'unresolved-view'
  /** The requested name of the view, if provided. */
  name?: CompareViewName
  /** The ID of the referenced scenario that could not be resolved. */
  scenarioId?: CompareScenarioId
  /** The ID of the referenced scenario group that could not be resolved. */
  scenarioGroupId?: CompareScenarioGroupId
}

//
// VIEW GROUPS
//

/** A resolved group of compared scenario/graph views. */
export interface CompareViewGroup {
  kind: 'view-group'
  /** The name of the group of views. */
  name: CompareViewGroupName
  /** The array of resolved (and unresolved) views that are included in this group. */
  views: (CompareView | CompareUnresolvedView)[]
}

//
// TOP-LEVEL TYPES
//

export interface CompareResolvedItems {
  /** The set of resolved scenarios. */
  scenarios: CompareScenario[]
  /** The set of resolved scenario groups. */
  scenarioGroups: CompareScenarioGroup[]
  /** The set of resolved view groups. */
  viewGroups: CompareViewGroup[]
}
