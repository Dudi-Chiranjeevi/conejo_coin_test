export type LocationType = "site" | "room" | "shelf" | "row" | "box" | "slot";

export interface Location {
  id: string;
  name: string;
  type: LocationType;
  parent: string | null;      // DRF will return null or a UUID
  client_id: string;
  capacity?: number | null;
  path: string;
  created_at: string;
  updated_at: string;
  identification_number?: string;  // For slots, this is the display number
}

export interface LocationTreeNode {
  id: string;
  name: string;
  type: LocationType;
  parent_id: string | null;
  capacity?: number | null;
  path: string;
  children: LocationTreeNode[];
}