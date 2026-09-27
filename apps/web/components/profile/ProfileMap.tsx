"use client";

import { COUNTRY_CENTROIDS } from "@traveller/shared";
import { useCallback, useRef, useState } from "react";

import { type FlyToRequest, MapCanvas } from "../map/MapCanvas";
import { ProfileCountries } from "./ProfileCountries";

/**
 * The read-only profile map plus its country list. Picking a country in
 * the list outlines it and flies the camera there.
 */
export function ProfileMap({
  username,
  countryCodes,
}: {
  username: string;
  countryCodes: string[];
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
        selected={selected}
        onPick={pick}
      />
    </>
  );
}
