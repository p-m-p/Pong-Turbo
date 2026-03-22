/**
 * Axis-aligned bounding box overlap test.
 * Returns true only when the boxes genuinely overlap (touching edges is not an overlap).
 *
 * @param {{ x: number, y: number, w: number, h: number }} a
 * @param {{ x: number, y: number, w: number, h: number }} b
 */
export function aabb(a, b) {
  return (
    a.x + a.w > b.x && a.x < b.x + b.w &&
    a.y + a.h > b.y && a.y < b.y + b.h
  );
}
