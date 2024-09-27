/* global TacMapServer, TacMapUnit */
// ***** SERVER SERVICES ******//
TacMapServer.factory('GeoService', function () {
    var geosvc = {
    };
    geosvc.entities = [];
    geosvc.waypoints = [];
    geosvc.missionid = null;
    geosvc.sdatasources = [];
    geosvc.wpdatasources = [];
    geosvc.movementsegments = [];
    geosvc.rptInterval = 10; //seconds
    geosvc.initGeodesy = function (missionid, missiondata) {
        console.log("initGeodesy " + missionid);
        geosvc.missionid = missionid;
        geosvc.sdatasources[geosvc.missionid] = new Cesium.CustomDataSource(geosvc.missionid);
        viewer.dataSources.add(geosvc.sdatasources[geosvc.missionid]);
        geosvc.wpdatasources[geosvc.missionid] = new Cesium.CustomDataSource(geosvc.missionid + "WP");
        viewer.dataSources.add(geosvc.wpdatasources[geosvc.missionid]);
        //console.log(missiondata);
        var polygons = missiondata.Mission.Polygons.Polygon;
        var entities = missiondata.Mission.Entities.Entity;
        geosvc.entities = missiondata.Mission.Entities.Entity;
        geosvc.addPolygons(polygons);
        geosvc.addEntities(entities);
        //console.log(geosvc.movementsegments);
        viewer.zoomTo(geosvc.sdatasources[geosvc.missionid].entities.getById("Default"));
        geosvc.setNetViz(entities, "");
    };
    geosvc.addPolygons = function (polygons) {
        //console.log('addPolygons ' + polygons.length);
        //console.log(polygons);
        for (i = 0; i < polygons.length; i++) {
            if (polygons[i]._locations.length > 0) {
                geosvc.addCesiumPolygon(polygons[i]);
            }
        }
    };
    geosvc.addEntities = function (entities) {
        //console.log('addEntities ' + entities.length);
        for (i = 0; i < entities.length; i++) {
            if (entities[i]._location.length > 0) {
                geosvc.addCesiumBillBoard(entities[i]);
            }
        }
    };
    geosvc.addCesiumPolygon = function (poly) {
        //console.log('addPolygon');
        var loc = poly._locations;
        //console.log(loc);
        loc = loc.replace(/\s|\"|\[|\]/g, "").split(",");
        //Cartesian wants long, lat
        geosvc.sdatasources[geosvc.missionid].entities.add({
            id: poly._id,
            name: poly._name,
            polygon: {
                hierarchy: Cesium.Cartesian3.fromDegreesArray(loc.reverse()),
                outline: true,
                outlineColor: Cesium.Color[poly._color],
                outlineWidth: 2,
                fill: false
            }
        });
    };
    geosvc.addCesiumBillBoard = function (entity) {
        var loc = entity._location;
        loc = loc.replace(/\s|\"|\[|\]/g, "").split(",");
        geosvc.sdatasources[geosvc.missionid].entities.add({
            id: entity._id,
            name: entity._name,
            position: Cesium.Cartesian3.fromDegrees(loc[1], loc[0]),
            billboard: {
                image: entity._icon,
                width: 40,
                height: 25
            },
            label: {
                text: entity._name,
                font: '10pt monospace',
                outlineWidth: 2,
                verticalOrigin: Cesium.VerticalOrigin.TOP,
                pixelOffset: new Cesium.Cartesian2(0, 15)
            }
        });
        if (entity.waypoints) {
            geosvc.addStoredWaypoints(entity);
        }
    };
    geosvc.addStoredWaypoints = function (entity) {
        // console.log("addStoredWaypoints: " + entity._id);
        var w = entity.waypoints;
        var uid = entity._id;
        geosvc.waypoints[uid] = [];
        geosvc.waypoints[uid].push(w[0]);
        for (p = 1; p < w.length; p++) {
            geosvc.waypoints[uid].push(w[p]);
            var arr = [w[p - 1][1], w[p - 1][0], w[p][1], w[p][0]];
            geosvc.wpdatasources[geosvc.missionid].entities.add({
                id: uid + 'WP' + geosvc.waypoints[uid].length,
                polyline: {
                    positions: Cesium.Cartesian3.fromDegreesArray(arr),
                    width: 1,
                    material: Cesium.Color.LIGHTYELLOW
                }
            });
        }
        geosvc.setMovements(uid, geosvc.waypoints[uid]);
    };
    geosvc.setRptInc = function (meters) {
        geosvc.rptIncrement = meters;
    };
    geosvc.setMovements = function (uid, wpts) {
        // console.log('setMovements');
        geosvc.movementsegments[uid] = [];
        for (p = 1; p < wpts.length; p++) {
            var b = geosvc.calcBearing(wpts[p - 1][0], wpts[p - 1][1], wpts[p][0], wpts[p][1]);
            var d = geosvc.calcDistanceMeters(wpts[p - 1][0], wpts[p - 1][1], wpts[p][0], wpts[p][1]);
            geosvc.splitLine(uid, wpts[p - 1][0], wpts[p - 1][1], d, b, wpts[p - 1][2]);
        }
    };
    //Divide a line into increments based on speed and increment//time to get to next point governs interval .. 1000*speed/increment
    geosvc.splitLine = function (entityid, startlat, startlng, wpdist, bearing, speed) {
        //console.log('splitLine ' + entityid + "," + startlat + "," + startlng + "," + dist + "," + bearing + "," + speed);
        var slat = startlat;
        var slng = startlng;
        //Divide wappoint segment into segments as long as unit will move in geosvc.rptInterval seconds == speed * geosvc.rptInterval
        var leglength = speed * geosvc.rptInterval;
        var seglength = Math.ceil(wpdist / leglength);
        while (seglength > 0) {
            geosvc.movementsegments[entityid].push({
                lat: slat, lon: slng
            });
            //console.log("move: " + entityid + ": from " + slat + ", " + slng + ", speed:" speed);
            var nextloc = geosvc.translateCoord(slat, slng, leglength, bearing);
            slat = nextloc[0];
            slng = nextloc[1];
            seglength--;
        }
    };
    geosvc.calcDistanceMeters = function (lat1, lng1, lat2, lng2) {
        var R = 6371000;
        // metres
        var lr1 = lat1 * Math.PI / 180; //to radians
        var lr2 = lat2 * Math.PI / 180;
        var lnr1 = lng1 * Math.PI / 180;
        var lnr2 = lng2 * Math.PI / 180;
        var x = (lnr2 - lnr1) * Math.cos((lr1 + lr2) / 2);
        var y = (lr2 - lr1);
        var d = Math.sqrt(x * x + y * y) * R;
        return d;
    };
    geosvc.calcBearing = function (lat1, lng1, lat2, lng2) {
        var lr1 = lat1 * Math.PI / 180; // to Radians
        var lr2 = lat2 * Math.PI / 180;
        var lnr1 = lng1 * Math.PI / 180;
        var lnr2 = lng2 * Math.PI / 180;
        var y = Math.sin(lnr2 - lnr1) * Math.cos(lr2);
        var x = Math.cos(lr1) * Math.sin(lr2) - Math.sin(lr1) * Math.cos(lr2) * Math.cos(lnr2 - lnr1);
        var brng = Math.atan2(y, x) * 180 / Math.PI;
        return brng;
    };
    geosvc.translateCoord = function (lat, lon, distance, bearing) {
        var coord = [];
        var R = 6371000;
        // meters , earth Radius approx
        var PI = 3.1415926535;
        var RADIANS = PI / 180;
        var DEGREES = 180 / PI;
        var lat2;
        var lon2;
        var lat1 = lat * RADIANS;
        var lon1 = lon * RADIANS;
        var radbearing = bearing * RADIANS;
        lat2 = Math.asin(Math.sin(lat1) * Math.cos(distance / R) + Math.cos(lat1) * Math.sin(distance / R) * Math.cos(radbearing));
        lon2 = lon1 + Math.atan2(Math.sin(radbearing) * Math.sin(distance / R) * Math.cos(lat1), Math.cos(distance / R) - Math.sin(lat1) * Math.sin(lat2));
        coord = [lat2 * DEGREES, lon2 * DEGREES];
        return (coord);
    };
    geosvc.setNetViz = function (e, netsel) {
        geosvc.entities = e;
        for (i = 0; i < e.length; i++) {
            if (netsel[e[i]._network] && geosvc.sdatasources[geosvc.missionid].entities.getById(e[i]._id)) {
                if (netsel[e[i]._network].show) {
                    geosvc.sdatasources[geosvc.missionid].entities.getById(e[i]._id).show = true;
                    geosvc.showWP(e[i]._id);
                } else {
                    geosvc.sdatasources[geosvc.missionid].entities.getById(e[i]._id).show = false;
                    geosvc.hideWP(e[i]._id);
                }
            }
            else if (geosvc.sdatasources[geosvc.missionid].entities.getById(e[i]._id)) {
                geosvc.sdatasources[geosvc.missionid].entities.getById(e[i]._id).show = false;
                geosvc.hideWP(e[i]._id);
            }
        }
    };
    geosvc.showWP = function (uid) {
        if (geosvc.waypoints[uid]) {
            for (w = 1; w < geosvc.waypoints[uid].length + 1; w++) {
                if (geosvc.wpdatasources[geosvc.missionid].entities.getById(uid + 'WP' + w)) {
                    geosvc.wpdatasources[geosvc.missionid].entities.getById(uid + 'WP' + w).show = true;
                }
            }
        }
    };
    geosvc.hideWP = function (uid) {
        if (geosvc.waypoints[uid]) {
            for (w = 1; w < geosvc.waypoints[uid].length + 1; w++) {
                if (geosvc.wpdatasources[geosvc.missionid].entities.getById(uid + 'WP' + w)) {
                    geosvc.wpdatasources[geosvc.missionid].entities.getById(uid + 'WP' + w).show = false;
                }
            }
        }
    };
    geosvc.hideAllWP = function () {
        console.log("hideAllWP .. " + geosvc.missionid)
        var wpent = geosvc.wpdatasources[geosvc.missionid].entities.values;
        for (p = 0; p < wpent.length; p++) {
            geosvc.wpdatasources[geosvc.missionid].entities.getById(wpent[p].id).show = false;
        }
    };
    geosvc.showAllWP = function () {
        console.log("showAllWP .. " + geosvc.missionid)
        var wpent = geosvc.wpdatasources[geosvc.missionid].entities.values;
        for (p = 0; p < wpent.length; p++) {
            geosvc.wpdatasources[geosvc.missionid].entities.getById(wpent[p].id).show = true;
        }
    };
    geosvc.joinNetworks = function (entities, networks, msgsvc, $scope) {
        console.log("joinNetworks");
        for (e = 0; e < entities.length; e++) {
            if ($scope.netselected[entities[e]._network]) {
                $scope.netselected[entities[e]._network].show === true;
                $scope.netselected[entities[e]._network].network = entities[e]._network;
                geosvc.setNetViz(entities, $scope.netselected);
            } else {
                $scope.netselected[entities[e]._network] = [];
                $scope.netselected[entities[e]._network].show = true;
                $scope.netselected[entities[e]._network].network = entities[e]._network;
                geosvc.setNetViz(entities, $scope.netselected);
            }
        }
        for (n = 0; n < networks.length; n++) {
            msgsvc.joinNet(networks[n]._name);
        }
    };
    return geosvc;
});
TacMapServer.factory('MsgService', function () {
    var msgsvc = {
    };
    msgsvc.serverid;
    msgsvc.missionid;
    msgsvc.connected = false;
    msgsvc.sending = false;
    msgsvc.lastSendingTime = 0;
    msgsvc.units = [];
    msgsvc.socket = io();
    // Sends a message
    msgsvc.joinNet = function (netname) {
        msgsvc.socket.emit('server join', {
            serverid: msgsvc.serverid, netname: netname
        });
    };
    msgsvc.leaveNet = function (netname) {
        msgsvc.socket.emit('server leave', {
            serverid: msgsvc.serverid, netname: netname
        });
    };
    msgsvc.setMission = function (name, missiondata) {
        msgsvc.socket.emit('set mission', {
            missionid: name, missiondata: missiondata
        });
    };
    msgsvc.sendMessage = function (msg) {
        var message = msg;
        // if there is a non-empty message and a socket connection
        if (message && msgsvc.connected) {
            console.log("sendMessage from " + message.unit + " at " + message.time + " posrep: " + message.position[0] + ", " + message.position[1]);
            // tell server to execute 'new message' and send along one parameter
            msgsvc.socket.emit('send msg', {
                message: message
            });
        }
    };
    msgsvc.connectServer = function (data, sname, missionjson) {
        console.log(data.message + " " + data.socketid);
        msgsvc.connected = true;
        msgsvc.missionid = sname;
        //console.log(missionjson);
        msgsvc.socket.emit('server connected', {
            message: 'server', socketid: data.socketid, missionid: msgsvc.missionid, missiondata: missionjson
        });
    };
    msgsvc.disconnectServer = function (data) {
        console.log("Server Disconnected " + data.socketid);
        msgsvc.connected = false;
        msgsvc.socket.emit('server disconnected', {
            message: 'server', socketid: data.socketid, mission: msgsvc.missionid
        });
    };
    return msgsvc;
});
TacMapServer.factory('DlgBx', function ($window, $q) {
    var dlg = {
    };
    dlg.alert = function alert(message) {
        var defer = $q.defer();
        $window.alert(message);
        defer.resolve();
        return (defer.promise);
    };
    dlg.prompt = function prompt(message, defaultValue) {
        var defer = $q.defer();
        // The native prompt will return null or a string.
        var response = $window.prompt(message, defaultValue);
        if (response === null) {
            defer.reject();
        } else {
            defer.resolve(response);
        }
        return (defer.promise);
    };
    dlg.confirm = function confirm(message) {
        var defer = $q.defer();
        // The native confirm will return a boolean.
        if ($window.confirm(message)) {
            defer.resolve(true);
        } else {
            defer.reject(false);
        }
        return (defer.promise);
    };
    return dlg;
});