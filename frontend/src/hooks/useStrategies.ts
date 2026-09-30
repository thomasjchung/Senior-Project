import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listStrategies, createStrategy, updateStrategy, deleteStrategy } from "../api/strategies";
import type { StrategyConfig } from "../types/strategy";

export function useStrategies() {
  return useQuery({
    queryKey: ["strategies"],
    queryFn: listStrategies,
  });
}

export function useCreateStrategy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, config }: { name: string; config: StrategyConfig }) =>
      createStrategy(name, config),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["strategies"] }),
  });
}

export function useUpdateStrategy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name, config }: { id: number; name: string; config: StrategyConfig }) =>
      updateStrategy(id, name, config),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["strategies"] }),
  });
}

export function useDeleteStrategy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteStrategy(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["strategies"] }),
  });
}
