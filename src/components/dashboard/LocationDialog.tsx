import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { MapPin, Navigation, Search, HelpCircle, Loader2 } from "lucide-react";
import { reverseGeocode, searchLocation, type GeoLocation } from "@/lib/geo";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (loc: GeoLocation) => void;
  onCancel: () => void;
};

// Default location list for quick selection
const QUICK_LOCATIONS: GeoLocation[] = [
  { city: "New York", country: "US", lat: 40.7128, lng: -74.006 },
  { city: "London", country: "GB", lat: 51.5074, lng: -0.1278 },
  { city: "Tokyo", country: "JP", lat: 35.6762, lng: 139.6503 },
  { city: "Kolkata", country: "IN", lat: 22.5726, lng: 88.3639 },
  { city: "São Paulo", country: "BR", lat: -23.5505, lng: -46.6333 },
];

export function LocationDialog({ open, onOpenChange, onConfirm, onCancel }: Props) {
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GeoLocation[]>([]);
  const [searching, setSearching] = useState(false);

  const handleBrowserLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }

    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude: lat, longitude: lng } = position.coords;
          const loc = await reverseGeocode(lat, lng);
          onConfirm(loc);
          toast.success(`Location resolved: ${loc.city}, ${loc.country}`);
        } catch (err) {
          console.error(err);
          toast.error("Failed to reverse-geocode coordinates. Using default.");
          // fallback to London
          onConfirm({ city: "London", country: "GB", lat: 51.5074, lng: -0.1278 });
        } finally {
          setLoading(false);
        }
      },
      (error) => {
        console.error(error);
        setLoading(false);
        toast.warning("Location access denied or timed out. Please enter manually.");
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearching(true);
    try {
      const results = await searchLocation(searchQuery);
      setSearchResults(results);
      if (results.length === 0) {
        toast.info("No matching locations found.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to search location.");
    } finally {
      setSearching(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => {
      onOpenChange(val);
      if (!val) onCancel();
    }}>
      <DialogContent className="glass border-border/80 text-foreground max-w-md p-6 rounded-2xl shadow-2xl bg-black/80 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold tracking-tight text-white">
            <MapPin className="text-primary animate-pulse" size={20} />
            Verify Sighting Location
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm mt-1">
            Sentinel logs coordinates for scanning signatures. Please select where this asset was sighted.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Geolocation Button */}
          <button
            onClick={handleBrowserLocation}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl border border-primary/20 bg-primary/10 hover:bg-primary/20 text-primary-foreground font-semibold text-sm transition-all hover:scale-[1.01] active:scale-95 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="animate-spin" size={16} />
            ) : (
              <Navigation size={16} />
            )}
            Use Device Location
          </button>

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-border"></div>
            <span className="flex-shrink mx-4 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">OR</span>
            <div className="flex-grow border-t border-border"></div>
          </div>

          {/* Search Input Form */}
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 text-muted-foreground" size={16} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search city, e.g. Paris, Berlin"
                className="w-full rounded-xl bg-white/5 border border-border px-9 py-2 text-sm text-white placeholder:text-muted-foreground/60 outline-none focus:border-primary/50 transition-colors"
              />
            </div>
            <button
              type="submit"
              disabled={searching || !searchQuery.trim()}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-sm border border-border transition-colors disabled:opacity-50"
            >
              {searching ? <Loader2 className="animate-spin" size={16} /> : "Search"}
            </button>
          </form>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="max-h-40 overflow-y-auto rounded-xl border border-border bg-black/40 divide-y divide-border">
              {searchResults.map((loc, i) => (
                <button
                  key={i}
                  onClick={() => onConfirm(loc)}
                  className="w-full text-left px-4 py-2.5 text-xs text-muted-foreground hover:text-white hover:bg-white/5 transition-colors flex items-center justify-between"
                >
                  <span>{loc.city}, {loc.country}</span>
                  <span className="font-mono text-[9px] opacity-50">
                    {loc.lat.toFixed(2)}, {loc.lng.toFixed(2)}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Quick/Curated Locations */}
          <div className="space-y-1.5">
            <div className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground flex items-center gap-1">
              <HelpCircle size={10} /> Quick Sighting Regions
            </div>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_LOCATIONS.map((loc) => (
                <button
                  key={loc.city}
                  onClick={() => onConfirm(loc)}
                  className="px-3 py-1.5 rounded-lg border border-border hover:border-primary/30 bg-white/5 hover:bg-white/10 text-xs font-medium text-muted-foreground hover:text-white transition-all"
                >
                  {loc.city} ({loc.country})
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={() => onConfirm(QUICK_LOCATIONS[0])}
            className="px-4 py-2 rounded-xl text-xs text-muted-foreground hover:text-white transition-colors"
          >
            Skip / Use Default
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
