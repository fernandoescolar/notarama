package notes

// Sibling ordering uses plain float64 positions ("fractional positioning"):
// inserting between two siblings takes the arithmetic midpoint, and
// appending takes the last position plus a fixed gap. This gives the same
// practical benefits as string-based fractional indexing (reorder without
// rewriting siblings, clients can compute a valid position offline without
// coordinating with the server) with much simpler, easily-verified
// arithmetic. float64 has 52 bits of mantissa, i.e. room for dozens of
// successive same-spot inserts before precision would become a concern —
// far beyond what a personal note hierarchy will ever need. The frontend
// mirrors this exact logic in TypeScript (see frontend/src/lib/position.ts).

const gap = 1000.0

// PositionAfter returns a position placed after the last known sibling
// position (or the first position if the list is empty).
func PositionAfter(last *float64) float64 {
	if last == nil {
		return gap
	}
	return *last + gap
}

// PositionBefore returns a position placed before the first known sibling
// position (or the first position if the list is empty).
func PositionBefore(first *float64) float64 {
	if first == nil {
		return gap
	}
	return *first / 2
}

// PositionBetween returns a position strictly between two sibling
// positions. Callers must ensure before < after.
func PositionBetween(before, after float64) float64 {
	return before + (after-before)/2
}
