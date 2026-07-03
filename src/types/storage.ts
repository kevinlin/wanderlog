// Storage-related types for Wanderlog Travel Journal

// Kept for the Firestore-to-Supabase migration script and legacy firebaseService
export interface UserModifications {
  activityOrders: Record<string, number[]>; // baseId -> ordered activity indices
  activityStatus: Record<string, boolean>; // activityId -> done status
  lastViewedBase?: string;
  lastViewedDate?: string;
}
