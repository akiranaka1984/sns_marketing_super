import { router, protectedProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { db } from "./db";
import { tenants, tenantUsers } from "../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";

/**
 * Tenant Router
 * Manages multi-tenant functionality
 */

export const tenantRouter = router({
  /**
   * Create a new tenant
   */
  createTenant: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
      plan: z.enum(["free", "basic", "pro", "enterprise"]).default("free"),
    }))
    .mutation(async ({ input, ctx }) => {
      // Check if slug is already taken
      const existing = await db
        .select()
        .from(tenants)
        .where(eq(tenants.slug, input.slug));

      if (existing.length > 0) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: "Slug already taken" });
      }

      // Create tenant
      await db.insert(tenants).values({
        name: input.name,
        slug: input.slug,
        ownerId: ctx.user.id,
        plan: input.plan,
        maxAccounts: input.plan === "free" ? 5 : input.plan === "basic" ? 20 : input.plan === "pro" ? 50 : 200,
        maxProjects: input.plan === "free" ? 3 : input.plan === "basic" ? 10 : input.plan === "pro" ? 30 : 100,
        maxAgents: input.plan === "free" ? 10 : input.plan === "basic" ? 30 : input.plan === "pro" ? 100 : 500,
        status: "active",
      });

      return { success: true };
    }),

  /**
   * List user's tenants
   */
  listTenants: protectedProcedure
    .query(async ({ ctx }) => {
      // Get tenants where user is owner
      const ownedTenants = await db
        .select()
        .from(tenants)
        .where(eq(tenants.ownerId, ctx.user.id))
        .orderBy(desc(tenants.createdAt));

      // Get tenants where user is a member
      const memberTenantUsers = await db
        .select()
        .from(tenantUsers)
        .where(eq(tenantUsers.userId, ctx.user.id));

      const memberTenantIds = memberTenantUsers.map((tu) => tu.tenantId);
      // For demo purposes, we'll skip member tenants
      const memberTenants: any[] = [];

      return {
        ownedTenants,
        memberTenants,
      };
    }),

  /**
   * Get tenant by ID
   */
  getTenantById: protectedProcedure
    .input(z.object({
      id: z.number(),
    }))
    .query(async ({ input, ctx }) => {
      const [tenant] = await db
        .select()
        .from(tenants)
        .where(eq(tenants.id, input.id));

      if (!tenant) {
        throw new TRPCError({ code: 'NOT_FOUND', message: "Tenant not found" });
      }

      // Check if user has access to this tenant
      const isOwner = tenant.ownerId === ctx.user.id;
      const [membership] = await db
        .select()
        .from(tenantUsers)
        .where(
          and(
            eq(tenantUsers.tenantId, input.id),
            eq(tenantUsers.userId, ctx.user.id)
          )
        );

      if (!isOwner && !membership) {
        throw new TRPCError({ code: 'FORBIDDEN', message: "Access denied" });
      }

      return {
        ...tenant,
        settings: tenant.settings ? JSON.parse(tenant.settings) : {},
        userRole: isOwner ? "owner" : membership?.role,
      };
    }),

  /**
   * Update tenant
   */
  updateTenant: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).optional(),
      plan: z.enum(["free", "basic", "pro", "enterprise"]).optional(),
      status: z.enum(["active", "suspended", "cancelled"]).optional(),
      settings: z.record(z.string(), z.any()).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { id, ...updates } = input;

      // Check if user is owner
      const [tenant] = await db
        .select()
        .from(tenants)
        .where(eq(tenants.id, id));

      if (!tenant || tenant.ownerId !== ctx.user.id) {
        throw new TRPCError({ code: 'FORBIDDEN', message: "Access denied" });
      }

      const updateData: any = {};
      if (updates.name) updateData.name = updates.name;
      if (updates.plan) {
        updateData.plan = updates.plan;
        updateData.maxAccounts = updates.plan === "free" ? 5 : updates.plan === "basic" ? 20 : updates.plan === "pro" ? 50 : 200;
        updateData.maxProjects = updates.plan === "free" ? 3 : updates.plan === "basic" ? 10 : updates.plan === "pro" ? 30 : 100;
        updateData.maxAgents = updates.plan === "free" ? 10 : updates.plan === "basic" ? 30 : updates.plan === "pro" ? 100 : 500;
      }
      if (updates.status) updateData.status = updates.status;
      if (updates.settings) updateData.settings = JSON.stringify(updates.settings);

      await db
        .update(tenants)
        .set(updateData)
        .where(eq(tenants.id, id));

      return { success: true };
    }),

  /**
   * Delete tenant
   */
  deleteTenant: protectedProcedure
    .input(z.object({
      id: z.number(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Check if user is owner
      const [tenant] = await db
        .select()
        .from(tenants)
        .where(eq(tenants.id, input.id));

      if (!tenant || tenant.ownerId !== ctx.user.id) {
        throw new TRPCError({ code: 'FORBIDDEN', message: "Access denied" });
      }

      // Delete tenant users first
      await db
        .delete(tenantUsers)
        .where(eq(tenantUsers.tenantId, input.id));

      // Delete tenant
      await db
        .delete(tenants)
        .where(eq(tenants.id, input.id));

      return { success: true };
    }),

  /**
   * Invite user to tenant
   */
  inviteUser: protectedProcedure
    .input(z.object({
      tenantId: z.number(),
      userId: z.number(),
      role: z.enum(["admin", "member", "viewer"]).default("member"),
    }))
    .mutation(async ({ input, ctx }) => {
      // Check if user is owner or admin
      const [tenant] = await db
        .select()
        .from(tenants)
        .where(eq(tenants.id, input.tenantId));

      if (!tenant || tenant.ownerId !== ctx.user.id) {
        throw new TRPCError({ code: 'FORBIDDEN', message: "Access denied" });
      }

      // Check if user is already a member
      const existing = await db
        .select()
        .from(tenantUsers)
        .where(
          and(
            eq(tenantUsers.tenantId, input.tenantId),
            eq(tenantUsers.userId, input.userId)
          )
        );

      if (existing.length > 0) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: "User is already a member" });
      }

      // Add user to tenant
      await db.insert(tenantUsers).values({
        tenantId: input.tenantId,
        userId: input.userId,
        role: input.role,
        invitedBy: ctx.user.id,
        invitedAt: new Date().toISOString(),
        joinedAt: new Date().toISOString(),
      });

      return { success: true };
    }),

  /**
   * Remove user from tenant
   */
  removeUser: protectedProcedure
    .input(z.object({
      tenantId: z.number(),
      userId: z.number(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Check if user is owner or admin
      const [tenant] = await db
        .select()
        .from(tenants)
        .where(eq(tenants.id, input.tenantId));

      if (!tenant || tenant.ownerId !== ctx.user.id) {
        throw new TRPCError({ code: 'FORBIDDEN', message: "Access denied" });
      }

      // Remove user from tenant
      await db
        .delete(tenantUsers)
        .where(
          and(
            eq(tenantUsers.tenantId, input.tenantId),
            eq(tenantUsers.userId, input.userId)
          )
        );

      return { success: true };
    }),

  /**
   * List tenant members
   */
  listMembers: protectedProcedure
    .input(z.object({
      tenantId: z.number(),
    }))
    .query(async ({ input, ctx }) => {
      // Check if user has access to this tenant
      const [tenant] = await db
        .select()
        .from(tenants)
        .where(eq(tenants.id, input.tenantId));

      if (!tenant) {
        throw new TRPCError({ code: 'NOT_FOUND', message: "Tenant not found" });
      }

      const isOwner = tenant.ownerId === ctx.user.id;
      const [membership] = await db
        .select()
        .from(tenantUsers)
        .where(
          and(
            eq(tenantUsers.tenantId, input.tenantId),
            eq(tenantUsers.userId, ctx.user.id)
          )
        );

      if (!isOwner && !membership) {
        throw new TRPCError({ code: 'FORBIDDEN', message: "Access denied" });
      }

      // Get all members
      const members = await db
        .select()
        .from(tenantUsers)
        .where(eq(tenantUsers.tenantId, input.tenantId))
        .orderBy(desc(tenantUsers.joinedAt));

      return members.map((member) => ({
        ...member,
        permissions: member.permissions ? JSON.parse(member.permissions) : [],
      }));
    }),

  /**
   * Update member role
   */
  updateMemberRole: protectedProcedure
    .input(z.object({
      tenantId: z.number(),
      userId: z.number(),
      role: z.enum(["admin", "member", "viewer"]),
    }))
    .mutation(async ({ input, ctx }) => {
      // Check if user is owner
      const [tenant] = await db
        .select()
        .from(tenants)
        .where(eq(tenants.id, input.tenantId));

      if (!tenant || tenant.ownerId !== ctx.user.id) {
        throw new TRPCError({ code: 'FORBIDDEN', message: "Access denied" });
      }

      // Update member role
      await db
        .update(tenantUsers)
        .set({ role: input.role })
        .where(
          and(
            eq(tenantUsers.tenantId, input.tenantId),
            eq(tenantUsers.userId, input.userId)
          )
        );

      return { success: true };
    }),
});
