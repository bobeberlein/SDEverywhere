// Copyright (c) 2024 Climate Interactive / New Venture Fund

export type LookupMode = 'interpolate' | 'forward' | 'backward'

export class Lookup {
  private invertedData?: number[]
  private lastInput: number
  private lastHitIndex: number

  constructor(private readonly n: number, private readonly data: number[]) {
    if (data.length < n * 2) {
      throw new Error(`Lookup data array length must be >= 2*size (length=${data.length} size=${n}`)
    }
    this.lastInput = Number.MAX_VALUE
    this.lastHitIndex = 0
  }

  public getLastX(): number {
    return this.data[this.n * 2 - 2]
  }

  /**
   * Return the y value if there is a data point for the given x value,
   * otherwise return undefined.
   * NOTE: The x values are assumed to be monotonically increasing.
   */
  public getValueAtTime(x: number): number {
    // TODO: Optimize this to use binary search
    const max = this.n * 2
    for (let xi = 0; xi < max; xi += 2) {
      const px = this.data[xi]
      if (px === x) {
        return this.data[xi + 1]
      }
    }
    return undefined
  }

  public getValueForX(x: number, mode: LookupMode): number {
    return this.getValue(x, false, mode)
  }

  public getValueForY(y: number): number {
    if (this.invertedData === undefined) {
      // Invert the matrix and cache it
      const numValues = this.n * 2
      const normalData = this.data
      const invertedData = Array(numValues)
      for (let i = 0; i < numValues; i += 2) {
        invertedData[i] = normalData[i + 1]
        invertedData[i + 1] = normalData[i]
      }
      this.invertedData = invertedData
    }
    return this.getValue(y, true, 'interpolate')
  }

  /**
   * Interpolate the y value from the array of (x,y) pairs.
   * NOTE: The x values are assumed to be monotonically increasing.
   */
  private getValue(input: number, useInvertedData: boolean, mode: LookupMode): number {
    const data = useInvertedData ? this.invertedData : this.data
    const max = this.n * 2

    // Use the cached values for improved lookup performance, except in the case
    // of `LOOKUP INVERT` (since it may not be accurate if calls flip back and forth
    // between inverted and non-inverted data)
    const useCachedValues = !useInvertedData
    let startIndex: number
    if (useCachedValues && input >= this.lastInput) {
      startIndex = this.lastHitIndex
    } else {
      startIndex = 0
    }

    for (let xi = startIndex; xi < max; xi += 2) {
      const x = data[xi]
      if (x >= input) {
        // We went past the input, or hit it exactly
        if (useCachedValues) {
          this.lastInput = input
          this.lastHitIndex = xi
        }

        if (xi === 0 || x === input) {
          // The input is less than the first x, or this x equals the input; return the
          // associated y without interpolation
          return data[xi + 1]
        }

        // Calculate the y value depending on the lookup mode
        switch (mode) {
          default:
          case 'interpolate': {
            // Interpolate along the line from the last (x,y)
            const last_x = data[xi - 2]
            const last_y = data[xi - 1]
            const y = data[xi + 1]
            const dx = x - last_x
            const dy = y - last_y
            return last_y + (dy / dx) * (input - last_x)
          }
          case 'forward':
            // Return the next y value without interpolating
            return data[xi + 1]
          case 'backward':
            // Return the previous y value without interpolating
            return data[xi - 1]
        }
      }
    }

    // The input is greater than all the x values, so return the high end of the range
    if (useCachedValues) {
      this.lastInput = input
      this.lastHitIndex = max
    }
    return data[max - 1]
  }

  /**
   * Interpolate the y value from the array of (x,y) pairs.
   * NOTE: The x values are assumed to be monotonically increasing.
   *
   * This method is similar to `getValue` in concept, but Vensim produces results for
   * the `GET DATA BETWEEN TIMES` function that differ in unexpected ways from normal
   * lookup behavior, so we implement it as a separate method here.
   */
  public getValueBetweenTimes(input: number, mode: LookupMode): number {
    const max = this.n * 2

    switch (mode) {
      case 'forward': {
        // Vensim appears to round non-integral input values down to a whole number
        // when mode is 1 (look forward), so we will do the same
        input = Math.floor(input)
        for (let xi = 0; xi < max; xi += 2) {
          const x = this.data[xi]
          if (x >= input) {
            return this.data[xi + 1]
          }
        }
        return this.data[max - 1]
      }
      case 'backward': {
        // Vensim appears to round non-integral input values down to a whole number
        // when mode is -1 (hold backward), so we will do the same
        input = Math.floor(input)
        for (let xi = 2; xi < max; xi += 2) {
          const x = this.data[xi]
          if (x >= input) {
            return this.data[xi - 1]
          }
        }
        if (max >= 4) {
          return this.data[max - 3]
        } else {
          return this.data[1]
        }
      }
      case 'interpolate':
      default: {
        // NOTE: This function produces results that match Vensim output for GET DATA BETWEEN TIMES with a
        // mode of 0 (interpolate), but only when the input values are integral (whole numbers).  If the
        // input value is fractional, Vensim produces bizarre/unexpected interpolated values.
        // TODO: For now we throw an error, but ideally we would match the Vensim results exactly.
        if (input - Math.floor(input) > 0) {
          let msg = `GET DATA BETWEEN TIMES was called with an input value (${input}) that has a fractional part. `
          msg += 'When mode is 0 (interpolate) and the input value is not a whole number, Vensim produces unexpected '
          msg += 'results that may differ from those produced by SDEverywhere.'
          throw new Error(msg)
        }
        for (let xi = 2; xi < max; xi += 2) {
          const x = this.data[xi]
          if (x >= input) {
            const last_x = this.data[xi - 2]
            const last_y = this.data[xi - 1]
            const y = this.data[xi + 1]
            const dx = x - last_x
            const dy = y - last_y
            return last_y + (dy / dx) * (input - last_x)
          }
        }
        return this.data[max - 1]
      }
    }
  }
}
