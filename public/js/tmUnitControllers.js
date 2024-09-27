// ***** UNIT CONTROLLERS ******//
TacMapUnit.controller('viewCtl', function ($indexedDB, $scope, $http, GeoUnitService, MsgUnitService) {
    var vwctl = this;
    console.log("viewCtl");
    var dB = $indexedDB;
    var ellipsoid = scene.globe.ellipsoid;
    vwctl.unitselected = null;
    //   
    vwctl.entities = [];
    vwctl.networks = [];
    vwctl.loc = [];
    $scope.netselected = [];
    $scope.selmission = { id: 0, name: 'Default Mission' };
    vwctl.missionid = GeoUnitService.missionid;
    //
    vwctl.lftClickHandler = new Cesium.ScreenSpaceEventHandler(scene.canvas);
    vwctl.lftClickHandler.setInputAction(function (mouse) {
        var pickedObject = scene.pick(mouse.position);
        if (Cesium.defined(pickedObject) && pickedObject.id.position !== undefined && pickedObject.id.billboard) {
            vwctl.selectUnit(pickedObject.id);
        } else {
            vwctl.loc = [];
            vwctl.unitselected = null;
            $scope.$apply();
        }
    },
        Cesium.ScreenSpaceEventType.LEFT_CLICK);
    //
    vwctl.selectUnit = function (u, zoomto) {
        //console.log(u._id);
        vwctl.unitselected = GeoUnitService.sdatasources[$scope.selmission.value].entities.getById(u._id);
        vwctl.loc = vwctl.getLoc(vwctl.unitselected);
        if (zoomto) {
            GeoUnitService.sdatasources[$scope.selmission.value].selectedEntity = vwctl.unitselected;
            viewer.selectedEntity = vwctl.unitselected;
            viewer.camera.flyTo({
                destination: Cesium.Cartesian3.fromDegrees(vwctl.loc[1], vwctl.loc[0], 10000.0),
                duration: 1
            });
        } else {
            $scope.$apply();
        }
    };
    vwctl.getLoc = function (entity) {
        var cartesian = entity.position.getValue();
        var cartographic = ellipsoid.cartesianToCartographic(cartesian);
        var latitudeString = Cesium.Math.toDegrees(cartographic.latitude);
        var longitudeString = Cesium.Math.toDegrees(cartographic.longitude);
        entity.description = "Location: " + latitudeString + ", " + longitudeString;
        return ([latitudeString, longitudeString]);
    };
    vwctl.showUnit = function (unit) {
        if ($scope.netselected[unit._network]) {
            return $scope.netselected[unit._network].show;
        }
    };
    vwctl.selectNetwork = function (net) {
        //console.log("selectNetwork " + net._name);
        vwctl.entities = GeoUnitService.entities;
        if ($scope.netselected[net._name]) {
            if ($scope.netselected[net._name].show === true) {
                $scope.netselected[net._name].show = false;
                MsgUnitService.leaveNet(net._name);
            } else {
                $scope.netselected[net._name].show = true;
                $scope.netselected[net._name].network = net._name;
                MsgUnitService.joinNet(net._name);
            }
            GeoUnitService.setNetViz(vwctl.entities, $scope.netselected);
            return $scope.netselected[net._name].show;
        } else {
            $scope.netselected[net._name] = [];
            $scope.netselected[net._name].show = true;
            $scope.netselected[net._name].network = net._name;
            GeoUnitService.setNetViz(vwctl.entities, $scope.netselected);
            MsgUnitService.joinNet(net._name);
            return $scope.netselected[GeoUnitService.entities, net._name].show;
        }
    };
    vwctl.netSelected = function (net) {
        if ($scope.netselected[net._name]) {
            return $scope.netselected[net._name].show;
        }
    };
    MsgUnitService.socket.on('set mission', function (data) {
        console.log('set mission');
        $scope.netselected = [];
        viewer.dataSources.remove(GeoUnitService.sdatasources[$scope.selmission.value]);
        dB.openStore("Missions", function (store) {
            store.upsert({ name: data.missionid, data: data.missiondata });
        }).then(function () {
            $scope.selmission.value = data.missionid;
            vwctl.entities = data.missiondata.Mission.Entities.Entity;
            vwctl.networks = data.missiondata.Mission.Networks.Network;
            GeoUnitService.initGeodesy(data.missionid, data.missiondata);
            GeoUnitService.joinNetworks(vwctl.entities, vwctl.networks, MsgUnitService, $scope);
        });
    });
});
TacMapUnit.controller('UnitMesssageCtl', function ($indexedDB, $scope, MsgUnitService, GeoUnitService) {
    var msgctl = this;
    msgctl.dB = $indexedDB;
    msgctl.messages = [];
    msgctl.moveUnit = function (uid, lat, lon) {
        console.log("moveUnit: " + uid);
        GeoUnitService.sdatasources[$scope.selmission.value].entities.getById(uid).position = Cesium.Cartesian3.fromDegrees(lon, lat);
    };
    MsgUnitService.socket.on('error', console.error.bind(console));
    //    MsgUnitService.socket.on('message', console.log.bind(console));
    MsgUnitService.socket.on('connection', function (data) {
        console.log("Unit Connected " + data.socketid);
        MsgUnitService.unitid = data.socketid;
        MsgUnitService.socket.emit('unit connected', { message: 'unit', id: data.socketid });
        msgctl.messages.push({ text: "Unit Connected" });
    });
    MsgUnitService.socket.on('send msg', function (data) {
        console.log("receive msg " + data.net + ": " + data.message.unit + " " + data.message.position[0] + ", " + data.message.position[1]);
        msgctl.messages.push({ text: "POSREP " + data.net + " " + data.message.unit });
        msgctl.moveUnit(data.message.unit, data.message.position[0], data.message.position[1]);
    });
    MsgUnitService.socket.on('unit disconnected', function (data) {
        console.log("Unit disconnected " + data.socketid);
        msgctl.messages.push({ text: "Unit disconnected" });
    });
    MsgUnitService.socket.on('unit joined', function (data) {
        //console.log('Joined Network: ' + data.netname);
        msgctl.messages.push({ text: 'Joined Network: ' + data.netname });
    });
    MsgUnitService.socket.on('unit left', function (data) {
        console.log('Left Network: ' + data.netname);
        msgctl.messages.push({ text: 'Left Network: ' + data.netname });
    });
    MsgUnitService.socket.on('server joined', function (data) {
        //console.log('Server ' + data.serverid + ' Joined Net: ' + data.netname);
        msgctl.messages.push({ text: 'Server ' + data.serverid + ' Joined Net: ' + data.netname });
    });
    MsgUnitService.socket.on('server left', function (data) {
        console.log('Server ' + data.serverid + ' Left Net: ' + data.netname);
        msgctl.messages.push({ text: 'Server ' + data.serverid + ' Left Net: ' + data.netname });
    });
    MsgUnitService.socket.on('move unit', function (data) {
        msgctl.moveUnit(data.uid, data.lat, data.lon);
    });
});
TacMapUnit.controller('menuCtrl', function ($scope) {
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
        if ($scope.isOpenTab(tab)) {
            //if it is, remove it from the activeTabs array
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
