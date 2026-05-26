import type Big from 'big.js'

export function bigMax(...values: Big[]): Big {
  return values.reduce((max, v) => (v.gt(max) ? v : max))
}

export function bigMin(...values: Big[]): Big {
  return values.reduce((min, v) => (v.lt(min) ? v : min))
}
