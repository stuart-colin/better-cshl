import { queryOptions } from "@tanstack/react-query";
import { api } from "./api";

export const divisionsListQuery = () =>
  queryOptions({
    queryKey: ["divisions"],
    queryFn: api.listDivisions,
    staleTime: 1000 * 60 * 5,
  });

export const divisionQuery = (slug: string) =>
  queryOptions({
    queryKey: ["division", slug],
    queryFn: () => api.getDivision(slug),
    staleTime: 1000 * 60 * 2,
  });

export const teamQuery = (slug: string) =>
  queryOptions({
    queryKey: ["team", slug],
    queryFn: () => api.getTeam(slug),
    staleTime: 1000 * 60 * 10,
  });
