const https = require('https');
const fs = require('fs');
const path = require('path');

const AMAP_API_KEY = process.env.AMAP_KEY || '';
const OUTPUT_DIR = path.join(__dirname, 'data', 'accessibility');

const KEYWORDS = [
    '无障碍卫生间',
    '残疾人卫生间',
    '无障碍洗手间',
    '第三卫生间',
    '母婴室',
    '无障碍电梯',
    '无障碍通道',
    '无障碍坡道',
    'AED'
];

const CITY = '深圳';
const CITYLIMIT = true;

function fetchAmapPOI(keyword, page = 1) {
    return new Promise((resolve, reject) => {
        const params = new URLSearchParams({
            key: AMAP_API_KEY,
            keywords: keyword,
            city: CITY,
            citylimit: CITYLIMIT ? 'true' : 'false',
            offset: 25,
            page: page,
            extensions: 'all'
        });

        const url = `https://restapi.amap.com/v3/place/text?${params.toString()}`;

        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.status === '1') {
                        resolve(json);
                    } else {
                        reject(new Error(`API error: ${json.info} (infocode: ${json.infocode})`));
                    }
                } catch (e) {
                    reject(new Error(`JSON parse error: ${e.message}`));
                }
            });
        }).on('error', reject);
    });
}

function amapPOIToGeoJSON(pois, keyword) {
    return pois.map(poi => {
        const location = poi.location ? poi.location.split(',') : [0, 0];
        return {
            type: 'Feature',
            properties: {
                name: poi.name || '',
                address: poi.address || '',
                type: poi.type || '',
                typecode: poi.typecode || '',
                tel: poi.tel || '',
                _source: 'amap',
                _keyword: keyword,
                _amap_id: poi.id || ''
            },
            geometry: {
                type: 'Point',
                coordinates: [parseFloat(location[0]), parseFloat(location[1])]
            }
        };
    });
}

async function fetchAllPages(keyword) {
    let allPois = [];
    let page = 1;
    const maxPages = 40;

    while (page <= maxPages) {
        try {
            const result = await fetchAmapPOI(keyword, page);
            const pois = result.pois || [];
            if (pois.length === 0) break;

            allPois = allPois.concat(pois);
            console.log(`    Page ${page}: ${pois.length} POIs (total: ${allPois.length})`);

            const count = parseInt(result.count || '0');
            if (allPois.length >= count || pois.length < 25) break;

            page++;
            await new Promise(r => setTimeout(r, 200));
        } catch (err) {
            console.error(`    Page ${page} error: ${err.message}`);
            break;
        }
    }

    return allPois;
}

async function main() {
    if (!AMAP_API_KEY) {
        console.error('Error: AMAP_KEY not set.');
        console.error('Usage: AMAP_KEY=your_key node fetch-amap-data.js');
        console.error('Get your free key at: https://lbs.amap.com/');
        process.exit(1);
    }

    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    const allFeatures = [];
    const seenIds = new Set();

    for (const keyword of KEYWORDS) {
        console.log(`\nFetching: ${keyword}...`);
        try {
            const pois = await fetchAllPages(keyword);
            const features = amapPOIToGeoJSON(pois, keyword);

            let added = 0;
            features.forEach(f => {
                const key = f.properties._amap_id || (f.properties.name + '_' + f.geometry.coordinates.join(','));
                if (!seenIds.has(key)) {
                    seenIds.add(key);
                    allFeatures.push(f);
                    added++;
                }
            });

            console.log(`  ✓ ${keyword}: ${pois.length} fetched, ${added} new (deduped)`);
        } catch (err) {
            console.error(`  ✗ ${keyword}: ${err.message}`);
        }

        await new Promise(r => setTimeout(r, 500));
    }

    const geojson = {
        type: 'FeatureCollection',
        features: allFeatures
    };

    const outputPath = path.join(OUTPUT_DIR, 'amap_accessibility.geojson');
    fs.writeFileSync(outputPath, JSON.stringify(geojson, null, 2), 'utf-8');
    console.log(`\n✓ Saved ${allFeatures.length} POIs to ${outputPath}`);

    console.log('\nMerging with existing OSM data...');
    try {
        const toiletsPath = path.join(OUTPUT_DIR, 'wheelchair_toilets.geojson');
        const poiPath = path.join(OUTPUT_DIR, 'wheelchair_poi.geojson');

        const toilets = JSON.parse(fs.readFileSync(toiletsPath, 'utf-8'));
        const poi = JSON.parse(fs.readFileSync(poiPath, 'utf-8'));

        const amapToilets = allFeatures.filter(f =>
            f.properties._keyword && (
                f.properties._keyword.includes('卫生间') ||
                f.properties._keyword.includes('洗手间') ||
                f.properties._keyword.includes('第三卫生间')
            )
        );

        const amapPoi = allFeatures.filter(f =>
            f.properties._keyword && !(
                f.properties._keyword.includes('卫生间') ||
                f.properties._keyword.includes('洗手间') ||
                f.properties._keyword.includes('第三卫生间')
            )
        );

        const mergedToilets = {
            type: 'FeatureCollection',
            features: [...toilets.features, ...amapToilets]
        };

        const mergedPoi = {
            type: 'FeatureCollection',
            features: [...poi.features, ...amapPoi]
        };

        fs.writeFileSync(toiletsPath, JSON.stringify(mergedToilets, null, 2), 'utf-8');
        fs.writeFileSync(poiPath, JSON.stringify(mergedPoi, null, 2), 'utf-8');

        console.log(`  ✓ wheelchair_toilets: ${toilets.features.length} → ${mergedToilets.features.length}`);
        console.log(`  ✓ wheelchair_poi: ${poi.features.length} → ${mergedPoi.features.length}`);
    } catch (e) {
        console.error('  ✗ Merge failed:', e.message);
    }

    console.log('\nDone!');
}

main();
