/* 
 * Copyright (C) 2015 jdn
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
/* global Cesium, angular, vwctl */

var databasename = "tacmapUnitDb";
var storestructure = [
    ['Resources', 'name', false, [['url', 'url', true], ['lastmod', 'lastmod', false], ['data', 'data', false]]],
    ['Missions', 'name', false, [['data', 'data', false]]]
];
Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI3MTg2YTliMi05YWYzLTQ0MzgtYWRjNS01NjRlOGY4NjgwZGUiLCJpZCI6ODU3Nywic2NvcGVzIjpbImFzciIsImdjIl0sImlhdCI6MTU1MjMyNzk0Mn0.-bqHZmN7eaGyZPP_tSEklGadxL9WTBJLEfiQkd0fFkw';
var compression = false;
var viewer = new Cesium.Viewer('cesiumContainer', {
    animation: false,
    timeline: false,
    infoBox: true,
    selectionIndicator: true,
    baseLayerPicker: true,
    navigationHelpButton: false,
    navigationInstructionsInitiallyVisible: false,
    //    imageryProvider: new Cesium.ArcGisMapServerImageryProvider({
    //        url: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer'
    //    }),
    //    imageryProvider: new Cesium.ArcGisMapServerImageryProvider({
    //        url: '//services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer'
    //    }), 
    imageryProvider: new Cesium.BingMapsImageryProvider({
        url: '//dev.virtualearth.net',
        key: 'AtO-6nT2HLG-BF4IvAbGvEppiYqeW9W4KSemE-7wVH_9GgWnThseKQdwe4-xj-S0',
        mapStyle: Cesium.BingMapsStyle.AERIAL_WITH_LABELS
    }),
    /*imageryProvider: new Cesium.GoogleEarthImageryProvider({
          url: '//earth.localdomain',
          channel: 1008
          }),*/
    //    imageryProvider: new Cesium.TileMapServiceImageryProvider({
    //        url: 'Cesium/Assets/Textures/NaturalEarthII'
    //    }),
    // OpenStreetMap tile provider
    //    imageryProvider: new Cesium.OpenStreetMapImageryProvider({
    //        url: '/tiles'
    //    }),
    homeButton: false,
    geocoder: false
});
var scene = viewer.scene;
var xj = new X2JS();
var TacMapUnit = angular.module('TacMapUnit', ['indexedDB']);
TacMapUnit.config(function ($indexedDBProvider) {
    $indexedDBProvider.connection(databasename).upgradeDatabase(1, function (event, db, tx) {
        console.log("initDb");
        for (i = 0; i < storestructure.length; i++) {
            //console.log("add store " + storestructure[i][0] + " key:" + storestructure[i][1] + " autoinc:" + storestructure[i][2]);
            var objectStore = db.createObjectStore(storestructure[i][0], {
                keyPath: storestructure[i][1], autoIncrement: storestructure[i][2]
            });
            var indices = storestructure[i][3];
            for (j = 0; j < indices.length; j++) {
                //console.log("add index " + indices[j][0] + " ref:" + indices[j][1] + " unique:" + indices[j][2]);
                objectStore.createIndex(indices[j][0], indices[j][1], {
                    unique: indices[j][2]
                });
            }
        }
    });
});