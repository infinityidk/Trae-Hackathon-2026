#!/usr/bin/env node
/*
Copyright © 2025 Wayhhow. All rights reserved.
GitHub: https://github.com/Wayhhow
Project: 橙光队无障碍督导路线可视化
*/

const fs = require('fs');
const path = require('path');
const { kml } = require('@mapbox/togeojson');
const { DOMParser } = require('xmldom');
const { parse } = require('csv-parse/sync');
const { stringify } = require('csv-stringify/sync');

// 命令行参数
const args = process.argv.slice(2);
if (args.length < 1) {
    console.error('用法: node convert-kml.js <input.kml|input.geojson> [output.geojson]');
    process.exit(1);
}

const inputPath = args[0];
const outputPath = args[1] || path.join(path.dirname(inputPath), 'routes.geojson');

// 颜色到类型的映射
const colorToType = {
    '#4CAF50': '已勘测',
    '#9E9E9E': '待勘测',
    '#F44336': '待勘测',
    '#fbc02d': '已勘测',   // 黄色
    '#f9a825': '已勘测',   // 深黄色/琥珀色
    '#000000': '待勘测'    // 黑色
};

// 读取文件
fs.readFile(inputPath, 'utf8', (err, data) => {
    if (err) {
        console.error('读取文件失败:', err);
        process.exit(1);
    }
    
    try {
        let geojson;
        
        // 检查文件类型
        if (inputPath.endsWith('.kml')) {
            // 解析 KML
            const xml = new DOMParser().parseFromString(data, 'text/xml');
            geojson = kml(xml);
            
            // 提取样式信息
            const styles = {};
            const styleElements = xml.getElementsByTagName('Style');
            
            for (let i = 0; i < styleElements.length; i++) {
                const style = styleElements[i];
                const id = style.getAttribute('id');
                const lineStyle = style.getElementsByTagName('LineStyle')[0];
                
                if (id && lineStyle) {
                    const colorElement = lineStyle.getElementsByTagName('color')[0];
                    if (colorElement) {
                        let color = colorElement.textContent;
                        // 转换 KML 颜色格式（AABBGGRR）为 CSS 格式（#RRGGBB）
                        if (color.length === 8) {
                            color = '#' + color.substring(6, 8) + color.substring(4, 6) + color.substring(2, 4);
                        }
                        styles[id] = color;
                    }
                }
            }
            
            // 解析 StyleMap 元素，将 StyleMap ID 映射到其 normal 样式的颜色
            const styleMapElements = xml.getElementsByTagName('StyleMap');
            for (let i = 0; i < styleMapElements.length; i++) {
                const styleMap = styleMapElements[i];
                const id = styleMap.getAttribute('id');
                if (!id) continue;
                
                const pairs = styleMap.getElementsByTagName('Pair');
                for (let j = 0; j < pairs.length; j++) {
                    const key = pairs[j].getElementsByTagName('key')[0];
                    const styleUrl = pairs[j].getElementsByTagName('styleUrl')[0];
                    if (key && styleUrl && key.textContent === 'normal') {
                        const refId = styleUrl.textContent.replace('#', '');
                        if (styles[refId]) {
                            styles[id] = styles[refId];
                        }
                    }
                }
            }
            
            // 处理转换后的数据
            geojson.features.forEach(feature => {
                // 从 styleUrl 提取样式 ID
                let type = '待勘测'; // 默认类型
                if (feature.properties.styleUrl) {
                    const styleId = feature.properties.styleUrl.replace('#', '');
                    const color = styles[styleId];
                    if (color && colorToType[color]) {
                        type = colorToType[color];
                    }
                }
                // 回退：如果 styleUrl 匹配失败，尝试使用 stroke 颜色
                if (type === '待勘测' && feature.properties.stroke) {
                    const strokeColor = feature.properties.stroke.toLowerCase();
                    if (colorToType[strokeColor]) {
                        type = colorToType[strokeColor];
                    }
                }
                feature.properties.type = type;
            });
        } else if (inputPath.endsWith('.geojson')) {
            // 解析 GeoJSON
            geojson = JSON.parse(data);
            
            // 处理 GeoJSON 数据
            geojson.features.forEach(feature => {
                let type = '待勘测'; // 默认类型
                if (feature.properties.stroke) {
                    const color = feature.properties.stroke.toLowerCase();
                    if (colorToType[color]) {
                        type = colorToType[color];
                    }
                }
                feature.properties.type = type;
            });
        } else {
            console.error('不支持的文件类型，请使用 .kml 或 .geojson 文件');
            process.exit(1);
        }
        
        // 写入 GeoJSON 文件
        fs.writeFileSync(outputPath, JSON.stringify(geojson, null, 2));
        console.log(`转换成功！输出文件: ${outputPath}`);

        // 处理 CSV 文件
        const csvPath = path.join(path.dirname(outputPath), 'route_details.csv');
        let existingRecords = [];

        // 读取已存在的 CSV 文件
        if (fs.existsSync(csvPath)) {
            const csvData = fs.readFileSync(csvPath, 'utf8');
            existingRecords = parse(csvData, { columns: true, skip_empty_lines: true });
        }

        // 收集所有路线的名称
        const currentRouteNames = new Set();
        geojson.features.forEach(feature => {
            if (feature.properties && feature.properties.name) {
                currentRouteNames.add(feature.properties.name);
            }
        });

        // 查找在 GeoJSON 中但不在 CSV 中的路线
        const existingNames = new Set(existingRecords.map(record => record['名称'] || record['name'] || record['Name']));

        let newRecordsCount = 0;
        currentRouteNames.forEach(name => {
            if (!existingNames.has(name)) {
                existingRecords.push({
                    '名称': name,
                    '勘测日期': '',
                    '无障碍不规范点': ''
                });
                newRecordsCount++;
            }
        });

        // 如果没有任何记录，可能是一个全新的文件，添加列头
        if (existingRecords.length === 0) {
            currentRouteNames.forEach(name => {
                existingRecords.push({
                    '名称': name,
                    '勘测日期': '',
                    '无障碍不规范点': ''
                });
                newRecordsCount++;
            });
        }

        if (newRecordsCount > 0 || !fs.existsSync(csvPath)) {
            const csvOutput = stringify(existingRecords, { header: true, columns: ['名称', '勘测日期', '无障碍不规范点'] });
            fs.writeFileSync(csvPath, csvOutput);
            console.log(`成功更新路线详情 CSV 文件！新增了 ${newRecordsCount} 条路线记录。输出文件: ${csvPath}`);
        } else {
            console.log(`CSV 文件无需更新，没有发现新的路线。`);
        }

    } catch (error) {
        console.error('转换过程出错:', error);
        process.exit(1);
    }
});
