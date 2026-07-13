import type { Metadata } from "next";

import { FriendsScreen } from "../../components/social/FriendsScreen";

export const metadata: Metadata = {
  title: "Friends — Traveller",
  description: "Find friends and compare travel maps.",
};

export default function FriendsPage() {
  return (
    <main className="min-h-dvh w-full">
      <FriendsScreen />
    </main>
  );
}
