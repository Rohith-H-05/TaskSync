import { gql } from '@apollo/client';

export const USER_FIELDS = gql`
  fragment UserFields on User {
    id
    email
    name
    avatarUrl
  }
`;

export const TASK_FIELDS = gql`
  fragment TaskFields on Task {
    id
    columnId
    boardId
    title
    description
    position
    dueDate
    assignee {
      ...UserFields
    }
    createdAt
    updatedAt
  }
  ${USER_FIELDS}
`;

export const COLUMN_FIELDS = gql`
  fragment ColumnFields on Column {
    id
    boardId
    title
    position
    tasks {
      ...TaskFields
    }
  }
  ${TASK_FIELDS}
`;

export const BOARD_FIELDS = gql`
  fragment BoardFields on Board {
    id
    workspaceId
    title
    description
    columns {
      ...ColumnFields
    }
    createdAt
    updatedAt
  }
  ${COLUMN_FIELDS}
`;

export const ME_QUERY = gql`
  query Me {
    me {
      ...UserFields
    }
  }
  ${USER_FIELDS}
`;

export const REGISTER_MUTATION = gql`
  mutation Register($input: RegisterInput!) {
    register(input: $input) {
      token
      user {
        ...UserFields
      }
    }
  }
  ${USER_FIELDS}
`;

export const LOGIN_MUTATION = gql`
  mutation Login($input: LoginInput!) {
    login(input: $input) {
      token
      user {
        ...UserFields
      }
    }
  }
  ${USER_FIELDS}
`;

export const GET_WORKSPACES_QUERY = gql`
  query GetWorkspaces {
    workspaces {
      id
      name
      slug
      members {
        id
        role
        user {
          ...UserFields
        }
      }
      boards {
        id
        title
        description
      }
    }
  }
  ${USER_FIELDS}
`;

export const CREATE_WORKSPACE_MUTATION = gql`
  mutation CreateWorkspace($input: CreateWorkspaceInput!) {
    createWorkspace(input: $input) {
      id
      name
      slug
    }
  }
`;

export const GET_BOARD_QUERY = gql`
  query GetBoard($id: ID!) {
    board(id: $id) {
      ...BoardFields
    }
  }
  ${BOARD_FIELDS}
`;

export const CREATE_BOARD_MUTATION = gql`
  mutation CreateBoard($input: CreateBoardInput!) {
    createBoard(input: $input) {
      ...BoardFields
    }
  }
  ${BOARD_FIELDS}
`;

export const CREATE_COLUMN_MUTATION = gql`
  mutation CreateColumn($input: CreateColumnInput!) {
    createColumn(input: $input) {
      ...ColumnFields
    }
  }
  ${COLUMN_FIELDS}
`;

export const CREATE_TASK_MUTATION = gql`
  mutation CreateTask($input: CreateTaskInput!) {
    createTask(input: $input) {
      ...TaskFields
    }
  }
  ${TASK_FIELDS}
`;

export const MOVE_TASK_MUTATION = gql`
  mutation MoveTask($input: MoveTaskInput!) {
    moveTask(input: $input) {
      id
      columnId
      position
    }
  }
`;

export const UPDATE_TASK_MUTATION = gql`
  mutation UpdateTask($input: UpdateTaskInput!) {
    updateTask(input: $input) {
      ...TaskFields
    }
  }
  ${TASK_FIELDS}
`;

export const DELETE_TASK_MUTATION = gql`
  mutation DeleteTask($id: ID!) {
    deleteTask(id: $id)
  }
`;
