import { CountryDetailSheet } from "../components/country-panel/CountryDetailSheet";
import { CountryPanel } from "../components/country-panel/CountryPanel";
import { LandingHero } from "../components/map/LandingHero";
import { MapView } from "../components/map/MapView";
import { StatsBar } from "../components/stats/StatsBar";

export default function HomePage() {
  return (
    <main className="relative h-dvh w-full overflow-hidden">
      <MapView />
      <LandingHero />
      <CountryPanel />
      <StatsBar />
      <CountryDetailSheet />
    </main>
  );
}
