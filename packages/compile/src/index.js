// Copyright (c) 2022 Climate Interactive / New Venture Fund

export { canonicalName } from './_shared/helpers.js'
export { readDat } from './_shared/read-dat.js'
export { preprocessModel } from './preprocess/preprocessor.js'
export { generateC } from './generate/gen-code-c.js'
export { generateJS } from './generate/gen-code-js.js'
export { parseAndGenerate, parseModel, printNames } from './parse-and-generate.js'

// XXX
import { resetHelperState } from './_shared/helpers.js'
import { resetSubscriptsAndDimensions } from './_shared/subscript.js'
import Model from './model/model.js'
import { parseModel } from './parse-and-generate.js'

export function resetState() {
  // XXX: These steps are needed due to subs/dims and variables being in module-level storage
  resetHelperState()
  resetSubscriptsAndDimensions()
  Model.resetModelState()
}

export function parseInlineVensimModel(mdlContent /*: string*/, modelDir /*?: string*/) /*: ParsedModel*/ {
  // For tests that parse inline model text, in the case of the legacy parser, don't run
  // the preprocess step, and in the case of the new parser (which implicitly runs the
  // preprocess step), don't sort the definitions.  This makes it easier to do apples
  // to apples comparisons on the outputs from the two parser implementations.
  return parseModel(mdlContent, modelDir, { sort: false })
}

export function getModelListing() /*: string*/ {
  return Model.jsonList()
}
