/* global resources */

// ***** SERVER CONTROLLERS ******//
TacMapServer.controller('storeCtl', function ($indexedDB, $scope, $http, GeoService, MsgService, DlgBx) {
    var stctl = this;
    console.log("storeCtl");
    stctl.xj = new X2JS();
    var dB = $indexedDB;
    var ellipsoid = scene.globe.ellipsoid;
    stctl.unitselected = null;
    stctl.unitselectedid = null;
    stctl.currmission = null;
    stctl.editchecked = false;
    stctl.editlocchecked = false;
    stctl.editrptchecked = false;
    stctl.rptto = [];
    stctl.import = false;
    //   
    stctl.entities = [];
    stctl.units = [];
    stctl.networks = [];
    stctl.mission = [];
    stctl.missionlist = [];
    stctl.waypoints = [];
    stctl.loc = [];
    stctl.showWP = 0;
    $scope.selmission = { id: 0, name: 'Default' };
    $scope.netselected = [];
    stctl.speedsel = [];
    //
    stctl.lftClickHandler = new Cesium.ScreenSpaceEventHandler(scene.canvas);
    stctl.lftClickHandler.setInputAction(function (mouse) {
        var pickedObject = scene.pick(mouse.position);
        if (Cesium.defined(pickedObject) && pickedObject.id.position !== undefined && pickedObject.id.billboard) {
            stctl.selectUnit(pickedObject.id);
        } else {
            stctl.loc = [];
            stctl.unitselected = null;
            $scope.$apply();
        }
    },
        Cesium.ScreenSpaceEventType.LEFT_CLICK);
    stctl.rtClickHandler = new Cesium.ScreenSpaceEventHandler(scene.canvas);
    stctl.rtClickHandler.setInputAction(function (mouse) {
        //console.log("edit: " + stctl.editchecked);
        //console.log("speed: " + $scope.speedsel._value);
        var cartesian = viewer.camera.pickEllipsoid(mouse.position, ellipsoid);
        if (stctl.editchecked && cartesian && stctl.unitselected !== null) {
            //console.log("unitselected: " + stctl.unitselected._id);
            var cartographic = ellipsoid.cartesianToCartographic(cartesian);
            stctl.addWaypoint(stctl.loc, Cesium.Math.toDegrees(cartographic.latitude), Cesium.Math.toDegrees(cartographic.longitude), stctl.speedsel._value);
        }
        if (stctl.editlocchecked && cartesian && stctl.unitselected !== null) {
            var cartographic = ellipsoid.cartesianToCartographic(cartesian);
            stctl.setLocation(stctl.unitselected, Cesium.Math.toDegrees(cartographic.latitude), Cesium.Math.toDegrees(cartographic.longitude));
        }
    },
        Cesium.ScreenSpaceEventType.RIGHT_CLICK);

    stctl.selectUnit = function (u, zoomto) {
        //console.log($scope.selmission.id);
        //console.log(GeoService.sdatasources[$scope.selmission.name]);
        stctl.unitselected = GeoService.sdatasources[$scope.selmission.name].entities.getById(u._id);
        stctl.unitselectedid = stctl.unitselected._id;
        stctl.loc = stctl.getLoc(stctl.unitselected);
        if (zoomto) {
            GeoService.sdatasources[$scope.selmission.name].selectedEntity = stctl.unitselected;
            viewer.selectedEntity = stctl.unitselected;
            viewer.camera.flyTo({
                destination: Cesium.Cartesian3.fromDegrees(stctl.loc[1], stctl.loc[0], 10000.0),
                duration: 1
            });
        } else {
            $scope.$apply();
        }
    };
    stctl.getLoc = function (entity) {
        var cartesian = entity.position.getValue();
        var cartographic = ellipsoid.cartesianToCartographic(cartesian);
        var latitudeString = Cesium.Math.toDegrees(cartographic.latitude);
        var longitudeString = Cesium.Math.toDegrees(cartographic.longitude);
        entity.description = "Location: " + latitudeString + ", " + longitudeString;
        return ([latitudeString, longitudeString]);
    };
    stctl.setLocation = function (entity, lat, lng) {
        GeoService.sdatasources[$scope.selmission.name].entities.getById(entity._id).position = Cesium.Cartesian3.fromDegrees(lng, lat);
        stctl.removeAllWp();
        stctl.updateDb(entity._id, '_location', lat + "," + lng);
        stctl.selectUnit(entity);
    };
    //
    stctl.addWaypoint = function (startpt, lat, lng, speed) {
        //console.log("Add Waypoint " + stctl.unitselected._id + " " + lat + " " + lng + " " + speed);
        if (GeoService.waypoints[stctl.unitselected._id]) {
            stctl.waypoints[stctl.unitselected._id] = GeoService.waypoints[stctl.unitselected._id];
        }
        if (!stctl.waypoints[stctl.unitselected._id]) {
            stctl.waypoints[stctl.unitselected._id] = [];
            stctl.waypoints[stctl.unitselected._id].push([startpt[0], startpt[1], speed]);
        }
        if (stctl.waypoints[stctl.unitselected._id].length === 0) {
            stctl.waypoints[stctl.unitselected._id].push([startpt[0], startpt[1], speed]);
        }
        stctl.waypoints[stctl.unitselected._id].push([lat, lng, speed]);
        GeoService.waypoints[stctl.unitselected._id] = stctl.waypoints[stctl.unitselected._id];
        var obj = stctl.waypoints[stctl.unitselected._id];
        var len = obj.length;
        //console.log("len: " + len);
        if (len > 1) {
            var arr = [obj[len - 2][1], obj[len - 2][0], obj[len - 1][1], obj[len - 1][0]];
            GeoService.wpdatasources[$scope.selmission.name].entities.add({
                id: stctl.unitselected._id + 'WP' + stctl.waypoints[stctl.unitselected._id].length,
                polyline: {
                    positions: Cesium.Cartesian3.fromDegreesArray(arr),
                    width: 1,
                    material: Cesium.Color.LIGHTYELLOW
                }
            });
            stctl.updateDb(stctl.unitselected._id, "waypoints", stctl.waypoints[stctl.unitselected._id]);
        }
    };
    stctl.removeLastWp = function () {
        stctl.waypoints[stctl.unitselected._id] = GeoService.waypoints[stctl.unitselected._id];
        if (stctl.waypoints[stctl.unitselected._id]) {
            if (stctl.unitselected && stctl.waypoints[stctl.unitselected._id].length > 1) {
                console.log("Remove Waypoint " + stctl.unitselected._id + 'WP' + stctl.waypoints[stctl.unitselected._id].length);
                GeoService.wpdatasources[$scope.selmission.name].entities.removeById(stctl.unitselected._id + 'WP' + stctl.waypoints[stctl.unitselected._id].length);
                stctl.waypoints[stctl.unitselected._id].splice(-1, 1);
                GeoService.waypoints[stctl.unitselected._id] = stctl.waypoints[stctl.unitselected._id];
                stctl.updateDb(stctl.unitselected._id, "waypoints", stctl.waypoints[stctl.unitselected._id]);
            }
        }
    };
    stctl.removeAllWp = function () {
        if (GeoService.waypoints[stctl.unitselected._id]) {
            stctl.waypoints[stctl.unitselected._id] = GeoService.waypoints[stctl.unitselected._id];
        }
        if (stctl.waypoints[stctl.unitselected._id]) {
            var len = stctl.waypoints[stctl.unitselected._id].length;
            for (ln = len; ln > 0; ln--) {
                GeoService.wpdatasources[$scope.selmission.name].entities.removeById(stctl.unitselected._id + 'WP' + ln);
            }
        }
        stctl.waypoints[stctl.unitselected._id] = [];
        GeoService.waypoints[stctl.unitselected._id] = [];
        stctl.updateDb(stctl.unitselected._id, "waypoints", stctl.waypoints[stctl.unitselected._id]);
    };
    //
    stctl.saveMission = function (currentmission) {
        console.log("saveMission");
        DlgBx.prompt("Enter Save As Name or Overwrite", currentmission.value).then(function (newname) {
            var overwrite = null;
            var overwriteid = null;
            for (n = 0; n < stctl.missionlist.length - 1; n++) {
                if (newname === stctl.missionlist[n].value) {
                    overwrite = stctl.missionlist[n].value;
                    overwriteid = stctl.missionlist[n].value;
                }
            }
            if (overwrite !== null) {
                DlgBx.confirm("This Action will Overwrite Mission", overwrite).then(function (yes) {
                    if (yes) {
                        console.log("Save " + overwrite);
                        stctl.overwriteMission(overwrite);
                        stctl.currmission = currentmission;
                        stctl.loadMission({ id: overwriteid, name: overwrite });
                    }
                });
            } else {
                console.log("Save " + newname);
                stctl.copyMission($scope.selmission.name, newname);
                stctl.missionlist.push({
                    id: stctl.missionlist.length - 1, name: newname
                });
                stctl.currmission = currentmission;
                stctl.loadMission(stctl.missionlist[stctl.missionlist.length - 1]);
            }
        });
    };
    stctl.loadMission = function (nextmission) {
        console.log("loadMission " + nextmission.name);
        //console.log("Current Mission:" + stctl.currmission.value);
        $scope.netselected = [];
        viewer.dataSources.remove(GeoService.sdatasources[$scope.selmission.name]);
        viewer.dataSources.remove(GeoService.wpdatasources[$scope.selmission.name]);
        dB.openStore("Missions", function (store) {
            store.find(nextmission.name).then(function (sc) {
                stctl.entities = sc.data.Mission.Entities.Entity;
                stctl.networks = sc.data.Mission.Networks.Network;
                GeoService.initGeodesy(nextmission.name, sc.data, $scope);
                stctl.currmission = nextmission;
                MsgService.setMission(nextmission.name, sc.data);
                GeoService.joinNetworks(stctl.entities, stctl.networks, MsgService, $scope);
            });
        });
        $scope.selmission = nextmission;
    };
    //
    stctl.clearDb = function () {
        console.log("Clear DB");
        DlgBx.confirm("Confirm Deletion of Local Data").then(function () {
            viewer.dataSources.remove(GeoService.sdatasources[$scope.selmission.name]);
            viewer.dataSources.remove(GeoService.wpdatasources[$scope.selmission.name]);
            dB.openStore('Resources', function (store) {
                store.clear();
            });
            dB.openStore('Mission', function (store) {
                store.clear();
            });
        });
    };
    stctl.exportMission = function () {
        console.log("exportMission");
        DlgBx.prompt("Enter Export Save As Name:", $scope.selmission.name).then(function (newname) {
            if (newname === 'Default') {
                DlgBx.alert("You Can't' Overwrite the Default Mission");
            } else {
                var overwrite = null;
                for (n = 0; n < stctl.missionlist.length; n++) {
                    if (newname === stctl.missionlist[n].mission) {
                        overwrite = stctl.missionlist[n].mission;
                    }
                }
                if (overwrite !== null) {
                    DlgBx.confirm("This Action will Overwrite Mission", overwrite).then(function (yes) {
                        if (yes) {
                            console.log("Export " + overwrite);
                            dB.openStore("Missions", function (store) {
                                store.find(overwrite).then(function (scen) {
                                    var mission = scen.data;
                                    //console.log(mission);
                                    $http.put("/json/" + overwrite.replace(' ', '') + '.json', mission);
                                });
                            });
                        }
                    });
                } else {
                    console.log("Export " + newname);
                    dB.openStore("Missions", function (store) {
                        store.find($scope.selmission.name).then(function (scen) {
                            var mission = scen.data;
                            $http.post("/json/" + newname.replace(' ', '') + '.json', mission)
                                .success(function () {
                                    console.log("Saved " + newname + " to /json/" + newname.replace(' ', '') + ".json");
                                    stctl.missionlist.push({
                                        id: stctl.missionlist.length - 1, name: newname.replace(' ', '') + ".json", url: "/json/" + newname.replace(' ', '') + ".json"
                                    });
                                    dB.openStore('Resources', function (store) {
                                        store.upsert({
                                            name: "missions.json", url: "/json/missions.json", data: stctl.missionlist
                                        }).then(function () {
                                            store.find("missions.json").then(function (st) {
                                                $http.put('/json/missions.json', st.data);
                                            });
                                        });
                                    });
                                });
                        });
                    });
                }
            }
            stctl.import = false;
        });
    };
    stctl.importMission = function () {
        stctl.import = true;
    };
    stctl.getFile = function (savedmission) {
        console.log("Get File: " + savedmission.name + ", " + savedmission.url);
        $http.get(savedmission.url).success(function (sdata) {
            DlgBx.prompt("Enter Save As Name or Overwrite", savedmission.mission).then(function (newname) {
                if (newname === "Default") {
                    DlgBx.alert("You Can't' Overwrite the Default Mission");
                } else {
                    var overwrite = null;
                    for (i = 0; i < stctl.missionlist.length; i++) {
                        if (newname === stctl.missionlist[i].value) {
                            overwrite = stctl.missionlist[i].value;
                            console.log(overwrite);
                            overwriteid = stctl.missionlist[i].value;
                            break;
                        }
                    }
                    if (overwrite !== null) {
                        console.log(overwrite);
                        DlgBx.confirm("This Action will Overwrite Mission " + overwrite).then(function (yes) {
                            if (yes) {
                                stctl.mission = sdata;
                                stctl.overwriteMission(overwrite);
                            }
                        });
                    } else {
                        console.log("Save " + newname);
                        stctl.mission = sdata;
                        dB.openStore("Missions", function (store) {
                            store.insert({ name: newname, data: sdata }).then(function () {
                                stctl.missionlist.push({
                                    id: stctl.missionlist.length - 1, name: newname
                                });
                                stctl.currmission = { id: stctl.missionlist.length - 1, name: newname };
                                stctl.loadMission(savedmission);
                            });
                        });
                    }
                }
            });
        });
    };
    //
    stctl.updateDb = function (entityId, fieldname, value) {
        dB.openStore("Missions", function (store) {
            store.find($scope.selmission.name).then(function (mission) {
                stctl.mission = mission.data;
                for (i = 0; i < stctl.mission.Mission.Entities.Entity.length; i++) {
                    if (stctl.mission.Mission.Entities.Entity[i]._id === entityId) {
                        stctl.mission.Mission.Entities.Entity[i][fieldname] = value;
                    }
                }
            }).then(function () {
                store.upsert({ name: $scope.selmission.name, data: stctl.mission });
            });
        });
    };
    stctl.updateMission = function () {
        dB.openStore("Missions", function (store) {
            store.upsert({ name: $scope.selmission.name, data: stctl.mission });
        });
    };
    stctl.copyMission = function (currentmission, newmissionid) {
        dB.openStore("Missions", function (store) {
            store.find(currentmission).then(function (mission) {
                store.insert({ name: newmissionid, data: mission.data });
            });
        });
    };
    stctl.overwriteMission = function (missionid) {
        console.log("overwriteMission: " + missionid);
        dB.openStore("Missions", function (store) {
            store.find(missionid).then(function () {
                store["delete"](missionid).then(function () {
                    store.insert({ name: missionid, data: stctl.mission });
                });
            });
        });
    };
    stctl.deleteMission = function (currentmission) {
        if ($scope.selmission.id === 0) {
            DlgBx.alert("Can't delete Default Mission");
        } else {
            DlgBx.confirm("Confirm deletion of Mission: " + currentmission.value).then(function (yes) {
                console.log("Confirm response: " + $scope.selmission.id);
                if (yes && $scope.selmission.id !== 0) {
                    console.log("Delete from Idb: " + currentmission.value);
                    dB.openStore("Missions", function (store) {
                        store["delete"](currentmission.value);
                    });
                    var na = [];
                    for (i = 0; i < stctl.missionlist.length; i++) {
                        if (stctl.missionlist[i].value !== currentmission.value) {
                            na.push(stctl.missionlist[i]);
                        }
                    }
                    stctl.missionlist = na;
                    stctl.loadMission(stctl.missionlist[na.length - 1]);
                } else {

                }
            });
        }
    };
    //
    stctl.addFile = function (mission, filename, data) {
        $http.post("/json/" + filename, data)
            .success(function () {
                console.log("Saved " + mission + " to /json/" + filename + ".json");
                stctl.missionlist.push({
                    id: stctl.missionlist.length - 1, name: filename, url: "/json/" + filename
                });
                dB.openStore('Resources', function (store) {
                    store.upsert({
                        name: "missions.json", url: resources[1], data: stctl.missionlist
                    }).then(function () {
                        $http.post("/json/missions.json", stctl.missionlist).success(
                            function () {
                                console.log("Updated File List");
                            });
                    });
                });
            });
    };
    stctl.overwriteFile = function (mission, filename, data) {
        $http.post("/json/" + filename, data)
            .success(function () {
                console.log("Saved " + mission + " to /json/" + filename + ".json");
            });
    };
    //
    stctl.toggleWaypoints = function () {
        console.log(stctl.showWP);
        if (stctl.showWP) {
            GeoService.showAllWP();
        } else {
            GeoService.hideAllWP();
        }
    };
    stctl.showUnit = function (unit) {
        if ($scope.netselected[unit._network]) {
            return $scope.netselected[unit._network].show;
        }
    };
    stctl.selectNetwork = function (net) {
        console.log("selectNetwork " + net._name);
        stctl.entities = GeoService.entities;
        if ($scope.netselected[net._name]) {
            if ($scope.netselected[net._name].show === true) {
                $scope.netselected[net._name].show = false;
                MsgService.leaveNet(net._name);
            } else {
                $scope.netselected[net._name].show = true;
                $scope.netselected[net._name].network = net._name;
                MsgService.joinNet(net._name);
            }
            GeoService.setNetViz(stctl.entities, $scope.netselected);
            return $scope.netselected[net._name].show;
        } else {
            $scope.netselected[net._name] = [];
            $scope.netselected[net._name].show = true;
            $scope.netselected[net._name].network = net._name;
            GeoService.setNetViz(stctl.entities, $scope.netselected);
            MsgService.joinNet(net._name);
            return $scope.netselected[GeoService.entities, net._name].show;
        }
    };
    stctl.netSelected = function (net) {
        if ($scope.netselected[net._name]) {
            return $scope.netselected[net._name].show;
        }
    };
    //
    stctl.sortByKey = function (array, key) {
        return array.sort(function (a, b) {
            var x = a[key];
            var y = b[key];
            return ((x < y) ? -1 : ((x > y) ? 1 : 0));
        });
    };
    //
    stctl.syncResource = function (msnid, $http, url, dB, stctl, GeoService) {
        $http.get(url).then(function (result) {
            var mod = result.headers()['last-modified'];
            var filename = url.substring(url.lastIndexOf('/') + 1);
            var jdata = stctl.xj.xml_str2json(result.data);
            var mname = jdata.Mission._name;
            var jname = mname.replace(' ', '').toLowerCase();
            stctl.missionlist.push({ id: msnid, name: mname, url: 'json/' + jname + '.json' });
            $http.post("/json/missions.json", angular.toJson(stctl.sortByKey(stctl.missionlist, 'id')));
            if (filename === 'DefaultMission.xml') {
                $http.get('/json/defaultmission.json').then(function (result) {
                    var jdata = result.data;
                    dB.openStore('Missions', function (mstore) {
                        mstore.upsert({ name: mname, url: 'json/' + jname + '.json', data: jdata }).then(function () {
                            console.log('init geo');
                            stctl.mission = jdata;
                            stctl.networks = jdata.Mission.Networks.Network;
                            stctl.speeds = jdata.Mission.Speeds.Speed;
                            stctl.speedsel = stctl.speeds[0];
                            stctl.entities = jdata.Mission.Entities.Entity;
                            GeoService.initGeodesy(jdata.Mission._name, jdata);
                            $scope.selmission.name = jdata.Mission._name;
                            stctl.loadMission({ id: 0, name: "Default" });
                        });
                    });
                });
            } else {
                dB.openStore('Missions', function (mstore) {
                    mstore.upsert({ name: mname, url: 'json/' + jname + '.json', data: jdata }).then(function () {
                        dB.openStore('Resources', function (store) {
                            store.getAllKeys().then(function (keys) {
                                if (keys.indexOf(filename) === -1) {
                                    store.upsert({ name: filename, url: url, lastmod: mod, data: jdata });
                                } else {
                                    store.find(filename).then(function (dbrec) {
                                        if (dbrec.lastmod !== mod) {
                                            console.log('upsert ' + filename);
                                            store.upsert({ name: filename, url: url, lastmod: mod, data: jdata });
                                        }
                                    });
                                }
                                stctl.loadMission({ id: 0, name: "Default" });
                            });
                        });
                    });
                });
            }
        })
    };
    //
    MsgService.socket.on('connection', function (data) {
        MsgService.serverid = data.socketid;
        MsgService.connectServer(data, $scope.selmission.name, stctl.mission);
    });
    MsgService.socket.on('unit connected', function (data) {
        console.log("Unit connected " + data.id);
        MsgService.setMission($scope.selmission.name, stctl.mission);
        //msgctl.messages.push({text: "Unit " + data.socketid + " connected"});

    });
    MsgService.socket.on('init server', function (data) {
        console.log('init server: ' + data.missionid);
        $scope.selmission.name = data.scenarioname;
        $http.get('xml/missions.xml').then(function (resdata, status, headers) {
            var msns = stctl.xj.xml_str2json(resdata.data);
            for (i = 0; i < msns.Missions.Mission.length; i++) {
                var u = msns.Missions.Mission[i]._url;
                var n = msns.Missions.Mission[i]._name;
                if (u.substring(u.indexOf('.')) === '.xml') {
                    stctl.syncResource(msns.Missions.Mission[i]._id, $http, msns.Missions.Mission[i]._url, dB, stctl, GeoService);
                } else {
                    stctl.missionlist.push({ id: msns.Missions.Mission[i]._id, name: n, url: u });
                    $http.get(u).success(function (jsondata, status, headers) {
                        dB.openStore('Missions', function (mstore) {
                            console.log(n);
                            mstore.upsert({ name: n, url: u, data: jsondata });
                            $http.post("/json/missions.json", angular.toJson(stctl.sortByKey(stctl.missionlist, 'id')));
                        });
                    });
                }
            }
        });
    });
});
TacMapServer.controller('messageCtl', function ($indexedDB, $scope, $interval, GeoService, MsgService) {
    var msgctl = this;
    msgctl.dB = $indexedDB;
    msgctl.messages = [];
    //Move in increments of this many meters.
    msgctl.time = 0; //seconds
    msgctl.interval = 10000; //Rpt every 10 seconds
    msgctl.units = [];
    msgctl.movecount = 0;
    msgctl.moveleg = 10; //meters
    msgctl.running = false;
    msgctl.resetMission = function () {
        console.log("resetMission");
        msgctl.movecount = 0;
        msgctl.time = 0;
        msgctl.running = false;
        MsgService.socket.emit("mission stopped");
        MsgService.socket.emit("mission time", { time: msgctl.time });
        $interval.cancel(msgctl.playMission);
        for (m = 0; m < msgctl.units.length; m++) {
            var mv = GeoService.movementsegments[msgctl.units[m]][0];
            if (mv) {
                GeoService.sdatasources[$scope.selmission.name].entities.getById(msgctl.units[m]).position = Cesium.Cartesian3.fromDegrees(mv.lon, mv.lat);
            }
        }
    };
    msgctl.runMission = function () {
        console.log("playMission");
        msgctl.running = true;
        MsgService.socket.emit("mission running");
        for (var key in GeoService.movementsegments) {
            if (GeoService.movementsegments.hasOwnProperty(key)) { //to be safe                 
                msgctl.units.push(key);
            }
        }
        for (j = 0; j < msgctl.units.length; j++) {
            console.log(msgctl.units[j] + ": " + GeoService.movementsegments[msgctl.units[j]].length + " movements");
        }
        msgctl.playMission = $interval(msgctl.moveUnits, msgctl.interval);
    };
    msgctl.pauseMission = function () {
        console.log("pauseMission");
        msgctl.running = false;
        MsgService.socket.emit("mission stopped");
        $interval.cancel(msgctl.playMission);
    }; //move units to location at specified time interval
    msgctl.moveUnits = function () {
        for (m = 0; m < msgctl.units.length; m++) {
            var mv = GeoService.movementsegments[msgctl.units[m]][msgctl.movecount];
            if (mv) {
                var unitid = msgctl.units[m];
                var unit = GeoService.sdatasources[$scope.selmission.name].entities.getById(unitid)
                //console.log(unit);
                unit_location = mv.lat + "," + mv.lon;
                unit._rpttime = new Date().getTime();
                unit.position = Cesium.Cartesian3.fromDegrees(mv.lon, mv.lat);
                msgctl.sendReport({ unit: unit._id, time: unit._rpttime, position: [mv.lat, mv.lon] });
            }
        }
        msgctl.movecount++;
        msgctl.time = (msgctl.movecount * msgctl.interval) / 1000;
        MsgService.socket.emit("mission time", { time: msgctl.time });
    };
    msgctl.sendReport = function (msgobj) {
        //default ui
        MsgService.sendMessage(msgobj, msgobj.network);
    };
    msgctl.moveUnit = function (uid, sentto, net, lat, lon) {
        console.log("moveUnit: " + uid);
        GeoService.sdatasources[$scope.selmission.name].entities.getById(uid).position = Cesium.Cartesian3.fromDegrees(lon, lat);
        msgctl.sendReport({ unit: uid, to: sentto, time: new Date(), position: [lat, lon], network: net });
    };
    MsgService.socket.on('error', console.error.bind(console));
    MsgService.socket.on('message', console.log.bind(console));
    MsgService.socket.on('msg sent', function (data) {
        msgctl.messages.push({ text: "POSREP " + data.net + " " + data.message.unit });
        GeoService.sdatasources[$scope.selmission.name].entities.getById(data.message.unit).position = Cesium.Cartesian3.fromDegrees(data.message.position[1], data.message.position[0]);
    });
    MsgService.socket.on('unit disconnected', function (data) {
        console.log("Unit disconnected " + data.socketid);
        msgctl.messages.push({ text: "Unit " + data.socketid + " disconnected" });
    });
    MsgService.socket.on('unit joined', function (data) {
        //console.log('Unit ' + data.unitid + ' Joined Network: ' + data.netname);
        msgctl.messages.push({ text: 'Unit ' + data.unitid + ' Joined Network: ' + data.netname });
    });
    MsgService.socket.on('unit left', function (data) {
        console.log('Unit ' + data.unitid + ' Left Network: ' + data.netname);
        msgctl.messages.push({ text: 'Unit ' + data.unitid + ' Left Network: ' + data.netname });
    });
    MsgService.socket.on('server joined', function (data) {
        //console.log('Joined Network: ' + data.netname);
        msgctl.messages.push({ text: 'Joined Network: ' + data.netname });
    });
    MsgService.socket.on('server left', function (data) {
        //console.log('Left Network: ' + data.netname);
        msgctl.messages.push({ text: 'Left Network: ' + data.netname });
    });
    /*  MsgService.socket.on("start mission", function () {
         console.log("start mission");
         msgctl.running = true;
         $scope.$apply();
     }); */
    MsgService.socket.on("stop mission", function () {
        msgctl.running = false;
        $scope.$apply();
    });
    MsgService.socket.on("set time", function (data) {
        msgctl.time = data.time;
        $scope.$apply();
    });
    //
    msgctl.timeCalc = function (timeobj) {
        var day = timeobj.Day;
        var hr = timeobj.HourTime;
        var min = timeobj.MinuteTime;
        var sec = timeobj.SecondTime;
        var month = timeobj.MonthNumeric;
        var yr = timeobj.Year4Digit;
        var d = new Date(yr, month, day, hr, min, sec);
        return d.getTime();
    };
});
TacMapServer.controller('menuCtrl', function ($scope) {
    //initiate an array to hold all active tabs
    $scope.activeTabs = [];
    //check if the tab is active
    $scope.isOpenTab = function (tab) {
        //check if this tab is already in the activeTabs array
        if ($scope.activeTabs.indexOf(tab) > -1) {
            //if so, return true
            return true;
        } else {
            //if not, return false
            return false;
        }
    };
    //function to 'open' a tab
    $scope.openTab = function (tab) {
        //check if tab is already open
        if ($scope.isOpenTab(tab)) {             //if it is, remove it from the activeTabs array
            $scope.activeTabs.splice($scope.activeTabs.indexOf(tab), 1);
        } else {
            //if it's not, add it!
            $scope.activeTabs.push(tab);
        }
    };
    //function to leave a tab open if open or open if not
    $scope.leaveOpenTab = function (tab) {
        //check if tab is already open
        if (!$scope.isOpenTab(tab)) {
            //if it is not open, add to array
            $scope.activeTabs.push(tab);
        }
    };
});