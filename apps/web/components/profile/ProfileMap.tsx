"use client";

import { COUNTRY_CENTROIDS } from "@traveller/shared";
import { useCallback, useRef, useState } from "react";

import { type WorldStats } from "../../lib/stats";
import { type FlyToRequest, MapCanvas } from "../map/MapCanvas";
import { ProfileCountries } from "./ProfileCountries";

/**
 * The read-only profile map, its stats card and the country list the card
 * opens. Picking a country in
 * the list outlines it and flies the camera there.
 */
export function ProfileMap({
  username,
  countryCodes,
  stats,
}: {
  username: string;
  countryCodes: string[];
  stats: WorldStats;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [flyTo, setFlyTo] = useState<FlyToRequest | null>(null);
  const nextId = useRef(1);

  const pick = useCallback((iso: string) => {
    setSelected(iso);
    const centroid = COUNTRY_CENTROIDS[iso];
    if (!centroid) return;
    const [lng, lat, zoom] = centroid;
    setFlyTo({ center: [lng, lat], zoom, id: nextId.current++ });
  }, []);

  return (
    <>
      <div className="absolute inset-0">
        <MapCanvas
          visited={countryCodes}
          selected={selected}
          flyTo={flyTo}
          readonly
          showProjectionToggle
        />
      </div>
      <ProfileCountries
        username={username}
        countryCodes={countryCodes}
        stats={stats}
        selected={selected}
        onPick={pick}
      />
    </>
  );
}
