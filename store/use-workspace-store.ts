"use client";

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

import type { WorkspaceSnapshot } from '@/lib/demo-data';

export type WorkspaceViewMode = 'general' | 'production' | 'social';
export type ApprovalStatus = 'pending' | 'approved' | 'changes_requested';

export type WorkspaceMember = WorkspaceSnapshot['teamMembers'][number];

type WorkspaceStoreState = {
  viewModeByWorkspace: Record<string, WorkspaceViewMode>;
  actingAsByWorkspace: Record<string, string>;
  membersByWorkspace: Record<string, WorkspaceMember[]>;
  approvalsByWorkspace: Record<string, Record<string, ApprovalStatus>>;
  ensureWorkspace: (workspace: WorkspaceSnapshot) => void;
  setViewMode: (workspaceSlug: string, mode: WorkspaceViewMode) => void;
  setActingAs: (workspaceSlug: string, memberId: string) => void;
  addMember: (workspaceSlug: string, member: WorkspaceMember) => { ok: boolean; message?: string };
  removeMember: (workspaceSlug: string, memberId: string) => void;
  updateMemberRole: (workspaceSlug: string, memberId: string, role: string, focus: WorkspaceViewMode) => void;
  setApprovalStatus: (workspaceSlug: string, contentId: string, status: ApprovalStatus) => void;
};

export const useWorkspaceStore = create<WorkspaceStoreState>()(
  persist(
    (set, get) => ({
      viewModeByWorkspace: {},
      actingAsByWorkspace: {},
      membersByWorkspace: {},
      approvalsByWorkspace: {},
      ensureWorkspace: (workspace) =>
        set((state) => {
          if (state.membersByWorkspace[workspace.slug]) {
            return state;
          }

          return {
            membersByWorkspace: {
              ...state.membersByWorkspace,
              [workspace.slug]: workspace.teamMembers
            },
            actingAsByWorkspace: {
              ...state.actingAsByWorkspace,
              [workspace.slug]: workspace.teamMembers[0]?.id ?? ''
            },
            viewModeByWorkspace: {
              ...state.viewModeByWorkspace,
              [workspace.slug]: state.viewModeByWorkspace[workspace.slug] ?? 'general'
            },
            approvalsByWorkspace: {
              ...state.approvalsByWorkspace,
              [workspace.slug]: state.approvalsByWorkspace[workspace.slug] ?? {}
            }
          };
        }),
      setViewMode: (workspaceSlug, mode) =>
        set((state) => ({
          viewModeByWorkspace: {
            ...state.viewModeByWorkspace,
            [workspaceSlug]: mode
          }
        })),
      setActingAs: (workspaceSlug, memberId) =>
        set((state) => ({
          actingAsByWorkspace: {
            ...state.actingAsByWorkspace,
            [workspaceSlug]: memberId
          }
        })),
      addMember: (workspaceSlug, member) => {
        const current = get().membersByWorkspace[workspaceSlug] ?? [];

        if (current.length >= 5) {
          return { ok: false, message: 'Cada workspace pode ter ate 5 membros ativos nesta versao.' };
        }

        set((state) => ({
          membersByWorkspace: {
            ...state.membersByWorkspace,
            [workspaceSlug]: [...(state.membersByWorkspace[workspaceSlug] ?? []), member]
          }
        }));

        return { ok: true };
      },
      removeMember: (workspaceSlug, memberId) =>
        set((state) => {
          const nextMembers = (state.membersByWorkspace[workspaceSlug] ?? []).filter((member) => member.id !== memberId);
          const currentActingAs = state.actingAsByWorkspace[workspaceSlug];

          return {
            membersByWorkspace: {
              ...state.membersByWorkspace,
              [workspaceSlug]: nextMembers
            },
            actingAsByWorkspace: {
              ...state.actingAsByWorkspace,
              [workspaceSlug]: currentActingAs === memberId ? nextMembers[0]?.id ?? '' : currentActingAs
            }
          };
        }),
      updateMemberRole: (workspaceSlug, memberId, role, focus) =>
        set((state) => ({
          membersByWorkspace: {
            ...state.membersByWorkspace,
            [workspaceSlug]: (state.membersByWorkspace[workspaceSlug] ?? []).map((member) =>
              member.id === memberId ? { ...member, role, focus } : member
            )
          }
        })),
      setApprovalStatus: (workspaceSlug, contentId, status) =>
        set((state) => ({
          approvalsByWorkspace: {
            ...state.approvalsByWorkspace,
            [workspaceSlug]: {
              ...(state.approvalsByWorkspace[workspaceSlug] ?? {}),
              [contentId]: status
            }
          }
        }))
    }),
    {
      name: 'contentos-workspace-store-v1',
      storage: createJSONStorage(() => localStorage)
    }
  )
);
