const GEOAPIFY_KEY = "85752f6b123847c2950125a5b3c9acae";

export type GeoLocation = {
  lat: number;
  lng: number;
  city: string;
  country: string;
};

/**
 * Calls Geoapify reverse geocoding API to resolve coordinates to a city and country.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<GeoLocation> {
  const res = await fetch(
    `https://api.geoapify.com/v1/geocode/reverse?lat=${lat}&lon=${lng}&apiKey=${GEOAPIFY_KEY}`
  );
  if (!res.ok) throw new Error("Reverse geocoding failed");
  const data = await res.json();
  const prop = data.features?.[0]?.properties;
  return {
    lat,
    lng,
    city: prop?.city || prop?.town || prop?.village || "Unknown City",
    country: prop?.country || "Unknown Country",
  };
}

/**
 * Calls Geoapify search/autocomplete API to search for coordinates by city name.
 */
export async function searchLocation(query: string): Promise<GeoLocation[]> {
  if (!query.trim()) return [];
  const res = await fetch(
    `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(query)}&apiKey=${GEOAPIFY_KEY}`
  );
  if (!res.ok) throw new Error("Geocoding search failed");
  const data = await res.json();
  return (data.features || []).map((f: any) => ({
    lat: f.properties.lat,
    lng: f.properties.lon,
    city: f.properties.city || f.properties.town || f.properties.name || "Unknown",
    country: f.properties.country || "Unknown",
  }));
}
