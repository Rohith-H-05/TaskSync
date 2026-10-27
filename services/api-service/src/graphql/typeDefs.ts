import gql from 'graphql-tag';

export const typeDefs = gql`
  scalar DateTime
  scalar JSON

  enum WorkspaceRole {
    OWNER
    MEMBER
    VIEWER
  }

  enum TaskAction {
    CREATED
    UPDATED
    MOVED
    DELETED
  }

  enum BoardEventType {
    TASK_CREATED
    TASK_UPDATED
    TASK_MOVED
    TASK_DELETED
    COLUMN_CREATED
    COLUMN_UPDATED
    COLUMN_MOVED
    COLUMN_DELETED
  }

  type User {
    id: ID!
    email: String!
    name: String!
    avatarUrl: String
    createdAt: DateTime!
  }

  type AuthPayload {
    token: String!
    user: User!
  }

  type WorkspaceMember {
    id: ID!
    user: User!
    role: WorkspaceRole!
    createdAt: DateTime!
  }

  type Workspace {
    id: ID!
    name: String!
    slug: String!
    members: [WorkspaceMember!]!
    boards: [Board!]!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type Board {
    id: ID!
    workspaceId: ID!
    title: String!
    description: String
    columns: [Column!]!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type Column {
    id: ID!
    boardId: ID!
    title: String!
    position: Float!
    tasks: [Task!]!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type Task {
    id: ID!
    columnId: ID!
    boardId: ID!
    title: String!
    description: String
    assignee: User
    dueDate: DateTime
    position: Float!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type ActivityLog {
    id: ID!
    boardId: ID!
    task: Task
    user: User!
    action: TaskAction!
    details: JSON!
    createdAt: DateTime!
  }

  type PageInfo {
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
    startCursor: String
    endCursor: String
  }

  type TaskEdge {
    cursor: String!
    node: Task!
  }

  type TaskConnection {
    edges: [TaskEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type ActivityEdge {
    cursor: String!
    node: ActivityLog!
  }

  type ActivityConnection {
    edges: [ActivityEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type BoardEvent {
    type: BoardEventType!
    boardId: ID!
    columnId: ID
    taskId: ID
    task: Task
    column: Column
    actor: User!
    timestamp: DateTime!
  }

  input RegisterInput {
    email: String!
    password: String!
    name: String!
  }

  input LoginInput {
    email: String!
    password: String!
  }

  input CreateWorkspaceInput {
    name: String!
  }

  input AddWorkspaceMemberInput {
    workspaceId: ID!
    email: String!
    role: WorkspaceRole!
  }

  input UpdateWorkspaceMemberRoleInput {
    workspaceId: ID!
    userId: ID!
    role: WorkspaceRole!
  }

  input CreateBoardInput {
    workspaceId: ID!
    title: String!
    description: String
  }

  input UpdateBoardInput {
    id: ID!
    title: String
    description: String
  }

  input CreateColumnInput {
    boardId: ID!
    title: String!
    position: Float!
  }

  input UpdateColumnInput {
    id: ID!
    title: String!
  }

  input MoveColumnInput {
    id: ID!
    newPosition: Float!
  }

  input CreateTaskInput {
    columnId: ID!
    boardId: ID!
    title: String!
    description: String
    assigneeId: ID
    dueDate: DateTime
    position: Float!
  }

  input UpdateTaskInput {
    id: ID!
    title: String
    description: String
    assigneeId: ID
    dueDate: DateTime
  }

  input MoveTaskInput {
    id: ID!
    targetColumnId: ID!
    newPosition: Float!
  }

  input TaskFilterInput {
    searchQuery: String
    assigneeId: ID
  }

  type Query {
    me: User!
    workspaces: [Workspace!]!
    workspace(id: ID!): Workspace
    board(id: ID!): Board
    tasks(boardId: ID!, columnId: ID, filter: TaskFilterInput, first: Int, after: String): TaskConnection!
    boardActivity(boardId: ID!, first: Int, after: String): ActivityConnection!
  }

  type Mutation {
    register(input: RegisterInput!): AuthPayload!
    login(input: LoginInput!): AuthPayload!

    createWorkspace(input: CreateWorkspaceInput!): Workspace!
    addWorkspaceMember(input: AddWorkspaceMemberInput!): WorkspaceMember!
    updateWorkspaceMemberRole(input: UpdateWorkspaceMemberRoleInput!): WorkspaceMember!
    removeWorkspaceMember(workspaceId: ID!, userId: ID!): Boolean!

    createBoard(input: CreateBoardInput!): Board!
    updateBoard(input: UpdateBoardInput!): Board!
    deleteBoard(id: ID!): Boolean!

    createColumn(input: CreateColumnInput!): Column!
    updateColumn(input: UpdateColumnInput!): Column!
    deleteColumn(id: ID!): Boolean!
    moveColumn(input: MoveColumnInput!): Column!

    createTask(input: CreateTaskInput!): Task!
    updateTask(input: UpdateTaskInput!): Task!
    deleteTask(id: ID!): Boolean!
    moveTask(input: MoveTaskInput!): Task!
  }

  type Subscription {
    boardUpdated(boardId: ID!): BoardEvent!
  }
`;

