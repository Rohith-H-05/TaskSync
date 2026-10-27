/**
 * TaskSync – Benchmark Seed Helper
 * Seeds a user, workspace, board and tasks, then outputs:
 *   BOARD_ID and a JWT_TOKEN ready to paste into the benchmark command.
 */
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_min_32_characters_for_tasksync_dev';
const prisma = new PrismaClient();

async function seed() {
  console.log('🌱  Seeding benchmark data...\n');

  // Upsert benchmark user
  let user = await prisma.user.findUnique({ where: { email: 'benchmark@tasksync.local' } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: 'benchmark@tasksync.local',
        name: 'Benchmark User',
        passwordHash: '$2b$12$placeholder_hash_not_for_login'
      }
    });
  }

  // Workspace
  let ws = await prisma.workspace.findFirst({ where: { slug: 'benchmark-workspace' } });
  if (!ws) {
    ws = await prisma.workspace.create({
      data: { name: 'Benchmark Workspace', slug: 'benchmark-workspace' }
    });
    await prisma.workspaceMember.create({
      data: { workspaceId: ws.id, userId: user.id, role: 'OWNER' }
    });
  }

  // Board
  let board = await prisma.board.findFirst({ where: { workspaceId: ws.id, title: 'Benchmark Board' } });
  if (!board) {
    board = await prisma.board.create({
      data: { workspaceId: ws.id, title: 'Benchmark Board', description: 'Used for latency benchmarking' }
    });
  }

  // Ensure columns & tasks exist
  const existingCols = await prisma.column.findMany({ where: { boardId: board.id } });
  if (existingCols.length === 0) {
    const cols = await prisma.column.createManyAndReturn({
      data: [
        { boardId: board.id, title: 'To Do', position: 1000.0 },
        { boardId: board.id, title: 'In Progress', position: 2000.0 },
        { boardId: board.id, title: 'Done', position: 3000.0 }
      ]
    });

    // Seed 10 tasks across columns
    const taskData = [];
    for (let i = 0; i < 10; i++) {
      const col = cols[i % cols.length];
      taskData.push({
        boardId: board.id,
        columnId: col.id,
        title: `Benchmark Task ${i + 1}`,
        description: `Auto-generated task ${i + 1} for latency measurement`,
        position: (i + 1) * 100.0
      });
    }
    await prisma.task.createMany({ data: taskData });
    console.log(`  Created ${cols.length} columns and 10 tasks.`);
  }

  // Generate JWT
  const token = jwt.sign(
    { userId: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: '1d' }
  );

  console.log('✅  Benchmark data ready.\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Run this command to start benchmarking (API server must be running on :4000):');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(`  BOARD_ID=${board.id} JWT_TOKEN=${token} node services/api-service/scripts/benchmark.mjs\n`);

  await prisma.$disconnect();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});

