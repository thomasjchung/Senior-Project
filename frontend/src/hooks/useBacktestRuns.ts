import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { deleteRun, getRun, listRuns, updateRun } from "../api/backtest";

export const RUNS_KEY = ["backtest-runs"];

export function useBacktestRuns() {
  return useQuery({ queryKey: RUNS_KEY, queryFn: listRuns });
}

export function useBacktestRun(id: number | null) {
  return useQuery({
    queryKey: [...RUNS_KEY, id],
    queryFn: () => getRun(id!),
    enabled: id != null,
    staleTime: Infinity, // a run's settings and result never change (only its notes)
  });
}

export function useUpdateRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: number; notes?: string; name?: string }) => updateRun(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: RUNS_KEY }),
  });
}

export function useDeleteRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteRun,
    onSuccess: () => qc.invalidateQueries({ queryKey: RUNS_KEY }),
  });
}
