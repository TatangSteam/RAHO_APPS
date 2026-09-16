import { z } from 'zod';

export const periodType = z.enum(['today', 'yesterday', 'this_week', 'last_week', 'this_month', 'last_month', 'custom']);
export const taskStatus = z.enum(['TODO', 'IN_PROGRESS', 'SUBMITTED', 'NEEDS_REVISION', 'COMPLETED', 'CANCELLED', 'OPEN']);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const pagination = {
  limit: z.coerce.number().int().min(1).max(50).default(10),
  offset: z.coerce.number().int().min(0).max(100000).default(0),
};
export const performanceQuery = z.object({ period: periodType, startDate: date.optional(), endDate: date.optional() }).strict();
export const todayQuery = z.object({}).strict();
export const compareQuery = z.object({
  periodA: periodType, startDateA: date.optional(), endDateA: date.optional(),
  periodB: periodType, startDateB: date.optional(), endDateB: date.optional(),
}).strict();
export const tasksQuery = performanceQuery.extend({ status: taskStatus.optional(), ...pagination }).strict();
export const overdueQuery = z.object({ period: periodType.optional(), startDate: date.optional(), endDate: date.optional(), ...pagination }).strict();
export const chatContext = z.object({
  intent: z.enum(['tasks', 'overdue']),
  period: periodType.optional(), startDate: date.optional(), endDate: date.optional(),
  status: taskStatus.optional(), ...pagination,
}).strict();
export const chatBody = z.object({
  message: z.string().trim().min(1).max(1000),
  conversationId: z.string().uuid().optional(),
  // Kept temporarily so an already-open dashboard from the rules-based client
  // can cross the OpenClaw rollout without failing validation. The server does
  // not use this client-supplied context for identity or data scope.
  context: chatContext.optional(),
}).strict();
export type PeriodInput = { period?: z.infer<typeof periodType>; startDate?: string; endDate?: string };
export type ListInput = PeriodInput & { status?: z.infer<typeof taskStatus>; limit?: number; offset?: number };
export type ChatContext = z.infer<typeof chatContext>;
