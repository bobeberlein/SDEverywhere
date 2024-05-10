// Copyright (c) 2024 Climate Interactive / New Venture Fund

import type { OutputVarId } from '../_shared'
import type { RunModelParams } from './run-model-params'

/**
 * This interface exposes the properties and functions that allow a `ModelRunner`
 * implementation to run a model that was generated by the SDEverywhere transpiler.
 * The `runModel` method will synchronously run the wrapped model with a provided
 * set of input and output parameters.
 *
 * @hidden This is not yet exposed in the public API; it is currently only used by
 * the implementations of the `RunnableModel` interface.
 */
export interface RunnableModel {
  /** The start time for the model (aka `INITIAL TIME`). */
  readonly startTime: number

  /** The end time for the model (aka `FINAL TIME`). */
  readonly endTime: number

  /** The frequency with which output values are saved (aka `SAVEPER`). */
  readonly saveFreq: number

  /** The number of save points for each output. */
  readonly numSavePoints: number

  /** The output variable IDs for this model. */
  readonly outputVarIds: OutputVarId[]

  /**
   * Run the model synchronously on the current thread.
   *
   * @param params The parameters that control the model run.
   */
  runModel(params: RunModelParams): void

  /**
   * Terminate the runner by releasing underlying resources (e.g., the worker thread or
   * Wasm module/buffers).
   */
  terminate(): void
}
