import type { Metadata } from "next";

import { GroupScreen } from "../../../components/groups/GroupScreen";

export const metadata: Metadata = {
  title: "Group — Traveller",
  description: "Your group's travel map and stats.",
};

export default async function GroupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <main className="min-h-dvh w-full">
      <GroupScreen id={id} />
    </main>
  );
}
