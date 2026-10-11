/*
Copyright © 2025 Wayhhow. All rights reserved.
GitHub: https://github.com/Wayhhow
Project: 橙光队无障碍督导路线可视化
*/
/**
 * 地图管理模块
 * 负责地图初始化、路线渲染和交互处理
 */
class MapManager {
    constructor() {
        this.map = null;
        this.highlightedLayer = null;
        this.accessibilityLayers = {};
        this.dashOffset = 0;
        this.isZooming = false;
        this.dashAnimationId = null;
    }

    static WGS84_TO_GCJ02(lng, lat) {
        const a = 6378245.0;
        const ee = 0.00669342162296594323;
        let dLat = MapManager._transformLat(lng - 105.0, lat - 35.0);
        let dLng = MapManager._transformLng(lng - 105.0, lat - 35.0);
        const radLat = lat / 180.0 * Math.PI;
        let magic = Math.sin(radLat);
        magic = 1 - ee * magic * magic;
        const sqrtMagic = Math.sqrt(magic);
        dLat = (dLat * 180.0) / ((a * (1 - ee)) / (magic * sqrtMagic) * Math.PI);
        dLng = (dLng * 180.0) / (a / sqrtMagic * Math.cos(radLat) * Math.PI);
        return [lng + dLng, lat + dLat];
    }

    static _transformLat(x, y) {
        let ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
        ret += (20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0 / 3.0;
        ret += (20.0 * Math.sin(y * Math.PI) + 40.0 * Math.sin(y / 3.0 * Math.PI)) * 2.0 / 3.0;
        ret += (160.0 * Math.sin(y / 12.0 * Math.PI) + 320 * Math.sin(y * Math.PI / 30.0)) * 2.0 / 3.0;
        return ret;
    }

    static _transformLng(x, y) {
        let ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
        ret += (20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0 / 3.0;
        ret += (20.0 * Math.sin(x * Math.PI) + 40.0 * Math.sin(x / 3.0 * Math.PI)) * 2.0 / 3.0;
        ret += (150.0 * Math.sin(x / 12.0 * Math.PI) + 300.0 * Math.sin(x / 30.0 * Math.PI)) * 2.0 / 3.0;
        return ret;
    }

    static convertCoords(lng, lat) {
        if (lng >= 73.66 && lng <= 135.05 && lat >= 3.86 && lat <= 53.55) {
            return MapManager.WGS84_TO_GCJ02(lng, lat);
        }
        return [lng, lat];
    }

    /**
     * 初始化地图
     */
    initMap() {
        // 使用默认SVG渲染器(支持CSS动画)
        this.map = L.map('map').setView([39.9042, 116.4074], 12); // 默认北京坐标

        // 添加底图图层(高德地图，支持GCJ-02坐标系)
        L.tileLayer('https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}', {
            subdomains: '1234',
            maxZoom: 20,
            attribution: '高德地图'
        }).addTo(this.map);

        this.map.on('zoomstart', () => { this.isZooming = true; });
        this.map.on('zoomend', () => { this.isZooming = false; });

        console.log('地图初始化完成');
    }

    startDashAnimation() {
        const animate = () => {
            if (!this.isZooming) {
                this.dashOffset -= 0.25;
                if (window.routesLayer) {
                    window.routesLayer.eachLayer(layer => {
                        if (layer.setStyle) {
                            layer.setStyle({ dashOffset: this.dashOffset });
                        }
                    });
                }
            }
            this.dashAnimationId = requestAnimationFrame(animate);
        };
        animate();
    }

    /**
     * 绑定路线点击事件
     * @param {Object} feature - GeoJSON feature
     * @param {Object} layer - Leaflet图层
     */
    onEachFeature(feature, layer) {
        // 计算路线长度
        let length = 0;
        if (feature.geometry.type === 'LineString') {
            const line = turf.lineString(feature.geometry.coordinates);
            length = turf.length(line, { units: 'kilometers' });
        }

        const type = feature.properties.type || '待勘测';
        const typeColor = window.dataManager.typesConfig && window.dataManager.typesConfig[type] 
            ? window.dataManager.typesConfig[type].color 
            : '#9E9E9E';
        const routeName = feature.properties.name || '未命名路线';

        let popupContent = `<div class="popup-accent" style="border-top:3px solid ${typeColor}">`;
        popupContent += `<h3>${routeName}</h3>`;
        popupContent += `<p>类型: ${type}</p>`;
        popupContent += `<p>长度: ${length.toFixed(2)} 公里</p>`;

        // 获取外部 CSV 数据
        if (window.dataManager.routeDetailsData && window.dataManager.routeDetailsData[routeName]) {
            const details = window.dataManager.routeDetailsData[routeName];
            if (details.date) {
                popupContent += `<p>勘测日期: ${details.date}</p>`;        
            }
            if (details.spots) {
                popupContent += `<p>无障碍不规范点: ${details.spots}</p>`;
            }
        }

        popupContent += '</div>';

        // 绑定 popup
        layer.bindPopup(popupContent);

        // 保存原始 feature 以便重新获取样式
        layer._feature = feature;

        // 添加透明点击区域扩展层(增大点击范围)
        const baseStyle = window.dataManager.getStyleByType(feature);
        const hitAreaLayer = L.polyline(layer.getLatLngs(), {
            color: 'transparent',
            weight: 20,
            opacity: 0,
            interactive: true
        });
        hitAreaLayer.addTo(this.map);
        layer._hitArea = hitAreaLayer;

        // 将点击和悬停事件绑定到透明扩展层上
        hitAreaLayer.on('click', (e) => {
            L.DomEvent.stopPropagation(e);

            // 先清除按类型的高亮
            if (window.dataManager.highlightedType) {
                window.dataManager.clearTypeHighlight();
            }

            if (this.highlightedLayer) {
                const originalStyle = window.dataManager.getStyleByType(this.highlightedLayer._feature);    
                this.highlightedLayer.setStyle(originalStyle);
                if (this.highlightedLayer._hitArea) {
                    this.highlightedLayer._hitArea.setStyle({ color: 'transparent', weight: 20, opacity: 0 });
                }
            }

            const originalStyle = window.dataManager.getStyleByType(feature);
            layer.setStyle({
                ...originalStyle,
                weight: originalStyle.weight + 2,
                opacity: 1
            });

            this.highlightedLayer = layer;
            layer.openPopup();
        });

        hitAreaLayer.on('mouseover', () => {
            if (this.highlightedLayer !== layer && !window.dataManager.highlightedType) {
                const style = window.dataManager.getStyleByType(feature);
                layer.setStyle({ weight: style.weight + 1, dashArray: '10' });      
            }
        });

        hitAreaLayer.on('mouseout', () => {
            if (this.highlightedLayer !== layer && !window.dataManager.highlightedType) {
                layer.setStyle(window.dataManager.getStyleByType(feature));
            }
        });
    }

    /**
     * 渲染路线数据
     */
    renderRoutes() {
        try {
            if (!this.map || !window.dataManager?.routesData) return;

            // 移除已有的路线图层(如果有)
            if (window.routesLayer) {
                try {
                    this.map.removeLayer(window.routesLayer);
                } catch (error) {
                    console.warn('移除路线图层时出错:', error);
                }
            }

            // 创建 GeoJSON 图层
            try {
                window.routesLayer = L.geoJSON(window.dataManager.routesData, {
                    style: (feature) => {
                        try {
                            return window.dataManager.getStyleByType(feature);
                        } catch (styleError) {
                            console.warn('获取样式时出错:', styleError);
                            return {};
                        }
                    },
                    onEachFeature: (feature, layer) => {
                        try {
                            this.onEachFeature(feature, layer);
                        } catch (featureError) {
                            console.warn('处理要素时出错:', featureError);
                        }
                    }
                }).addTo(this.map);

                // 调整地图视图以显示所有路线
                try {
                    this.map.fitBounds(window.routesLayer.getBounds(), { padding: [50, 50] });
                } catch (boundsError) {
                    console.warn('调整地图视图时出错:', boundsError);
                }
            } catch (geoJsonError) {
                console.error('创建 GeoJSON 图层时出错:', geoJsonError);
            }

            const loading = document.getElementById('loading');
            if (loading) {
                try {
                    loading.classList.add('fade-out');
                    setTimeout(() => { 
                        try {
                            loading.remove(); 
                        } catch (removeError) {
                            console.warn('移除加载元素时出错:', removeError);
                        }
                    }, 600);
                } catch (loadingError) {
                    console.warn('处理加载元素时出错:', loadingError);
                }
            }

            console.log('路线渲染完成');
        } catch (error) {
            console.error('渲染路线数据时出错:', error);
        }
    }

    /**
     * 监听数据加载完成事件
     */
    listenForDataLoad() {
        // 检查数据是否加载完成
        const checkDataLoaded = setInterval(() => {
            if (window.dataManager.routesData && window.dataManager.typesConfig) {
                clearInterval(checkDataLoaded);
                this.renderRoutes();
            }
        }, 100);
    }

    /**
     * 初始化统计面板功能
     */
    initStatsPanel() {
        const statsPanel = document.getElementById('stats');
        if (!statsPanel) return;

        const statsH3 = statsPanel.querySelector('h3');

        // 点击标题展开/收起
        if (statsH3) {
            statsH3.addEventListener('click', (e) => {
                e.stopPropagation();
                statsPanel.classList.toggle('collapsed');
            });
        }

        // 点击面板（非标题、非类型统计项）切换透明度
        statsPanel.addEventListener('click', (e) => {
            if (e.target.closest('.type-stat-item') || e.target.closest('h3')) {
                return;
            }
            statsPanel.classList.toggle('hidden');
        });

        // 地图移动时显示统计面板(移除hidden类)
        if (this.map) {
            this.map.on('move', () => {
                statsPanel.classList.remove('hidden');
            });

            // 地图缩放时显示统计面板(移除hidden类)
            this.map.on('zoom', () => {
                statsPanel.classList.remove('hidden');
            });

            // 地图点击时显示统计面板(移除hidden类)
            this.map.on('click', () => {
                statsPanel.classList.remove('hidden');
            });
        }
    }

    /**
     * 初始化无障碍设施面板功能
     */
    initAccessibilityPanel() {
        const panel = document.getElementById('accessibility-panel');
        if (!panel) return;

        const h3 = panel.querySelector('h3');
        if (!h3) return;

        h3.addEventListener('click', (e) => {
            e.stopPropagation();
            panel.classList.toggle('collapsed');
        });

        panel.addEventListener('click', (e) => {
            if (e.target.closest('.accessibility-toggle') || e.target.closest('h3')) {
                return;
            }
            panel.classList.toggle('hidden');
        });

        if (this.map) {
            this.map.on('move', () => {
                panel.classList.remove('hidden');
            });

            this.map.on('zoom', () => {
                panel.classList.remove('hidden');
            });

            this.map.on('click', () => {
                panel.classList.remove('hidden');
            });
        }
    }

    /**
     * 初始化欢迎模态框
     */
    initWelcomeModal() {
        // 检查是否需要显示欢迎模态框
        const hasSeenWelcome = localStorage.getItem('hasSeenWelcome');
        if (!hasSeenWelcome) {
            setTimeout(() => {
                const welcomeModal = document.getElementById('welcome-modal');      
                if (welcomeModal) {
                    welcomeModal.classList.remove('hidden');
                }
            }, 1000);
        }

        // 绑定关闭按钮事件
        const closeWelcome = document.getElementById('close-welcome');
        const closeWelcomeBtn = document.getElementById('close-welcome-btn');       
        const welcomeModal = document.getElementById('welcome-modal');
        const dontShowAgain = document.getElementById('dont-show-again');

        function closeWelcomeModal() {
            if (welcomeModal) {
                if (dontShowAgain && dontShowAgain.checked) {
                    localStorage.setItem('hasSeenWelcome', 'true');
                }
                welcomeModal.classList.add('hidden');
            }
        }

        if (closeWelcome) {
            closeWelcome.addEventListener('click', closeWelcomeModal);
        }

        if (closeWelcomeBtn) {
            closeWelcomeBtn.addEventListener('click', closeWelcomeModal);
        }
    }

    /**
     * 初始化地图点击事件
     */
    initMapClickEvent() {
        if (!this.map) return;
        
        this.map.on('click', (e) => {
            if (!e.originalEvent.target.closest('.leaflet-popup-content-wrapper') &&
                !e.originalEvent.target.closest('.leaflet-interactive') &&      
                !e.originalEvent.target.closest('.type-stat-item')) {

                // 清除单条路线高亮
                if (this.highlightedLayer) {
                    const originalStyle = window.dataManager.getStyleByType(this.highlightedLayer._feature);
                    this.highlightedLayer.setStyle(originalStyle);
                    if (this.highlightedLayer._hitArea) {
                        this.highlightedLayer._hitArea.setStyle({ color: 'transparent', weight: 20, opacity: 0 });
                    }
                    this.highlightedLayer = null;
                }

                // 清除按类型高亮
                if (window.dataManager.highlightedType) {
                    window.dataManager.clearTypeHighlight();
                }
            }
        });
    }

    /**
     * 初始化所有功能
     */
    createAccessibilityIcon(config) {
        return L.divIcon({
            className: 'accessibility-marker',
            html: `<div class="accessibility-marker-inner" style="background-color:${config.markerColor};border-color:${config.markerColor}">${config.icon}</div>`,
            iconSize: [28, 28],
            iconAnchor: [14, 14],
            popupAnchor: [0, -16]
        });
    }

    renderAccessibilityLayers() {
        if (!this.map || !window.dataManager?.accessibilityData || !window.dataManager?.accessibilityTypes) return;

        Object.entries(window.dataManager.accessibilityData).forEach(([key, geojsonData]) => {
            const config = window.dataManager.accessibilityTypes[key];
            if (!config || this.accessibilityLayers[key]) return;

            const icon = this.createAccessibilityIcon(config);
            const layerGroup = L.markerClusterGroup({
                maxClusterRadius: 80,
                spiderfyOnMaxZoom: false,
                showCoverageOnHover: false,
                zoomToBoundsOnClick: true,
                chunkedLoading: true,
                chunkDelay: 50,
                chunkProgress: null,
                disableClusteringAtZoom: 18,
                animate: false,
                animateAddingMarkers: false,
                iconCreateFunction: function(cluster) {
                    const count = cluster.getChildCount();
                    let size = 'small';
                    if (count > 50) size = 'large';
                    else if (count > 20) size = 'medium';
                    return L.divIcon({
                        html: `<div><span>${count}</span></div>`,
                        className: `marker-cluster marker-cluster-${size}`,
                        iconSize: L.point(40, 40)
                    });
                }
            });

            if (geojsonData.features) {
                geojsonData.features.forEach(feature => {
                    try {
                        if (feature.geometry.type === 'Point') {
                            const rawLng = feature.geometry.coordinates[0];
                            const rawLat = feature.geometry.coordinates[1];
                            const source = feature.properties._source;
                            let lng = rawLng, lat = rawLat;
                            if (source !== 'amap') {
                                const c = MapManager.convertCoords(rawLng, rawLat);
                                lng = c[0];
                                lat = c[1];
                            }
                            const marker = L.marker(
                                [lat, lng],
                                { icon: icon, opacity: 0.5 }
                            );

                            const name = feature.properties.name || feature.properties['name:zh'] || config.label;
                            let popupContent = `<div class="popup-accent" style="border-top:3px solid ${config.markerColor}">`;
                            popupContent += `<h3>${name}</h3>`;
                            popupContent += `<p>类型: ${config.label}</p>`;

                            const detailTags = ['operator', 'opening_hours', 'wheelchair', 'toilets:wheelchair', 'description', 'level', 'indoor', 'address', 'facility', 'line', 'station'];
                            const labelMap = {
                                operator: '运营方',
                                opening_hours: '开放时间',
                                wheelchair: '轮椅可达',
                                'toilets:wheelchair': '无障碍卫生间',
                                description: '描述',
                                level: '楼层',
                                indoor: '室内/室外',
                                address: '地址',
                                facility: '设施',
                                line: '线路',
                                station: '站点'
                            };
                            detailTags.forEach(tag => {
                                if (feature.properties[tag]) {
                                    popupContent += `<p>${labelMap[tag] || tag}: ${feature.properties[tag]}</p>`;
                                }
                            });

                            const sourceLabel = feature.properties._source === 'sz_metro' ? '深圳地铁' :
                                           feature.properties._source === 'amap' ? '高德地图' : 'OpenStreetMap';
                            popupContent += `<p class="osm-credit">数据来源: ${sourceLabel}</p>`;
                            popupContent += '</div>';
                            marker.bindPopup(popupContent);

                            marker.on('mouseover', function() {
                                this.setOpacity(1.0);
                            });
                            marker.on('mouseout', function() {
                                this.setOpacity(0.5);
                            });
                            marker.on('click', function() {
                                this.setOpacity(1.0);
                            });

                            layerGroup.addLayer(marker);
                        }
                    } catch (err) {
                        console.warn(`渲染无障碍设施要素失败: ${key}`, err);
                    }
                });
            }

            const savedState = localStorage.getItem(`accessibility_layer_${key}`);
            const isVisible = savedState === 'true';
            if (isVisible) {
                layerGroup.addTo(this.map);
            }
            this.accessibilityLayers[key] = layerGroup;
        });

        console.log('无障碍设施图层渲染完成');

        Object.entries(this.accessibilityLayers).forEach(([key, layer]) => {
            const markerCount = layer.getLayers().length;
            const item = document.querySelector(`.accessibility-item[data-key="${key}"]`);
            if (item) {
                const countEl = item.querySelector('.accessibility-count');
                if (countEl && markerCount !== parseInt(countEl.textContent)) {
                    countEl.innerHTML = `${countEl.textContent}<small class="marker-subcount">(${markerCount})</small>`;
                }
            }
        });
    }

    toggleAccessibilityLayer(key, visible) {
        const layer = this.accessibilityLayers[key];
        if (!layer) return;

        if (visible) {
            if (!this.map.hasLayer(layer)) {
                layer.addTo(this.map);
            }
        } else {
            if (this.map.hasLayer(layer)) {
                this.map.removeLayer(layer);
            }
        }
    }

    listenForAccessibilityData() {
        const checkDataLoaded = setInterval(() => {
            const data = window.dataManager?.accessibilityData;
            const types = window.dataManager?.accessibilityTypes;
            if (data && types && Object.keys(data).length === Object.keys(types).length) {
                clearInterval(checkDataLoaded);
                this.renderAccessibilityLayers();
            }
        }, 200);
    }

    initCenterButton() {
        const centerBtn = L.control({ position: 'topleft' });
        centerBtn.onAdd = function() {
            const div = L.DomUtil.create('div', 'center-btn');
            div.innerHTML = '⌂';
            div.title = '回到中心区域';
            div.addEventListener('click', (e) => {
                L.DomEvent.stopPropagation(e);
                L.DomEvent.preventDefault(e);
                if (window.mapManager && window.mapManager.map) {
                    window.mapManager.map.flyTo([22.5949, 114.0015], 15, { duration: 1.0 });
                }
            });
            return div;
        };
        centerBtn.addTo(this.map);
    }

    init() {
        this.initMap();
        this.startDashAnimation();
        this.listenForDataLoad();
        this.listenForAccessibilityData();
        this.initStatsPanel();
        this.initAccessibilityPanel();
        this.initWelcomeModal();
        this.initMapClickEvent();
        this.initCenterButton();
    }
}

// 导出单例实例
const mapManager = new MapManager();

// 页面加载完成后初始化
window.addEventListener('DOMContentLoaded', () => {
    mapManager.init();
});

// 导出地图管理器
window.mapManager = mapManager;
