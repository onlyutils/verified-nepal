"""Fetch + simplify the geometry the map needs. Run manually; outputs are committed.

Sources:
  rivers    OpenStreetMap via Overpass API (ODbL)
  districts dataofsandy/Nepal-GEOJSON (province3.geojson = Bagmati)
"""
import json, math, urllib.request, pathlib

OUT = pathlib.Path(__file__).resolve().parent.parent / "public/data/geo"
OVERPASS = "https://overpass-api.de/api/interpreter"
DISTRICT_NE = {"Rasuwa": "रसुवा", "Nuwakot": "नुवाकोट", "Sindhupalchok": "सिन्धुपाल्चोक"}
DISTRICT_FILE = {"Rasuwa": "RASUWA", "Nuwakot": "NUWAKOT", "Sindhupalchok": "SINDHUPALCHOK"}


def get(url, data=None):
    req = urllib.request.Request(url, data=data, headers={"User-Agent": "verifiednepal-geo/1"})
    with urllib.request.urlopen(req, timeout=180) as r:
        return json.load(r)


def rdp(points, eps):
    """Ramer-Douglas-Peucker on [lon, lat] pairs."""
    if len(points) < 3:
        return points
    a, b = points[0], points[-1]
    dx, dy = b[0] - a[0], b[1] - a[1]
    den = math.hypot(dx, dy)
    idx, far = 0, -1.0
    for i in range(1, len(points) - 1):
        p = points[i]
        d = (abs(dy * p[0] - dx * p[1] + b[0] * a[1] - b[1] * a[0]) / den) if den else math.hypot(p[0] - a[0], p[1] - a[1])
        if d > far:
            idx, far = i, d
    if far <= eps:
        return [a, b]
    return rdp(points[: idx + 1], eps)[:-1] + rdp(points[idx:], eps)


def chain(ways):
    """Stitch OSM ways head-to-tail into one ordered polyline."""
    segs = [[(p["lon"], p["lat"]) for p in w["geometry"]] for w in ways]
    line = segs.pop(0)
    changed = True
    while segs and changed:
        changed = False
        for i, s in enumerate(segs):
            if s[0] == line[-1]:
                line += s[1:]
            elif s[-1] == line[0]:
                line = s[:-1] + line
            elif s[-1] == line[-1]:
                line += s[::-1][1:]
            elif s[0] == line[0]:
                line = s[::-1][:-1] + line
            else:
                continue
            segs.pop(i)
            changed = True
            break
    # A few stub ways branch off the main stem; a big leftover means the chain broke.
    left = sum(len(s) for s in segs)
    if left:
        print(f"  note: {len(segs)} unchained segment(s), {left} points dropped")
    if left > len(line) * 0.1:
        raise SystemExit("river ways did not chain into one line")
    return [list(p) for p in line]


def build_river():
    q = ('[out:json][timeout:120];way["waterway"="river"]'
         '["name"~"Bhote Koshi|भोटे ?कोशी|Trishuli Ganga|Trishuli River|东林藏布"](27.85,85.00,28.45,85.60);out geom;')
    ways = get(OVERPASS, q.encode())["elements"]
    line = rdp(chain(ways), 0.0004)
    fc = {
        "type": "FeatureCollection",
        "attribution": "© OpenStreetMap contributors (ODbL)",
        "features": [{
            "type": "Feature",
            "properties": {
                "name": "Bhote Koshi → Trishuli",
                "name_ne": "भोटेकोशी → त्रिशूली",
                "note": "Flash-flood corridor: Rasuwagadhi to Bidur",
            },
            "geometry": {"type": "LineString", "coordinates": line},
        }],
    }
    (OUT / "bhotekoshi.json").write_text(json.dumps(fc, separators=(",", ":")))
    print("river", len(line), "points")


def build_districts():
    """Bagmati province (province 3) carries one dissolved polygon per district."""
    src = get("https://raw.githubusercontent.com/dataofsandy/Nepal-GEOJSON/main/province3.geojson")
    by_name = {f["properties"]["DIST_NAME"]: f for f in src["features"]}
    features = []
    for key in DISTRICT_FILE:
        geom = by_name[key.upper()]["geometry"]
        polys = geom["coordinates"] if geom["type"] == "MultiPolygon" else [geom["coordinates"]]
        rings = [rdp([list(p) for p in poly[0]], 0.0012) for poly in polys]
        features.append({
            "type": "Feature",
            "properties": {"name": key, "name_ne": DISTRICT_NE[key]},
            "geometry": {"type": "MultiPolygon", "coordinates": [[r] for r in rings]},
        })
        pts = [p for r in rings for p in r]
        print(key, len(rings), "ring(s)", len(pts), "points",
              "lon", round(min(p[0] for p in pts), 3), round(max(p[0] for p in pts), 3),
              "lat", round(min(p[1] for p in pts), 3), round(max(p[1] for p in pts), 3))
    fc = {"type": "FeatureCollection",
          "attribution": "dataofsandy/Nepal-GEOJSON district boundaries",
          "features": features}
    (OUT / "districts.json").write_text(json.dumps(fc, separators=(",", ":")))


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    build_river()
    build_districts()
