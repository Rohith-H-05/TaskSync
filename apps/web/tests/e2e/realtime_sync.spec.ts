import { test, expect } from '@playwright/test';

test.describe('Real-Time Dual-Browser Collaborative Sync', () => {
  const API_URL = 'http://localhost:4000/graphql';

  // Seed data holders
  let tokenUserA: string;
  let tokenUserB: string;
  let workspaceId: string;
  let boardId: string;

  async function gql(query: string, variables: any = {}, token?: string) {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ query, variables })
    });
    const json = await res.json();
    if (json.errors) {
      throw new Error(`GraphQL Error: ${JSON.stringify(json.errors)}`);
    }
    return json.data;
  }

  test.beforeAll(async () => {
    const timestamp = Date.now();

    // 1. Register User A
    const registerA = await gql(`
      mutation Register($input: RegisterInput!) {
        register(input: $input) {
          token
          user { id email name }
        }
      }
    `, {
      input: {
        email: `browser_a_${timestamp}@tasksync.test`,
        password: 'Password123!',
        name: 'Browser User A'
      }
    });
    tokenUserA = registerA.register.token;

    // 2. Register User B
    const registerB = await gql(`
      mutation Register($input: RegisterInput!) {
        register(input: $input) {
          token
          user { id email name }
        }
      }
    `, {
      input: {
        email: `browser_b_${timestamp}@tasksync.test`,
        password: 'Password123!',
        name: 'Browser User B'
      }
    });
    tokenUserB = registerB.register.token;
    const userBId = registerB.register.user.id;

    // 3. User A creates Workspace
    const wsRes = await gql(`
      mutation CreateWorkspace($input: CreateWorkspaceInput!) {
        createWorkspace(input: $input) {
          id
          name
        }
      }
    `, {
      input: { name: `Live Collab ${timestamp}` }
    }, tokenUserA);
    workspaceId = wsRes.createWorkspace.id;

    // 4. User A invites User B as MEMBER
    await gql(`
      mutation AddMember($input: AddWorkspaceMemberInput!) {
        addWorkspaceMember(input: $input) {
          id
          role
        }
      }
    `, {
      input: {
        workspaceId,
        email: registerB.register.user.email,
        role: 'MEMBER'
      }
    }, tokenUserA);

    // 5. User A creates Board and Column
    const boardRes = await gql(`
      mutation CreateBoard($input: CreateBoardInput!) {
        createBoard(input: $input) {
          id
          title
        }
      }
    `, {
      input: {
        workspaceId,
        title: 'Realtime Sync Board'
      }
    }, tokenUserA);
    boardId = boardRes.createBoard.id;

    await gql(`
      mutation CreateColumn($input: CreateColumnInput!) {
        createColumn(input: $input) {
          id
          title
        }
      }
    `, {
      input: {
        boardId,
        title: 'Sprint Backlog',
        position: 1000.0
      }
    }, tokenUserA);
  });

  test('User A adds and deletes a task; User B sees changes instantly via WebSocket subscription', async ({ browser }) => {
    // 1. Create Browser Context for User A
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();

    // Authenticate User A
    await pageA.goto('/');
    await pageA.evaluate((token) => {
      localStorage.setItem('tasksync_token', token);
    }, tokenUserA);
    await pageA.goto('/');

    // 2. Create Browser Context for User B
    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();

    // Authenticate User B
    await pageB.goto('/');
    await pageB.evaluate((token) => {
      localStorage.setItem('tasksync_token', token);
    }, tokenUserB);
    await pageB.goto('/');

    // 3. Both users navigate into the board
    // Page A clicks the board card
    await expect(pageA.getByText('Realtime Sync Board')).toBeVisible({ timeout: 10000 });
    await pageA.getByText('Realtime Sync Board').click();
    await expect(pageA.getByText('Sprint Backlog')).toBeVisible({ timeout: 10000 });

    // Page B clicks the board card
    await expect(pageB.getByText('Realtime Sync Board')).toBeVisible({ timeout: 10000 });
    await pageB.getByText('Realtime Sync Board').click();
    await expect(pageB.getByText('Sprint Backlog')).toBeVisible({ timeout: 10000 });

    // 4. User A creates a task on Page A
    await pageA.getByRole('button', { name: 'Add a card' }).first().click();
    const taskInput = pageA.getByPlaceholder('What needs to be done?');
    await taskInput.fill('Sync Test Task 99');
    await pageA.getByRole('button', { name: 'Add Card' }).click();

    // Assert that User A sees the new card
    await expect(pageA.getByText('Sync Test Task 99')).toBeVisible({ timeout: 5000 });

    // 5. CRITICAL TEST: Assert that User B (different browser context) receives the card automatically
    // via GraphQL WebSocket subscription WITHOUT ANY PAGE RELOAD
    await expect(pageB.getByText('Sync Test Task 99')).toBeVisible({ timeout: 10000 });

    // 6. User A deletes the task on Page A
    // Find card and click delete button
    const deleteButton = pageA.locator('button[title="Delete task"]').first();
    await deleteButton.click({ force: true });

    // User A should no longer see it
    await expect(pageA.getByText('Sync Test Task 99')).not.toBeVisible({ timeout: 5000 });

    // 7. Assert that User B sees it disappear in real time WITHOUT ANY PAGE RELOAD
    await expect(pageB.getByText('Sync Test Task 99')).not.toBeVisible({ timeout: 10000 });

    // Cleanup contexts
    await contextA.close();
    await contextB.close();
  });
});
