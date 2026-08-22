import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { blockMutationSchema, blockUpdateSchema, reorderSchema, replaceAllSchema } from "../shared/site-engine/schemas";
import { createBlock, replaceAllBlocks, reorderBlocks, updateBlock } from "./site-engine";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  siteBlocks: router({
    create: protectedProcedure.input(blockMutationSchema).mutation(({ ctx, input }) => createBlock(ctx.user.id, input)),
    update: protectedProcedure.input(blockUpdateSchema).mutation(({ ctx, input }) => updateBlock(ctx.user.id, input)),
    reorder: protectedProcedure.input(reorderSchema).mutation(({ ctx, input }) => reorderBlocks(ctx.user.id, input)),
    replaceAll: protectedProcedure.input(replaceAllSchema).mutation(({ ctx, input }) => replaceAllBlocks(ctx.user.id, input)),
  }),
});

export type AppRouter = typeof appRouter;
