"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, Batch, User, ManagerDashboardSummary, FacultyMember, FacultyUtilizationSummary, TrainingSession } from "@/lib/api";

export function useBatches(params?: {
  status?: string;
  domain?: string;
  category?: string;
  search?: string;
}) {
  return useQuery({
    queryKey: ["batches", params],
    queryFn: () => api.getBatches(params),
  });
}

export function useBatch(id: string) {
  return useQuery({
    queryKey: ["batch", id],
    queryFn: () => api.getBatch(id),
    enabled: !!id,
  });
}

export function useCreateBatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: any) => api.createBatch(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["batches"] });
    },
  });
}

export function useUpdateBatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Batch> }) => api.updateBatch(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["batches"] });
    },
  });
}

export function useSubmitBatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.submitBatch(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["batches"] });
    },
  });
}

export function useDecideBatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, level, decision, reason }: { id: string; level: 1 | 2; decision: "approve" | "reject"; reason?: string }) =>
      api.decideBatch(id, level, decision, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["batches"] });
    },
  });
}

export function useManagerDashboard() {
  return useQuery({
    queryKey: ["manager-dashboard"],
    queryFn: () => api.getManagerDashboard(),
  });
}

export function useFinanceDrafts() {
  return useQuery({
    queryKey: ["finance-drafts"],
    queryFn: async () => {
      const batches = await api.getBatches();
      const drafts: Record<string, {
        approval_id: string;
        finance_status: string;
        finance_status_check_date: string;
        finance_check: number | null;
      }> = {};
      batches.forEach((batch) => {
        drafts[batch.id] = {
          approval_id: batch.approval_id || "",
          finance_status: batch.finance_status || "Pending",
          finance_status_check_date: batch.finance_status_check_date || "",
          finance_check: batch.finance_check ?? null,
        };
      });
      return drafts;
    },
  });
}

export function useUpdateFinanceDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ batchId, field, value }: { batchId: string; field: string; value: any }) => {
      return Promise.resolve({ batchId, field, value });
    },
    onMutate: async ({ batchId, field, value }) => {
      await queryClient.cancelQueries({ queryKey: ["finance-drafts"] });
      const previousDrafts = queryClient.getQueryData(["finance-drafts"]);
      queryClient.setQueryData(["finance-drafts"], (old: any) => ({
        ...old,
        [batchId]: {
          ...old?.[batchId],
          [field]: value,
        },
      }));
      return { previousDrafts };
    },
    onError: (err, variables, context) => {
      if (context?.previousDrafts) {
        queryClient.setQueryData(["finance-drafts"], context.previousDrafts);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["finance-drafts"] });
    },
  });
}

export function useSaveFinanceBatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ batchId, draft }: { batchId: string; draft: any }) =>
      api.updateBatch(batchId, {
        approval_id: draft.approval_id?.trim() || null,
        finance_status: draft.finance_status || "Pending",
        finance_status_check_date: draft.finance_status_check_date || null,
        finance_check: draft.finance_check ?? null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["batches"] });
      queryClient.invalidateQueries({ queryKey: ["finance-drafts"] });
    },
  });
}

export function useFacultyList(params?: { domain?: string }) {
  return useQuery({
    queryKey: ["faculty-list", params],
    queryFn: () => api.getFacultyList(params),
  });
}

export function useFacultyUtilization() {
  return useQuery({
    queryKey: ["faculty-utilization"],
    queryFn: () => api.getFacultyUtilization(),
  });
}

export function useSessions(params?: { batch_id?: string }) {
  return useQuery({
    queryKey: ["sessions", params],
    queryFn: () => api.getSessions(params),
  });
}

export function useUsers() {
  return useQuery({
    queryKey: ["users"],
    queryFn: () => api.getUsers(),
  });
}

export function useCoordinators() {
  return useQuery({
    queryKey: ["coordinators"],
    queryFn: () => api.getCoordinators(),
  });
}

export function useBatchOptions(type: string) {
  return useQuery({
    queryKey: ["batch-options", type],
    queryFn: () => api.getBatchOptions(type as any),
  });
}