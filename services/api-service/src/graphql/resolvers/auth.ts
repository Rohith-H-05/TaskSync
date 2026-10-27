import { z } from 'zod';
import { GraphQLContext } from '../context';
import { hashPassword, verifyPassword } from '../../auth/password';
import { signToken } from '../../auth/jwt';
import { createGraphQLError, ErrorCode } from '../../lib/errors';
import { requireAuth } from '../../auth/rbac';

const registerSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase().trim(),
  password: z.string().min(6, 'Password must be at least 6 characters long'),
  name: z.string().min(1, 'Name is required').trim()
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase().trim(),
  password: z.string().min(1, 'Password is required')
});

export const authResolvers = {
  Query: {
    me: async (_parent: unknown, _args: unknown, ctx: GraphQLContext) => {
      const authUser = requireAuth(ctx.user);
      const user = await ctx.prisma.user.findUnique({
        where: { id: authUser.userId }
      });

      if (!user) {
        throw createGraphQLError('User not found', ErrorCode.NOT_FOUND);
      }

      return user;
    }
  },

  Mutation: {
    register: async (
      _parent: unknown,
      args: { input: z.infer<typeof registerSchema> },
      ctx: GraphQLContext
    ) => {
      const validation = registerSchema.safeParse(args.input);
      if (!validation.success) {
        throw createGraphQLError(
          validation.error.errors[0]?.message || 'Invalid input',
          ErrorCode.BAD_USER_INPUT,
          { errors: validation.error.format() }
        );
      }

      const { email, password, name } = validation.data;

      const existingUser = await ctx.prisma.user.findUnique({
        where: { email }
      });

      if (existingUser) {
        throw createGraphQLError('A user with this email already exists', ErrorCode.CONFLICT);
      }

      const passwordHash = await hashPassword(password);

      const user = await ctx.prisma.user.create({
        data: {
          email,
          passwordHash,
          name
        }
      });

      const token = signToken({
        userId: user.id,
        email: user.email
      });

      return {
        token,
        user
      };
    },

    login: async (
      _parent: unknown,
      args: { input: z.infer<typeof loginSchema> },
      ctx: GraphQLContext
    ) => {
      const validation = loginSchema.safeParse(args.input);
      if (!validation.success) {
        throw createGraphQLError(
          validation.error.errors[0]?.message || 'Invalid input',
          ErrorCode.BAD_USER_INPUT,
          { errors: validation.error.format() }
        );
      }

      const { email, password } = validation.data;

      const user = await ctx.prisma.user.findUnique({
        where: { email }
      });

      if (!user) {
        throw createGraphQLError('Invalid email or password', ErrorCode.UNAUTHENTICATED);
      }

      const isValid = await verifyPassword(password, user.passwordHash);
      if (!isValid) {
        throw createGraphQLError('Invalid email or password', ErrorCode.UNAUTHENTICATED);
      }

      const token = signToken({
        userId: user.id,
        email: user.email
      });

      return {
        token,
        user
      };
    }
  }
};
