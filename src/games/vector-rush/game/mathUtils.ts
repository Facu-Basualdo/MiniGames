/** Clamps a value into the [min, max] range. */
export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}
