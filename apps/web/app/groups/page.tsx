import type { Metadata } from "next";

import { GroupsScreen } from "../../components/groups/GroupsScreen";

export const metadata: Metadata = {
  title: "Groups — Traveller",
  description: "Put your friends' travel maps together.",
};

export default function GroupsPage() {
  return (
    <main className="min-h-dvh w-full">
      <GroupsScreen />
    </main>
  );
}
