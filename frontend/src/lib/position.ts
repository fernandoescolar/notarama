// Mirrors internal/notes/position.go: sibling order is a plain float64
// ("fractional positioning" via arithmetic midpoints/gaps rather than
// string-based fractional indexing) so the client can compute a valid
// position for a drag&drop reorder or offline-created node without asking
// the server.
const GAP = 1000

export function positionAfter(last: number | null | undefined): number {
  if (last == null) return GAP
  return last + GAP
}

export function positionBefore(first: number | null | undefined): number {
  if (first == null) return GAP
  return first / 2
}

export function positionBetween(before: number, after: number): number {
  return before + (after - before) / 2
}
