interface RepresentativeMapPoint {
  latitude: number;
  longitude: number;
}

// JPMD publishes a WKT POLYGON per monitoring point describing the official measurement ZONE. It
// does not publish a sampling coordinate: the gSirina/gDuzina fields exist in the payload but are
// null in every record, so they are deliberately neither persisted nor read anywhere.
//
// The point derived here is ONLY a map focus for that zone — it is the polygon's first vertex, so
// it is an actual official coordinate lying on the zone's own boundary rather than an averaged or
// bounding-box position. It must never be presented, named or marked up as the place the sample
// was taken; the copy says "zona" for exactly this reason.
const polygonFirstVertexPattern = /^\s*POLYGON\s*\(\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/iu;

function getRepresentativeMapPoint(officialGeometry?: string): RepresentativeMapPoint | undefined {
  if (!officialGeometry) return undefined;

  // Only the one shape JPMD actually publishes. MULTIPOLYGON, POINT, LINESTRING and malformed
  // input all fall through to undefined rather than being guessed at.
  const match = polygonFirstVertexPattern.exec(officialGeometry);
  if (!match) return undefined;

  // WKT orders coordinates longitude first — reversing these would put every Montenegrin zone in
  // Somalia, which is precisely the kind of silent error worth naming here.
  const longitude = Number(match[1]);
  const latitude = Number(match[2]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return undefined;
  if (latitude < -90 || latitude > 90) return undefined;
  if (longitude < -180 || longitude > 180) return undefined;

  return { latitude, longitude };
}

function getSeaWaterQualityMapUrl(officialGeometry?: string) {
  const point = getRepresentativeMapPoint(officialGeometry);
  if (!point) return undefined;

  return `https://www.google.com/maps/search/?api=1&query=${point.latitude},${point.longitude}`;
}

export { getRepresentativeMapPoint, getSeaWaterQualityMapUrl, type RepresentativeMapPoint };
