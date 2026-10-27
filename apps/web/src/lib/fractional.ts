export interface Positionable {
  id: string;
  position: number;
}

/**
 * Calculates the fractional position for an item inserted at targetIndex within an ordered list.
 *
 * @param items Array of existing items in the target container, sorted by position ASC.
 * @param targetIndex The index where the item is being inserted (0 to items.length).
 * @param excludeId Optional ID of item being moved within the same container.
 * @returns The calculated floating-point position.
 */
export function calculateFractionalPosition(
  items: Positionable[],
  targetIndex: number,
  excludeId?: string
): number {
  // Filter out the item itself if moving within the same list
  const filtered = excludeId ? items.filter((item) => item.id !== excludeId) : [...items];

  // Case 1: Target list is empty
  if (filtered.length === 0) {
    return 1000.0;
  }

  // Case 2: Dropping at the very top (index <= 0)
  if (targetIndex <= 0) {
    const firstPos = filtered[0].position;
    return firstPos > 0 ? firstPos / 2 : firstPos - 1000.0;
  }

  // Case 3: Dropping at the very bottom (index >= filtered.length)
  if (targetIndex >= filtered.length) {
    const lastPos = filtered[filtered.length - 1].position;
    return lastPos + 1000.0;
  }

  // Case 4: Dropping between two existing items
  const prevPos = filtered[targetIndex - 1].position;
  const nextPos = filtered[targetIndex].position;

  return (prevPos + nextPos) / 2.0;
}
