/**
 * Calculates the great-circle distance between two points on the Earth's surface
 * using the Haversine formula.
 *
 * @param lat1 Latitude of origin point in decimal degrees
 * @param lon1 Longitude of origin point in decimal degrees
 * @param lat2 Latitude of destination point in decimal degrees
 * @param lon2 Longitude of destination point in decimal degrees
 * @returns Distance in meters
 */
export function calculateHaversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const EARTH_RADIUS_METERS = 6371000; // Earth mean radius in meters

  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const lat1Rad = toRadians(lat1);
  const lat2Rad = toRadians(lat2);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1Rad) * Math.cos(lat2Rad);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(EARTH_RADIUS_METERS * c * 100) / 100;
}

/**
 * Checks if a given point is within the allowed geofence radius of a target location.
 *
 * @param currentLat Current latitude
 * @param currentLon Current longitude
 * @param targetLat Target latitude
 * @param targetLon Target longitude
 * @param allowedRadiusMeters Allowed radius in meters
 * @returns Object with distance in meters and isViolation flag
 */
export function verifyGeofence(
  currentLat: number,
  currentLon: number,
  targetLat: number,
  targetLon: number,
  allowedRadiusMeters: number
): { distanceMeters: number; isViolation: boolean } {
  const distanceMeters = calculateHaversineDistanceMeters(
    currentLat,
    currentLon,
    targetLat,
    targetLon
  );

  return {
    distanceMeters,
    isViolation: distanceMeters > allowedRadiusMeters,
  };
}
