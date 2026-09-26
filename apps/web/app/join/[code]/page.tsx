import type { Metadata } from "next";

import { JoinGroupScreen } from "../../../components/groups/JoinGroupScreen";

export const metadata: Metadata = {
  title: "Join a group — Traveller",
  description: "You've been invited to a Traveller group.",
};

export default async function JoinPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return (
    <main className="min-h-dvh w-full">
      <JoinGroupScreen code={code} />
    </main>
  );
}
