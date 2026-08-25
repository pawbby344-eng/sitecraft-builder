import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { blockMutationSchema, blockUpdateSchema, reorderSchema, replaceAllSchema } from "../shared/site-engine/schemas";
import { applySiteSpecSchema, briefIdSchema, createProjectStage3Schema, projectOnlySchema, saveIdeaSchema, siteSpecIdSchema, updateBriefSchema } from "../shared/site-engine/architect";
import { createBlock, replaceAllBlocks, reorderBlocks, updateBlock } from "./site-engine";
import { applySiteSpec, confirmBrief, confirmSiteSpec, createBrief, createProject, generateSiteSpec, getArchitectState, saveIdea, updateBrief } from "./site-architect";
import { listWorkspaceProjects } from "./workspace";

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

  workspace: router({
    projects: protectedProcedure.query(({ ctx }) => listWorkspaceProjects(ctx.user.id)),
  }),

  siteBlocks: router({
    create: protectedProcedure.input(blockMutationSchema).mutation(({ ctx, input }) => createBlock(ctx.user.id, input)),
    update: protectedProcedure.input(blockUpdateSchema).mutation(({ ctx, input }) => updateBlock(ctx.user.id, input)),
    reorder: protectedProcedure.input(reorderSchema).mutation(({ ctx, input }) => reorderBlocks(ctx.user.id, input)),
    replaceAll: protectedProcedure.input(replaceAllSchema).mutation(({ ctx, input }) => replaceAllBlocks(ctx.user.id, input)),
  }),

  architect: router({
    createProject: protectedProcedure.input(createProjectStage3Schema).mutation(({ ctx, input }) => createProject(ctx.user.id, input)),
    saveIdea: protectedProcedure.input(saveIdeaSchema).mutation(({ ctx, input }) => saveIdea(ctx.user.id, input)),
    createBrief: protectedProcedure.input(projectOnlySchema).mutation(({ ctx, input }) => createBrief(ctx.user.id, input)),
    updateBrief: protectedProcedure.input(updateBriefSchema).mutation(({ ctx, input }) => updateBrief(ctx.user.id, input)),
    confirmBrief: protectedProcedure.input(briefIdSchema).mutation(({ ctx, input }) => confirmBrief(ctx.user.id, input)),
    generateSiteSpec: protectedProcedure.input(briefIdSchema).mutation(({ ctx, input }) => generateSiteSpec(ctx.user.id, input)),
    confirmSiteSpec: protectedProcedure.input(siteSpecIdSchema).mutation(({ ctx, input }) => confirmSiteSpec(ctx.user.id, input)),
    applySiteSpec: protectedProcedure.input(applySiteSpecSchema).mutation(({ ctx, input }) => applySiteSpec(ctx.user.id, input)),
    state: protectedProcedure.input(projectOnlySchema).query(({ ctx, input }) => getArchitectState(ctx.user.id, input.projectId)),
  }),
});

export type AppRouter = typeof appRouter;
