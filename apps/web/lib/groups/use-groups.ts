"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type GroupDetail } from "@traveller/shared";

import { api } from "../api-client";
import { describeMutationError } from "../errors";
import { pushErrorToast, pushSuccessToast } from "../stores/toast-store";

export const MY_GROUPS_QUERY_KEY = ["groups", "mine"] as const;

export function groupQueryKey(id: string) {
  return ["groups", "detail", id] as const;
}

export function inviteQueryKey(code: string) {
  return ["groups", "invite", code] as const;
}

export function useMyGroups(enabled: boolean) {
  return useQuery({
    queryKey: MY_GROUPS_QUERY_KEY,
    queryFn: api.getMyGroups,
    enabled,
  });
}

export function useGroup(id: string, enabled: boolean) {
  return useQuery({
    queryKey: groupQueryKey(id),
    queryFn: () => api.getGroup(id),
    enabled,
    retry: false,
  });
}

export function useGroupInvite(code: string, enabled: boolean) {
  return useQuery({
    queryKey: inviteQueryKey(code),
    queryFn: () => api.getGroupInvite(code),
    enabled,
    retry: false,
  });
}

/**
 * Mutations that return the updated group: prime its detail cache and
 * refresh the "my groups" list.
 */
function useGroupDetailMutation<Variables>(
  mutationFn: (variables: Variables) => Promise<GroupDetail>,
  failure: string,
  success?: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (group) => {
      queryClient.setQueryData(groupQueryKey(group.id), group);
      void queryClient.invalidateQueries({ queryKey: MY_GROUPS_QUERY_KEY });
      if (success) pushSuccessToast(success);
    },
    onError: (error) => pushErrorToast(describeMutationError(error, failure)),
  });
}

export function useCreateGroup() {
  return useGroupDetailMutation(
    (name: string) => api.createGroup(name),
    "Couldn’t create the group — try again.",
  );
}

export function useRenameGroup(id: string) {
  return useGroupDetailMutation(
    (name: string) => api.renameGroup(id, name),
    "Couldn’t rename the group.",
    "Group renamed.",
  );
}

export function useRotateInvite(id: string) {
  return useGroupDetailMutation(
    (_: void) => api.rotateGroupInvite(id),
    "Couldn’t reset the invite link.",
    "New invite link ready — the old one no longer works.",
  );
}

export function useAddGroupMember(id: string) {
  return useGroupDetailMutation(
    (username: string) => api.addGroupMember(id, username),
    "Couldn’t add them — the group may be full.",
  );
}

/** Remove a member (owner) or leave (self). */
export function useRemoveGroupMember(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (username: string) => api.removeGroupMember(id, username),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: groupQueryKey(id) });
      void queryClient.invalidateQueries({ queryKey: MY_GROUPS_QUERY_KEY });
    },
    onError: (error) =>
      pushErrorToast(describeMutationError(error, "Couldn’t do that — try again.")),
  });
}

export function useDeleteGroup(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.deleteGroup(id),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: groupQueryKey(id) });
      void queryClient.invalidateQueries({ queryKey: MY_GROUPS_QUERY_KEY });
      pushSuccessToast("Group deleted.");
    },
    onError: (error) =>
      pushErrorToast(describeMutationError(error, "Couldn’t delete the group.")),
  });
}

export function useJoinGroup(code: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.joinGroup(code),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: MY_GROUPS_QUERY_KEY });
    },
    onError: (error) =>
      pushErrorToast(
        describeMutationError(error, "Couldn’t join — the group may be full."),
      ),
  });
}
