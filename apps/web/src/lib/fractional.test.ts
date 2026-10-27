import { describe, it, expect } from 'vitest';
import { calculateFractionalPosition, Positionable } from './fractional';

describe('Fractional Positioning Algorithm Tests', () => {
  it('should return 1000.0 when dropping into an empty column', () => {
    const emptyList: Positionable[] = [];
    const pos = calculateFractionalPosition(emptyList, 0);
    expect(pos).toBe(1000.0);
  });

  it('should return half of the first item position when dropping at the very top (index 0)', () => {
    const items: Positionable[] = [
      { id: 'task-1', position: 1000.0 },
      { id: 'task-2', position: 2000.0 }
    ];

    const pos = calculateFractionalPosition(items, 0);
    expect(pos).toBe(500.0);
  });

  it('should return last position + 1000.0 when dropping at the very bottom', () => {
    const items: Positionable[] = [
      { id: 'task-1', position: 1000.0 },
      { id: 'task-2', position: 2500.0 }
    ];

    const pos = calculateFractionalPosition(items, 2);
    expect(pos).toBe(3500.0);
  });

  it('should return the exact midpoint when dropping between two cards', () => {
    const items: Positionable[] = [
      { id: 'task-1', position: 1000.0 },
      { id: 'task-2', position: 2000.0 }
    ];

    const pos = calculateFractionalPosition(items, 1);
    expect(pos).toBe(1500.0);
  });

  it('should correctly calculate consecutive midpoints without collision', () => {
    let items: Positionable[] = [
      { id: 'task-1', position: 1000.0 },
      { id: 'task-2', position: 2000.0 }
    ];

    // Drop task-3 between 1 and 2
    const pos3 = calculateFractionalPosition(items, 1);
    expect(pos3).toBe(1500.0);

    items = [
      { id: 'task-1', position: 1000.0 },
      { id: 'task-3', position: 1500.0 },
      { id: 'task-2', position: 2000.0 }
    ];

    // Drop task-4 between task-1 (1000.0) and task-3 (1500.0)
    const pos4 = calculateFractionalPosition(items, 1);
    expect(pos4).toBe(1250.0);

    // Drop task-5 between task-3 (1500.0) and task-2 (2000.0)
    const pos5 = calculateFractionalPosition(items, 2);
    expect(pos5).toBe(1750.0);
  });

  it('should exclude the moving item itself when reordering within the same column', () => {
    const items: Positionable[] = [
      { id: 'task-1', position: 1000.0 },
      { id: 'task-2', position: 2000.0 },
      { id: 'task-3', position: 3000.0 }
    ];

    // Moving task-3 to top (before task-1)
    const pos = calculateFractionalPosition(items, 0, 'task-3');
    expect(pos).toBe(500.0);
  });
});

