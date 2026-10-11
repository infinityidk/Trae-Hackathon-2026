/*
Copyright © 2025 Wayhhow. All rights reserved.
GitHub: https://github.com/Wayhhow
Project: 橙光队无障碍督导路线可视化
*/
/**
 * 数据管理模块
 * 负责加载和管理地图相关数据，包括路线数据、类型配置和路线详情
 */
class DataManager {
    /**
     * 构造函数
     */
    constructor() {
        /**
         * 路线数据 (GeoJSON)
         * @type {Object|null}
         */
        this.routesData = null;
        
        /**
         * 类型配置
         * @type {Object|null}
         */
        this.typesConfig = null;
        
        /**
         * 路线详情数据 (CSV)
         * @type {Object}
         */
        this.routeDetailsData = {};
        
        /**
         * 所有路线详情，用于计算统计数据
         * @type {Array}
         */
        this.allRouteDetails = [];
        
        /**
         * 统计数据
         * @type {Object}
         */
        this.stats = {
            totalLength: 0,     // 总长度
            typeStats: {},       // 按类型统计
            totalSpots: 0        // 总不规范点数目
        };
        
        /**
         * 当前按类型高亮的状态
         * @type {string|null}
         */
        this.highlightedType = null;

        this.accessibilityTypes = null;

        this.accessibilityData = {};

        this.accessibilityStats = {};
    }

    /**
     * 数据缓存对象，用于减少重复的网络请求和计算
     * @type {Map}
     */
    dataCache = new Map();

    /**
     * 加载路线详情 (CSV)
     * @returns {Promise<void>}
     */
    async loadRouteDetails() {
        const cacheKey = 'routeDetails';
        
        // 检查缓存
        if (this.dataCache.has(cacheKey)) {
            const cachedData = this.dataCache.get(cacheKey);
            this.allRouteDetails = cachedData.allRouteDetails;
            this.routeDetailsData = cachedData.routeDetailsData;
            console.log('从缓存加载路线详情');
            return;
        }

        return new Promise((resolve) => {
            if (typeof Papa === 'undefined') {
                console.warn('PapaParse is not loaded. Route details will not be available.');
                resolve();
                return;
            }

            Papa.parse('data/route_details.csv', {
                download: true,
                header: true,
                skipEmptyLines: true,
                complete: (results) => {
                    try {
                        console.log('路线详情 CSV 加载成功:', results.data);     
                        this.allRouteDetails = results.data || [];
                        
                        // 优化数据处理，减少重复遍历
                        const routeDetails = {};
                        this.allRouteDetails.forEach(row => {
                            try {
                                const name = row['名称'] || row['name'] || row['Name'];    
                                if (name) {
                                    routeDetails[name] = {
                                        date: row['勘测日期'] || '',
                                        spots: row['无障碍不规范点'] || ''
                                    };
                                }
                            } catch (rowError) {
                                console.warn('处理路线详情行时出错:', rowError);
                            }
                        });
                        this.routeDetailsData = routeDetails;
                        
                        // 缓存数据
                        this.dataCache.set(cacheKey, {
                            allRouteDetails: this.allRouteDetails,
                            routeDetailsData: this.routeDetailsData
                        });
                    } catch (error) {
                        console.error('处理路线详情数据时出错:', error);
                    } finally {
                        resolve();
                    }
                },
                error: (err) => {
                    console.error('路线详情 CSV 加载失败:', err);
                    // 不阻断页面加载
                    resolve();
                }
            });
        });
    }

    /**
     * 加载类型配置
     * @returns {Promise<void>}
     */
    async loadTypesConfig() {
        const cacheKey = 'typesConfig';
        
        // 检查缓存
        if (this.dataCache.has(cacheKey)) {
            this.typesConfig = this.dataCache.get(cacheKey);
            console.log('从缓存加载类型配置');
            return;
        }

        try {
            const response = await fetch('data/types.json');
            this.typesConfig = await response.json();
            console.log('类型配置加载成功:', this.typesConfig);
            
            // 缓存数据
            this.dataCache.set(cacheKey, this.typesConfig);
        } catch (error) {
            console.error('类型配置加载失败:', error);
            // 默认配置
            this.typesConfig = {
                "已勘测": { "color": "#4CAF50", "weight": 4, "opacity": 0.8 },    
                "待勘测": { "color": "#9E9E9E", "weight": 3, "opacity": 0.6 }      
            };
            
            // 缓存默认配置
            this.dataCache.set(cacheKey, this.typesConfig);
        }
    }

    /**
     * 加载路线数据
     * @returns {Promise<void>}
     */
    async loadRoutesData() {
        const cacheKey = 'routesData';
        
        // 检查缓存
        if (this.dataCache.has(cacheKey)) {
            this.routesData = this.dataCache.get(cacheKey);
            console.log('从缓存加载路线数据');
            this.calculateStats();
            this.updateStatsDisplay();
            return;
        }

        try {
            const response = await fetch('data/routes.geojson');
            this.routesData = await response.json();
            console.log('路线数据加载成功:', this.routesData);
            
            // 缓存数据
            this.dataCache.set(cacheKey, this.routesData);
            
            this.calculateStats();
            this.updateStatsDisplay();
        } catch (error) {
            console.error('路线数据加载失败:', error);
            // 创建示例数据
            this.routesData = {
                "type": "FeatureCollection",
                "features": [
                    {
                        "type": "Feature",
                        "properties": { "name": "示例路线1", "type": "已勘测" },
                        "geometry": {
                            "type": "LineString",
                            "coordinates": [[116.3974, 39.9093], [116.4100, 39.9100], [116.4200, 39.9080]]
                        }
                    },
                    {
                        "type": "Feature",
                        "properties": { "name": "示例路线2", "type": "待勘测" },
                        "geometry": {
                            "type": "LineString",
                            "coordinates": [[116.3800, 39.9000], [116.3900, 39.8900], [116.4000, 39.8800]]
                        }
                    }
                ]
            };
            
            // 缓存示例数据
            this.dataCache.set(cacheKey, this.routesData);
            
            this.calculateStats();
            this.updateStatsDisplay();
        }
    }

    /**
     * 计算统计数据
     */
    calculateStats() {
        try {
            if (!this.routesData || !this.routesData.features) return;

            let totalLength = 0;
            const typeStats = {};
            let totalSpots = 0;

            // 初始化类型统计
            if (this.typesConfig) {
                try {
                    Object.keys(this.typesConfig).forEach(type => {
                        typeStats[type] = 0;
                    });
                } catch (error) {
                    console.warn('初始化类型统计时出错:', error);
                }
            }

            // 计算每条路线的长度
            this.routesData.features.forEach(feature => {
                try {
                    if (feature.geometry && feature.geometry.type === 'LineString' && feature.geometry.coordinates) {
                        const line = turf.lineString(feature.geometry.coordinates);
                        const length = turf.length(line, { units: 'kilometers' });
                        totalLength += length;

                        // 按类型统计
                        const type = feature.properties?.type || '待勘测';
                        if (!typeStats[type]) {
                            typeStats[type] = 0;
                        }
                        typeStats[type] += length;
                    }
                } catch (error) {
                    console.warn('计算路线长度时出错:', error);
                }
            });

            // 计算总不规范点数目
            this.allRouteDetails.forEach(row => {
                try {
                    const spots = row['无障碍不规范点'] || '';
                    if (spots) {
                        // 提取数字部分，例如"10 spots" -> 10
                        const match = spots.match(/\d+/);
                        if (match) {
                            totalSpots += parseInt(match[0], 10);
                        }
                    }
                } catch (error) {
                    console.warn('计算不规范点时出错:', error);
                }
            });

            this.stats.totalLength = totalLength;
            this.stats.typeStats = typeStats;
            this.stats.totalSpots = totalSpots;
        } catch (error) {
            console.error('计算统计数据时出错:', error);
        }
    }

    /**
     * 按类型高亮路线
     * @param {string} type - 路线类型
     */
    highlightRoutesByType(type) {
        if (!window.routesLayer) return;

        // 先清除之前的高亮
        this.clearTypeHighlight();

        this.highlightedType = type;

        window.routesLayer.eachLayer(layer => {
            if (layer._feature) {
                const layerType = layer._feature.properties.type || '待勘测';
                if (layerType === type) {
                    const style = this.typesConfig[type] || {};
                    layer.setStyle({
                        ...style,
                        weight: (style.weight || 4) + 3,
                        opacity: 1,
                        dashArray: '10'
                    });
                    if (layer._hitArea) {
                        layer._hitArea.setStyle({ color: 'transparent', weight: 20, opacity: 0 });
                    }
                } else {
                    layer.setStyle({
                        weight: 1,
                        opacity: 0.25,
                        dashArray: '6'
                    });
                    if (layer._hitArea) {
                        layer._hitArea.setStyle({ color: 'transparent', weight: 20, opacity: 0 });
                    }
                }
            }
        });

        // 更新统计面板的选中状态
        document.querySelectorAll('.type-stat-item').forEach(item => {
            if (item.dataset.type === type) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    }

    /**
     * 清除按类型的高亮
     */
    clearTypeHighlight() {
        if (!window.routesLayer) return;

        this.highlightedType = null;

        window.routesLayer.eachLayer(layer => {
            if (layer._feature) {
                const originalStyle = this.getStyleByType(layer._feature);
                layer.setStyle(originalStyle);
                if (layer._hitArea) {
                    layer._hitArea.setStyle({ color: 'transparent', weight: 20, opacity: 0 });
                }
            }
        });

        // 清除所有选中状态
        document.querySelectorAll('.type-stat-item').forEach(item => {
            item.classList.remove('active');
        });
    }

    /**
     * 根据类型获取样式
     * @param {Object} feature - GeoJSON feature
     * @returns {Object} 样式对象
     */
    getStyleByType(feature) {
        if (!this.typesConfig) return {};

        const type = feature.properties.type || '待勘测';
        const style = this.typesConfig[type] || this.typesConfig['待勘测'] || {};

        return {
            ...style,
            className: 'route-line',
            dashArray: '12',
            lineCap: 'round'
        };
    }

    /**
     * 更新统计显示
     */
    updateStatsDisplay() {
        try {
            // 更新总长度
            const totalLengthElement = document.getElementById('total-length');
            if (totalLengthElement) {
                try {
                    totalLengthElement.innerHTML = `总长度: ${this.stats.totalLength.toFixed(2)} 公里`;
                } catch (error) {
                    console.warn('更新总长度显示时出错:', error);
                    totalLengthElement.innerHTML = '总长度: 0.00 公里';
                }
            }

            // 更新不规范点统计（三行显示）
            const totalSpotsElement = document.getElementById('total-spots');
            if (totalSpotsElement) {
                try {
                    const onCampusSpots = 88; // 校内固定值
                    const offCampusSpots = this.stats.totalSpots; // 校外实时值
                    const totalSpots = onCampusSpots + offCampusSpots; // 总计值
                    totalSpotsElement.innerHTML = `校内：${onCampusSpots}处<br>校外：${offCampusSpots}处<br>总计：${totalSpots}处`;
                } catch (error) {
                    console.warn('更新不规范点显示时出错:', error);
                    totalSpotsElement.innerHTML = '校内：88处<br>校外：0处<br>总计：88处';
                }
            }

            // 更新类型统计
            const typeStatsElement = document.getElementById('type-stats');
            if (typeStatsElement) {
                try {
                    typeStatsElement.innerHTML = '';
                    if (this.stats.typeStats && typeof this.stats.typeStats === 'object') {
                        Object.entries(this.stats.typeStats).forEach(([type, length]) => {
                            try {
                                const typeConfig = this.typesConfig?.[type] || {};
                                const color = typeConfig.color || '#9E9E9E';

                                const statItem = document.createElement('div');
                                statItem.className = 'type-stat-item';
                                statItem.dataset.type = type;
                                statItem.innerHTML = `
                                    <div class="type-color" style="background-color: ${color}"></div>
                                    <div class="stat-content">
                                        <div class="stat-label">${type}</div>
                                        <div class="stat-value">${length.toFixed(2)} 公里</div>
                                    </div>
                                `;

                                // 点击事件：按类型高亮路线
                                statItem.addEventListener('click', (e) => {
                                    try {
                                        e.stopPropagation();

                                        // 如果已经高亮了该类型，则取消高亮；否则高亮该类型
                                        if (this.highlightedType === type) {
                                            this.clearTypeHighlight();
                                        } else {
                                            this.highlightRoutesByType(type);
                                        }
                                    } catch (eventError) {
                                        console.warn('处理类型统计点击事件时出错:', eventError);
                                    }
                                });

                                typeStatsElement.appendChild(statItem);
                            } catch (itemError) {
                                console.warn('创建类型统计项时出错:', itemError);
                            }
                        });
                    }
                } catch (error) {
                    console.warn('更新类型统计显示时出错:', error);
                }
            }
        } catch (error) {
            console.error('更新统计显示时出错:', error);
        }
    }

    /**
     * 初始化数据加载
     * @returns {Promise<void>}
     */
    async loadAccessibilityTypes() {
        const cacheKey = 'accessibilityTypes';

        if (this.dataCache.has(cacheKey)) {
            this.accessibilityTypes = this.dataCache.get(cacheKey);
            console.log('从缓存加载无障碍设施类型配置');
            return;
        }

        try {
            const response = await fetch('data/accessibility_types.json');
            this.accessibilityTypes = await response.json();
            console.log('无障碍设施类型配置加载成功:', this.accessibilityTypes);
            this.dataCache.set(cacheKey, this.accessibilityTypes);
        } catch (error) {
            console.error('无障碍设施类型配置加载失败:', error);
            this.accessibilityTypes = {};
            this.dataCache.set(cacheKey, this.accessibilityTypes);
        }
    }

    async loadAccessibilityData() {
        if (!this.accessibilityTypes) return;

        for (const [key, config] of Object.entries(this.accessibilityTypes)) {
            const cacheKey = `accessibility_${key}`;

            if (this.dataCache.has(cacheKey)) {
                this.accessibilityData[key] = this.dataCache.get(cacheKey);
                console.log(`从缓存加载无障碍设施数据: ${key}`);
                continue;
            }

            try {
                const response = await fetch(config.file);
                const data = await response.json();
                this.accessibilityData[key] = data;
                this.accessibilityStats[key] = data.features ? data.features.length : 0;
                console.log(`无障碍设施数据加载成功: ${key} (${this.accessibilityStats[key]} 个)`);
                this.dataCache.set(cacheKey, data);
            } catch (error) {
                console.warn(`无障碍设施数据加载失败: ${key}`, error);
                this.accessibilityData[key] = { type: 'FeatureCollection', features: [] };
                this.accessibilityStats[key] = 0;
                this.dataCache.set(cacheKey, this.accessibilityData[key]);
            }
        }

        this.updateAccessibilityPanel();
    }

    updateAccessibilityPanel() {
        const panel = document.getElementById('accessibility-panel');
        if (!panel || !this.accessibilityTypes) return;

        const listEl = document.getElementById('accessibility-list');
        if (!listEl) return;

        listEl.innerHTML = '';

        Object.entries(this.accessibilityTypes).forEach(([key, config]) => {
            const count = this.accessibilityStats[key] || 0;
            const savedState = localStorage.getItem(`accessibility_layer_${key}`);
            const isChecked = savedState === 'true';
            const item = document.createElement('div');
            item.className = 'accessibility-item';
            item.dataset.key = key;
            item.innerHTML = `
                <label class="accessibility-toggle">
                    <input type="checkbox" ${isChecked ? 'checked' : ''} data-layer="${key}">
                    <span class="accessibility-icon">${config.icon}</span>
                    <span class="accessibility-label">${config.label}</span>
                    <span class="accessibility-count">${count}</span>
                </label>
            `;

            const checkbox = item.querySelector('input[type="checkbox"]');
            checkbox.addEventListener('change', (e) => {
                e.stopPropagation();
                localStorage.setItem(`accessibility_layer_${key}`, e.target.checked);
                if (window.mapManager) {
                    window.mapManager.toggleAccessibilityLayer(key, e.target.checked);
                }
            });

            listEl.appendChild(item);
        });
    }

    async init() {
        await this.loadTypesConfig();
        await this.loadRouteDetails();
        await this.loadRoutesData();
        await this.loadAccessibilityTypes();
        await this.loadAccessibilityData();
    }
}

// 导出单例实例
const dataManager = new DataManager();

// 页面加载完成后初始化
window.addEventListener('DOMContentLoaded', () => {
    dataManager.init();
});

// 导出数据管理器
window.dataManager = dataManager;
