import { LocationManagerDashboard } from "./components/location-manager-dashboard";

// TODO: plug in your real client id
const DEFAULT_CLIENT_ID = "e9f3a0d4-0b71-4728-b131-ec7bc71e902d";

export default function LocationsPage() {
  return (
    <div className="h-[calc(100vh-4rem)]">
      <LocationManagerDashboard clientId={DEFAULT_CLIENT_ID} />
    </div>
  );
}
