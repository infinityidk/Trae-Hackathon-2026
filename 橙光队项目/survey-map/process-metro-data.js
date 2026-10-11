const https = require('https');
const fs = require('fs');
const path = require('path');

const OVERPASS_APIS = [
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass-api.de/api/interpreter'
];
const BBOX = '22.4,113.7,22.9,114.7';
const OUTPUT_DIR = path.join(__dirname, 'data', 'accessibility');

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
        const req = https.request(options, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 504 || res.statusCode === 429) {
                    fetchOverpass(query, apiIndex + 1).then(resolve).catch(reject);
                    return;
                }
                if (res.statusCode !== 200) {
                    reject(new Error(`HTTP ${res.statusCode}`));
                    return;
                }
                try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
            });
        });
        req.on('error', () => fetchOverpass(query, apiIndex + 1).then(resolve).catch(reject));
        req.setTimeout(180000, () => { req.destroy(); fetchOverpass(query, apiIndex + 1).then(resolve).catch(reject); });
        req.write(postData);
        req.end();
    });
}

function normalizeStationName(name) {
    return name
        .replace(/站$/, '')
        .replace(/[\s\-_]/g, '')
        .replace(/[（）()]/g, '')
        .trim();
}

async function main() {
    console.log('Step 1: Fetching metro station coordinates from OSM...');
    let stations = [];
    try {
        const result = await fetchOverpass(`
[out:json][timeout:60];
(
  node["railway"="station"](${BBOX});
  node["public_transport"="station"]["station"="subway"](${BBOX});
);
out body;
`);
        stations = result.elements.filter(el => el.tags && el.tags.name);
        console.log(`  Found ${stations.length} metro stations from OSM`);
    } catch (e) {
        console.error('  Failed to fetch OSM stations:', e.message);
        console.error('  Will try to use existing data without coordinates');
    }

    const stationMap = {};
    stations.forEach(s => {
        const name = normalizeStationName(s.tags.name);
        const nameZh = s.tags['name:zh'] ? normalizeStationName(s.tags['name:zh']) : null;
        stationMap[name] = { lat: s.lat, lon: s.lon, name: s.tags.name };
        if (nameZh && nameZh !== name) {
            stationMap[nameZh] = { lat: s.lat, lon: s.lon, name: s.tags.name };
        }
    });

    console.log('\nStep 2: Reading metro accessibility XLSX...');
    const XLSX = require('xlsx');
    const xlsxPath = path.join(__dirname, '深圳地铁站点无障碍设施位置清单.xlsx');

    if (!fs.existsSync(xlsxPath)) {
        console.error('  XLSX file not found:', xlsxPath);
        process.exit(1);
    }

    const wb = XLSX.readFile(xlsxPath);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

    const header = rows[0];
    console.log('  Headers:', JSON.stringify(header));
    console.log('  Total rows:', rows.length - 1);

    const colIndex = {};
    header.forEach((h, i) => {
        const hStr = String(h || '');
        if (hStr.includes('线路') || hStr.includes('线名')) colIndex.line = i;
        if (hStr.includes('站点') || hStr.includes('站名')) colIndex.station = i;
        if (hStr.includes('设施') || hStr.includes('位置') || hStr.includes('无障碍')) colIndex.facility = i;
    });

    console.log('  Column mapping:', JSON.stringify(colIndex));

    if (colIndex.station === undefined) {
        console.error('  Could not find station name column');
        process.exit(1);
    }

    const features = [];
    let matched = 0;
    let unmatched = 0;

    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;

        const stationName = String(row[colIndex.station] || '').trim();
        const lineName = colIndex.line !== undefined ? String(row[colIndex.line] || '').trim() : '';
        const facility = colIndex.facility !== undefined ? String(row[colIndex.facility] || '').trim() : '';

        if (!stationName) continue;

        const normalizedName = normalizeStationName(stationName);
        const stationInfo = stationMap[normalizedName];

        if (stationInfo) {
            matched++;
            features.push({
                type: 'Feature',
                properties: {
                    name: `${stationName} - 无障碍设施`,
                    station: stationName,
                    line: lineName,
                    facility: facility,
                    type: '地铁站无障碍设施',
                    _source: 'sz_metro',
                    _osm_type: 'node'
                },
                geometry: {
                    type: 'Point',
                    coordinates: [stationInfo.lon, stationInfo.lat]
                }
            });
        } else {
            unmatched++;
            if (unmatched <= 10) {
                console.log(`  Unmatched: "${stationName}" (normalized: "${normalizedName}")`);
            }
        }
    }

    console.log(`\n  Matched: ${matched}, Unmatched: ${unmatched}`);

    if (features.length === 0) {
        console.error('  No features generated');
        process.exit(1);
    }

    const geojson = { type: 'FeatureCollection', features };
    const outputPath = path.join(OUTPUT_DIR, 'metro_accessibility.geojson');
    fs.writeFileSync(outputPath, JSON.stringify(geojson, null, 2), 'utf-8');
    console.log(`  Saved ${features.length} features to metro_accessibility.geojson`);

    console.log('\nStep 3: Merging with wheelchair_toilets...');
    try {
        const toiletsPath = path.join(OUTPUT_DIR, 'wheelchair_toilets.geojson');
        const existing = JSON.parse(fs.readFileSync(toiletsPath, 'utf-8'));
        const merged = {
            type: 'FeatureCollection',
            features: [...existing.features, ...features]
        };
        fs.writeFileSync(toiletsPath, JSON.stringify(merged, null, 2), 'utf-8');
        console.log(`  wheelchair_toilets: ${existing.features.length} → ${merged.features.length}`);
    } catch (e) {
        console.error('  Merge failed:', e.message);
    }

    console.log('\nDone!');
}

main();
