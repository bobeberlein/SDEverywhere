import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { readXlsx, resetHelperState } from '../_shared/helpers'
import { resetSubscriptsAndDimensions } from '../_shared/subscript'

import Model from '../model/model'

import { parseInlineVensimModel } from '../_tests/test-support'
import { generateJS } from './gen-code-js'

type ExtData = Map<string, Map<number, number>>
type DirectDataSpec = Map<string, string>

function readInlineModelAndGenerateJS(
  mdlContent: string,
  opts?: {
    modelDir?: string
    extData?: ExtData
    directDataSpec?: DirectDataSpec
    inputVarNames?: string[]
    outputVarNames?: string[]
  }
): string {
  // XXX: These steps are needed due to subs/dims and variables being in module-level storage
  resetHelperState()
  resetSubscriptsAndDimensions()
  Model.resetModelState()

  let spec
  if (opts?.inputVarNames || opts?.outputVarNames) {
    spec = {
      inputVarNames: opts?.inputVarNames || [],
      outputVarNames: opts?.outputVarNames || []
    }
  } else {
    spec = {}
  }

  const directData = new Map()
  if (opts?.modelDir && opts?.directDataSpec) {
    for (const [file, xlsxFilename] of opts.directDataSpec.entries()) {
      const xlsxPath = path.join(opts.modelDir, xlsxFilename)
      directData.set(file, readXlsx(xlsxPath))
    }
  }

  const parsedModel = parseInlineVensimModel(mdlContent, opts?.modelDir)
  return generateJS(parsedModel, {
    spec,
    operations: ['generateJS'],
    extData: opts?.extData,
    directData,
    modelDirname: opts?.modelDir
  })
}

// Note: This should be kept in sync with the code that is generated
// by `generateJS` and also with the "real" `JsModel` interface that
// is exported by the runtime package.
interface JsModel {
  getInitialTime(): number
  getFinalTime(): number
  getTimeStep(): number
  getSaveFreq(): number

  getModelFunctions(): /*JsModelFunctions*/ any
  setModelFunctions(functions: /*JsModelFunctions*/ any): void

  setTime(time: number): void

  setInputs(inputValue: (index: number) => number): void

  getOutputVarIds(): string[]
  getOutputVarNames(): string[]
  storeOutputs(storeValue: (value: number) => void): void

  initConstants(): void
  initLevels(): void
  evalAux(): void
  evalLevels(): void
}

async function initJsModel(generatedJsCode: string): Promise<JsModel> {
  const dataUri = 'data:text/javascript;charset=utf-8,' + encodeURIComponent(generatedJsCode)
  const module = await import(dataUri)
  // console.log(module)
  return (await module.default()) as JsModel
}

// Note: This function roughly matches the "real" code in the runtime package
// that runs a generated JS model.  It is implemented here so that we can exercise
// the generated code in tests without pulling in the runtime package.
function runJsModel(model: JsModel, inputs: number[], outputs: number[]) {
  // TODO
  const useOutputIndices = false

  // Configure the functions (this can be an empty object for the purposes
  // of this test)
  model.setModelFunctions({})

  // Get the control variable values.  Once the first 4 control variables are known,
  // we can compute `numSavePoints` here.
  const initialTime = model.getInitialTime()
  const finalTime = model.getFinalTime()
  const timeStep = model.getTimeStep()
  const saveFreq = model.getSaveFreq()
  const numSavePoints = Math.round((finalTime - initialTime) / saveFreq) + 1

  // Initialize time with the required `INITIAL TIME` control variable
  let time = initialTime
  model.setTime(time)

  // Set the user-defined input values.  This needs to happen after `initConstants`
  // since the input values will override the default constant values.
  model.setInputs(index => inputs[index])

  // Initialize level variables
  model.initLevels()

  // Set up a run loop using a fixed number of time steps
  let savePointIndex = 0
  let outputVarIndex = 0
  const lastStep = Math.round((finalTime - initialTime) / timeStep)
  let step = 0
  while (step <= lastStep) {
    // Evaluate aux variables
    model.evalAux()

    if (time % saveFreq < 1e-6) {
      outputVarIndex = 0
      if (useOutputIndices) {
        throw new Error('Not yet implemented')
      } else {
        // Store the normal outputs
        model.storeOutputs(value => {
          // Write each value into the preallocated buffer; each variable has a "row" that
          // contains `numSavePoints` values, one value for each save point
          const outputBufferIndex = outputVarIndex * numSavePoints + savePointIndex
          outputs[outputBufferIndex] = value
          outputVarIndex++
        })
      }
      savePointIndex++
    }

    if (step == lastStep) {
      // This is the last step, so we are done
      break
    }

    // Propagate levels for the next time step
    model.evalLevels()

    // Advance time by one step
    time += timeStep
    model.setTime(time)
    step++
  }
}

describe('generateJS (Vensim -> JS)', () => {
  it('should generate code for a simple model', () => {
    const mdl = `
      input = 1 ~~|
      x = input ~~|
      y = :NOT: x ~~|
      z = ABS(y) ~~|
      w = WITH LOOKUP(x, ( [(0,0)-(2,2)], (0,0),(0.1,0.01),(0.5,0.7),(1,1),(1.5,1.2),(2,1.3) )) ~~|
    `
    const code = readInlineModelAndGenerateJS(mdl, {
      inputVarNames: ['input'],
      outputVarNames: ['x', 'y', 'z', 'w']
    })
    expect(code).toEqual(`\
// Model variables
let __lookup1;
let _input;
let _w;
let _x;
let _y;
let _z;

// Array dimensions


// Dimension mappings


// Lookup data arrays
const __lookup1_data_ = [0.0, 0.0, 0.1, 0.01, 0.5, 0.7, 1.0, 1.0, 1.5, 1.2, 2.0, 1.3];


// Time variable
let _time;
/*export*/ function setTime(time) {
  _time = time;
}

// Control variables
let controlParamsInitialized = false;
function initControlParamsIfNeeded() {
  if (controlParamsInitialized) {
    return;
  }

  if (fns === undefined) {
    throw new Error('Must call setModelFunctions() before running the model');
  }

  // We currently require INITIAL TIME, FINAL TIME, and TIME STEP to be
  // defined as constant values.  Some models may define SAVEPER in terms
  // of TIME STEP, which means that the compiler may treat it as an aux,
  // not as a constant.  We call initConstants() to ensure that we have
  // initial values for these control parameters.
  initConstants();
  if (_initial_time === undefined) {
    throw new Error('INITIAL TIME must be defined as a constant value');
  }
  if (_final_time === undefined) {
    throw new Error('FINAL TIME must be defined as a constant value');
  }
  if (_time_step === undefined) {
    throw new Error('TIME STEP must be defined as a constant value');
  }

  if (_saveper === undefined) {
    // If _saveper is undefined after calling initConstants(), it means it
    // is defined as an aux, in which case we perform an initial step of
    // the run loop in order to initialize that value.  First, set the
    // time and initial function context.
    setTime(_initial_time);
    fns.setContext({
      initialTime: _initial_time,
      finalTime: _final_time,
      timeStep: _time_step,
      currentTime: _time
    });

    // Perform initial step to initialize _saveper
    initLevels();
    evalAux();
    if (_saveper === undefined) {
      throw new Error('SAVEPER must be defined');
    }
  }

  controlParamsInitialized = true;
}
/*export*/ function getInitialTime() {
  initControlParamsIfNeeded();
  return _initial_time;
}
/*export*/ function getFinalTime() {
  initControlParamsIfNeeded();
  return _final_time;
}
/*export*/ function getTimeStep() {
  initControlParamsIfNeeded();
  return _time_step;
}
/*export*/ function getSaveFreq() {
  initControlParamsIfNeeded();
  return _saveper;
}

// Model functions
let fns;
/*export*/ function getModelFunctions() {
  return fns;
}
/*export*/ function setModelFunctions(functions /*: JsModelFunctions*/) {
  fns = functions;
}

// Internal helper functions
function multiDimArray(dimLengths) {
  if (dimLengths.length > 0) {
    const len = dimLengths[0]
    const arr = new Array(len)
    for (let i = 0; i < len; i++) {
      arr[i] = multiDimArray(dimLengths.slice(1))
    }
    return arr
  } else {
    return 0
  }
}

// Internal constants
const _NA_ = -Number.MAX_VALUE;

// Internal state
let lookups_initialized = false;
let data_initialized = false;

function initLookups0() {
  __lookup1 = fns.createLookup(6, __lookup1_data_);
}

function initLookups() {
  // Initialize lookups
  if (!lookups_initialized) {
    initLookups0();
    lookups_initialized = true;
  }
}

function initData() {
  // Initialize data
  if (!data_initialized) {
    data_initialized = true;
  }
}

function initConstants0() {
  // input = 1
  _input = 1.0;
}

/*export*/ function initConstants() {
  // Initialize constants
  initConstants0();
  initLookups();
  initData();
}

/*export*/ function initLevels() {
  // Initialize variables with initialization values, such as levels, and the variables they depend on
}

function evalAux0() {
  // x = input
  _x = _input;
  // w = WITH LOOKUP(x,([(0,0)-(2,2)],(0,0),(0.1,0.01),(0.5,0.7),(1,1),(1.5,1.2),(2,1.3)))
  _w = fns.WITH_LOOKUP(_x, __lookup1);
  // y = :NOT: x
  _y = !_x;
  // z = ABS(y)
  _z = fns.ABS(_y);
}

/*export*/ function evalAux() {
  // Evaluate auxiliaries in order from the bottom up
  evalAux0();
}

/*export*/ function evalLevels() {
  // Evaluate levels
}

/*export*/ function setInputs(valueAtIndex /*: (index: number) => number*/) {
  _input = valueAtIndex(0);
}

/*export*/ function getOutputVarIds() {
  return [
    '_x',
    '_y',
    '_z',
    '_w'
  ]
}

/*export*/ function getOutputVarNames() {
  return [
    'x',
    'y',
    'z',
    'w'
  ]
}

/*export*/ function storeOutputs(storeValue /*: (value: number) => void*/) {
  storeValue(_x);
  storeValue(_y);
  storeValue(_z);
  storeValue(_w);
}

/*export*/ function storeOutput(varIndex, subIndex0, subIndex1, subIndex2, storeValue /*: (value: number) => void*/) {
  switch (varIndex) {
    case 1:
      storeValue(_input);
      break;
    case 2:
      storeValue(_x);
      break;
    case 3:
      storeValue(_w);
      break;
    case 4:
      storeValue(_y);
      break;
    case 5:
      storeValue(_z);
      break;
    default:
      break;
  }
}

export default async function () {
  return {
    getInitialTime,
    getFinalTime,
    getTimeStep,
    getSaveFreq,

    getModelFunctions,
    setModelFunctions,

    setTime,

    setInputs,

    getOutputVarIds,
    getOutputVarNames,
    storeOutputs,

    initConstants,
    initLevels,
    evalAux,
    evalLevels
  }
}
`)
  })

  it('should generate a model that can be run', async () => {
    // TODO: Change this test to call each exported function

    const initialTime = 2000
    const finalTime = 2002
    const numSavePoints = finalTime - initialTime + 1
    const mdl = `
      x = TIME ~~|
      y = x + 1 ~~|
      INITIAL TIME = ${initialTime} ~~|
      FINAL TIME = ${finalTime} ~~|
      TIME STEP = 1 ~~|
      SAVEPER = 1 ~~|
    `
    const outputVarNames = ['x', 'y']
    const code = readInlineModelAndGenerateJS(mdl, {
      inputVarNames: [],
      outputVarNames
    })
    const jsModel = await initJsModel(code)
    const inputs: number[] = []
    const outputs: number[] = Array(outputVarNames.length * numSavePoints)
    runJsModel(jsModel, inputs, outputs)
    expect(outputs).toEqual([
      // x values
      2000, 2001, 2002,
      // y values
      2001, 2002, 2003
    ])
  })

  it('should work when valid input variable name without subscript is provided in spec file', () => {
    const mdl = `
      x = 10 ~~|
      y = x + 1 ~~|
    `
    const code = readInlineModelAndGenerateJS(mdl, {
      inputVarNames: ['x'],
      outputVarNames: ['y']
    })
    expect(code).toMatch(`\
// Model variables
let _x;
let _y;`)
  })

  it('should work when valid input variable name with subscript (referenced by output variable) is provided in spec file', () => {
    const mdl = `
      DimA: A1, A2 ~~|
      A[DimA] = 10, 20 ~~|
      B[DimA] = A[DimA] + 1 ~~|
    `
    const code = readInlineModelAndGenerateJS(mdl, {
      inputVarNames: ['A[A1]'],
      outputVarNames: ['B[A1]', 'B[A2]']
    })
    expect(code).toMatch(`\
// Model variables
let _a = multiDimArray([2]);
let _b = multiDimArray([2]);`)
  })

  it('should work when valid input variable name with subscript (not referenced by output variable) is provided in spec file', () => {
    // Note that `A` is specified as an input variable, but `A` is not referenced by output
    // variable `B`, which is an unusual (but valid) usage scenario, so `A` should not be
    // pruned by the `removeUnusedVariables` code (see #438)
    const mdl = `
      DimA: A1, A2 ~~|
      A[DimA] = 10, 20 ~~|
      B[DimA] = 30, 40 ~~|
    `
    const code = readInlineModelAndGenerateJS(mdl, {
      inputVarNames: ['A[A1]'],
      outputVarNames: ['B[A1]', 'B[A2]']
    })
    expect(code).toMatch(`\
// Model variables
let _a = multiDimArray([2]);
let _b = multiDimArray([2]);`)
  })

  // Note that this test takes a while (> 8 seconds) to run, so is skipped by default
  // TODO: This test has little to do with code gen; we should move this and other similar
  // tests to a separate file focused on the `removeUnusedVariables` step
  it.skip('should work without exceeding stack limits when model has deep dependency tree', () => {
    const n = 50000
    let mdl = 'x0 = 1 ~~|\n'
    for (let i = 1; i <= n; i++) {
      mdl += `x${i} = x${i - 1} + 1 ~~|`
    }

    const code = readInlineModelAndGenerateJS(mdl, {
      inputVarNames: ['x0'],
      outputVarNames: [`x${n}`]
    })
    for (let i = 0; i <= n; i++) {
      expect(code).toContain(`let _x${i};`)
    }
  })

  it('should throw error when unknown input variable name is provided in spec file', () => {
    const mdl = `
      DimA: A1, A2 ~~|
      A[DimA] = 10, 20 ~~|
      B = 30 ~~|
    `
    expect(() =>
      readInlineModelAndGenerateJS(mdl, {
        inputVarNames: ['C'],
        outputVarNames: ['A[A1]']
      })
    ).toThrow(
      'The input variable _c was declared in spec.json, but no matching variable was found in the model or external data sources'
    )
  })

  it('should throw error when cyclic dependency is detected for aux variable', () => {
    const mdl = `
      X = Y ~~|
      Y = X + 1 ~~|
    `
    expect(() => readInlineModelAndGenerateJS(mdl)).toThrow('Found cyclic dependency during toposort:\n_y →\n_x\n_y')
  })

  it('should throw error when cyclic dependency is detected for init variable', () => {
    const mdl = `
      X = INITIAL(Y) ~~|
      Y = X + 1 ~~|
    `
    expect(() => readInlineModelAndGenerateJS(mdl)).toThrow('Found cyclic dependency during toposort:\n_y →\n_x\n_y')
  })
})