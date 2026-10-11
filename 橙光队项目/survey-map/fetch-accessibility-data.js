const https = require('https');
const fs = require('fs');
const path = require('path');

const OVERPASS_APIS = [
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass-api.de/api/interpreter'
];
const OUTPUT_DIR = path.join(__dirname, 'data', 'accessibility');
const BBOX = '22.4,113.7,22.9,114.7';

function fetchOverpass(query, apiIndex = 0) {
    return new Promise((resolve, reject) => {
        if (apiIndex >= OVERPASS_APIS.length) {
            reject(new Error('All Overpass API instances failed'));
            return;
        }

        const apiUrl = OVERPASS_APIS[apiIndex];
        const postData = 'data=' + encodeURIComponent(query);
        const url = new URL(apiUrl);
        const options = {
            hostname: url.hostname,
            path: url.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(postData),
                'User-Agent': 'survey-map/1.0',
                'Accept': 'application/json'
            }
        };

        console.log(`  API: ${url.hostname}...`);

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 504 || res.statusCode === 429) {
                    console.log(`  HTTP ${res.statusCode}, trying next...`);
                    fetchOverpass(query, apiIndex + 1).then(resolve).catch(reject);
                    return;
                }
                if (res.statusCode !== 200) {
                    reject(new Error(`HTTP ${res.statusCode}: ${data.substring(0, 200)}`));
                    return;
                }
                try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
            });
        });

        req.on('error', (err) => {
            console.log(`  Error: ${err.message}, trying next...`);
            fetchOverpass(query, apiIndex + 1).then(resolve).catch(reject);
        });

        req.setTimeout(180000, () => {
            req.destroy();
            console.log(`  Timeout, trying next...`);
            fetchOverpass(query, apiIndex + 1).then(resolve).catch(reject);
        });

        req.write(postData);
        req.end();
    });
}

function osmToGeoJSON(osmData) {
    const features = [];
    const nodes = {};

    if (osmData.elements) {
        osmData.elements.forEach(el => {
            if (el.type === 'node') {
                nodes[el.id] = [el.lon, el.lat];
                if (el.tags) {
                    features.push({
                        type: 'Feature',
                        properties: { ...el.tags, _osm_id: el.id, _osm_type: 'node' },
                        geometry: { type: 'Point', coordinates: [el.lon, el.lat] }
                    });
                }
            }
        });

        osmData.elements.forEach(el => {
            if (el.type === 'way' && el.nodes) {
                const coords = el.nodes.map(nid => nodes[nid]).filter(Boolean);
                if (coords.length < 2) return;

                const isArea = el.tags && (
                    el.tags.building || el.tags.area === 'yes' || el.tags.landuse || el.tags.leisure
                );

                features.push({
                    type: 'Feature',
                    properties: { ...el.tags, _osm_id: el.id, _osm_type: 'way' },
                    geometry: {
                        type: isArea && coords[0][0] === coords[coords.length - 1][0] && coords[0][1] === coords[coords.length - 1][1]
                            ? 'Polygon' : 'LineString',
                        coordinates: isArea && coords[0][0] === coords[coords.length - 1][0] ? [coords] : coords
                    }
                });
            }
        });
    }

    return { type: 'FeatureCollection', features };
}

async function fetchAndSave(name, query) {
    console.log(`\nFetching ${name}...`);
    try {
        const osmData = await fetchOverpass(query);
        const geojson = osmToGeoJSON(osmData);
        const outputPath = path.join(OUTPUT_DIR, `${name}.geojson`);
        fs.writeFileSync(outputPath, JSON.stringify(geojson, null, 2), 'utf-8');
        console.log(`  ✓ ${name}: ${geojson.features.length} features saved`);
        return geojson.features.length;
    } catch (err) {
        console.error(`  ✗ ${name}: ${err.message}`);
        return 0;
    }
}

async function main() {
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    await fetchAndSave('wheelchair_toilets', `
[out:json][timeout:120];
(
  nwr["amenity"="toilets"]["wheelchair"](${BBOX});
  nwr["toilets:wheelchair"="yes"](${BBOX});
  nwr["toilets:wheelchair"="limited"](${BBOX});
  nwr["toilets:wheelchair"="designated"](${BBOX});
);
out body;
>;
out skel qt;`);

    await new Promise(r => setTimeout(r, 8000));

    await fetchAndSave('wheelchair_poi', `
[out:json][timeout:180];
(
  nwr["wheelchair"="yes"](${BBOX});
);
out body;
>;
out skel qt;`);

    await new Promise(r => setTimeout(r, 8000));

    await fetchAndSave('wheelchair_poi_limited', `
[out:json][timeout:120];
(
  nwr["wheelchair"="limited"](${BBOX});
  nwr["wheelchair"="designated"](${BBOX});
);
out body;
>;
out skel qt;`);

    console.log('\nMerging wheelchair_poi + wheelchair_poi_limited...');
    try {
        const poi = JSON.parse(fs.readFileSync(path.join(OUTPUT_DIR, 'wheelchair_poi.geojson'), 'utf-8'));
        const poiLimited = JSON.parse(fs.readFileSync(path.join(OUTPUT_DIR, 'wheelchair_poi_limited.geojson'), 'utf-8'));
        const merged = {
            type: 'FeatureCollection',
            features: [...poi.features, ...poiLimited.features]
        };
        const seen = new Set();
        merged.features = merged.features.filter(f => {
            const key = f.properties._osm_id + '_' + f.properties._osm_type;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
        fs.writeFileSync(path.join(OUTPUT_DIR, 'wheelchair_poi.geojson'), JSON.stringify(merged, null, 2), 'utf-8');
        console.log(`  ✓ Merged wheelchair_poi: ${merged.features.length} features`);
        fs.unlinkSync(path.join(OUTPUT_DIR, 'wheelchair_poi_limited.geojson'));
    } catch (e) {
        console.error('  ✗ Merge failed:', e.message);
    }

    console.log('\nDone!');
}

main();
