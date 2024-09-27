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
(function () {
    "use strict";
    var express = require('express');
    var compression = require('compression');
    var url = require('url');
    var request = require('axios');
    var bodyParser = require('body-parser');
    var fs = require('fs');
    var cesium = require('./geoserver/cesiumserver');
    //
    var cors = require('cors');

    var server_port = 9090;
    var yargs = require('yargs').options({
        'port': {
            'default': server_port,
            'description': 'Port to listen on.'
        },
        'public': {
            'type': 'boolean',
            'description': 'Run a public server that listens on all interfaces.'
        },
        'publicssl': {
            'type': 'boolean',
            'description': 'Run a public https server that listens on all interfaces.'
        },
        'upstream-proxy': {
            'description': 'A standard proxy server that will be used to retrieve data.  Specify a URL including port, e.g. "http://proxy:8000".'
        },
        'bypass-upstream-proxy-hosts': {
            'description': 'A comma separated list of hosts that will bypass the specified upstream_proxy, e.g. "lanhost1,lanhost2"'
        },
        'help': {
            'alias': 'h',
            'type': 'boolean',
            'description': 'Show this help.'
        }
    });
    var argv = yargs.argv;
    if (argv.help) {
        return yargs.showHelp();
    }
    var app = express();
    app.use(bodyParser.json());
    app.use(express.static(__dirname + '/public'));
    app.use(compression());
    app.use(cors());

    function getRemoteUrlFromParam(req) {
        var remoteUrl = req.params[0];
        if (remoteUrl) {
            // add http:// to the URL if no protocol is present
            if (!/^https?:\/\//.test(remoteUrl)) {
                remoteUrl = 'http://' + remoteUrl;
            }
            remoteUrl = new URL(remoteUrl);
            // copy query string
            remoteUrl.search = new URL(req.url).search;
        }
        return remoteUrl;
    }

    var dontProxyHeaderRegex = /^(?:Host|Proxy-Connection|Connection|Keep-Alive|Transfer-Encoding|TE|Trailer|Proxy-Authorization|Proxy-Authenticate|Upgrade)$/i;

    function filterHeaders(req, headers) {
        var result = {};
        // filter out headers that are listed in the regex above
        Object.keys(headers).forEach(function (name) {
            if (!dontProxyHeaderRegex.test(name)) {
                result[name] = headers[name];
            }
        });
        return result;
    }

    var upstreamProxy = argv['upstream-proxy'];
    var bypassUpstreamProxyHosts = {};
    if (argv['bypass-upstream-proxy-hosts']) {
        argv['bypass-upstream-proxy-hosts'].split(',').forEach(function (host) {
            bypassUpstreamProxyHosts[host.toLowerCase()] = true;
        });
    }
    app.get('/proxy/*', function (req, res, next) {
        // look for request like http://localhost:8080/proxy/http://example.com/file?query=1
        var remoteUrl = getRemoteUrlFromParam(req);
        if (!remoteUrl) {
            // look for request like http://localhost:8080/proxy/?http%3A%2F%2Fexample.com%2Ffile%3Fquery%3D1
            remoteUrl = Object.keys(req.query)[0];
            if (remoteUrl) {
                remoteUrl = new URL(remoteUrl);
            }
        }

        if (!remoteUrl) {
            return res.send(400, 'No url specified.');
        }

        if (!remoteUrl.protocol) {
            remoteUrl.protocol = 'http:';
        }

        var proxy;
        if (upstreamProxy && !(remoteUrl.host in bypassUpstreamProxyHosts)) {
            proxy = upstreamProxy;
        }

        // encoding : null means "body" passed to the callback will be raw bytes

        request.get({
            url: url.format(remoteUrl),
            headers: filterHeaders(req, req.headers),
            encoding: null,
            proxy: proxy
        }, function (error, response, body) {
            var code = 500;
            if (response) {
                code = response.statusCode;
                res.header(filterHeaders(req, response.headers));
            }

            res.send(code, body);
        });
    });
    var server_ip_address = '127.0.0.1';
    var server = app.listen(server_port, argv.public ? undefined : server_ip_address, function () {
        if (argv.public) {
            console.log('TacMap development server running publicly.  Connect to http://localhost:%d/', server.address().port);
        }
        else if (argv.publicssl) {
            server.key = fs.readFileSync('key.pem');
            server.cert = fs.readFileSync('cert.pem');
            console.log('TacMap development server running publicly.  Connect to https://localhost:%d/', server.address().port);
        }
        else {
            console.log('TacMap development server running locally.  Connect to http://localhost:%d/', server.address().port);
        }
    });
    server.on('error', function (e) {
        if (e.code === 'EADDRINUSE') {
            console.log('Error: Port %d is already in use, select a different port.', argv.port);
            console.log('Example: node server.js --port %d', argv.port + 1);
        }
        else if (e.code === 'EACCES') {
            console.log('Error: This process does not have permission to listen on port %d.', argv.port);
            if (argv.port < 1024) {
                console.log('Try a port number higher than 1024.');
            }
        }
        console.log(e);
        process.exit(1);
    });
    server.on('close', function () {
        console.log('TacMap server stopped.');
    });
    process.on('SIGINT', function () {
        server.close(function () {
            process.exit(0);
        });
    });
    app.get('/', function (req, res) {
        res.sendFile(__dirname + '/public/server.html');
    });

    app.get('/node_modules/*', function (req, res) {
        res.sendFile(__dirname + '/' + req.url);
    });

    app.get('/server', function (req, res) {
        res.sendFile(__dirname + '/public/server.html');
    });

    app.get('/unit', function (req, res) {
        res.sendFile(__dirname + '/public/unit.html');
    });

    app.get('/json/*', function (req, res) {
        res.sendFile(__dirname + '/public' + req.url);
    });

    app.post('/json/*', function (req, res) {
        fs.writeFile(__dirname + '/public' + req.url, JSON.stringify(req.body), function () {
            res.end();
        });
    });

    app.put('/json/*', function (req, res) {
        fs.writeFile(__dirname + '/public' + req.url, JSON.stringify(req.body), function () {
            res.end();
        });
    });

    app.put('/xml/*', function (req, res) {
        console.log("Put " + req.url);
        console.log(req.body);
        fs.writeFile(__dirname + '/public' + req.url, req.body, function () {
            res.end();
        });
    });

    app.post('/entity/*'),
        function (req, res) {
            console.log("Post entity " + req.url);
            console.log(req.body);
            fs.writeFile(__dirname + '/public' + req.url, req.body, function () {
                res.end();
            });
        }

    var io = require('socket.io')(server);
    var missionid = "Default";
    var missiondata = [];
    var servers = [];
    var units = [];
    var allconnections = [];

    io.on('connection', function (socket) {

        allconnections.push(socket);

        socket.on('socketDisconnect', function () {
            var i = allconnections.indexOf(socket);
            console.log(i.id + "Socjket Disconnected");
            delete allconnections[i];
        });
        // Use socket to communicate with this particular unit only, sending it it's own id
        socket.emit('connection', {
            message: 'Msg Socket Ready',
            socketid: socket.id
        });
        socket.on('server connected', function (data) {
            console.log("server connect to socket: " + data.socketid + ", mission:" + data.missionid);
            servers.push({
                server: data.socketid
            });
            if (missionid === "Default") {
                missiondata = data.missiondata;
                io.emit('init server', {
                    target: "server",
                    missionid: data.missionid,
                    missiondata: missiondata
                });
            }
            else {
                io.emit('init server', {
                    target: "server",
                    missionid: missionid,
                    missiondata: missiondata
                });
            }
            if (missionRunning) {
                io.emit('start mission');
            }
        });
        socket.on('unit connected', function (data) {
            console.log("units connect: " + data.id + " set mission: " + missionid);
            units.push({
                unit: data.id
            });
            io.emit('unit connected', {
                missionid: missionid,
                missiondata: missiondata
            });
        });
        socket.on('send msg', function (data) {
            console.log('send msg from ' + data.message.unit + ' to ' + data.message.net);
            io.emit('msg sent', data);
        });
        socket.on('unit join', function (data) {
            //console.log(data.unitid + ' joined ' + data.netname);
            socket.join(data.netname);
            io.emit('unit joined', {
                unitid: data.unitid,
                netname: data.netname
            });
        });
        socket.on('server join', function (data) {
            //console.log(data.serverid + ' joined ' + data.netname);
            socket.join(data.netname);
            io.emit('server joined', {
                serverid: data.serverid,
                netname: data.netname
            });
        });
        socket.on('server leave', function (data) {
            // console.log(data.serverid + ' left ' + data.netname);
            socket.leave(data.netname);
            io.emit('server left', {
                serverid: data.serverid,
                netname: data.netname
            });
        });
        socket.on('unit leave', function (data) {
            //console.log(data.unitid + ' left ' + data.netname);
            socket.leave(data.netname);
            io.emit('unit left', {
                unitid: data.unitid,
                netname: data.netname
            });
        });
        socket.on('add entity', function (data) {
            console.log("emit add entity: " + data._id);
            io.emit('add entity', data);
        });
        socket.on('set mission', function (data) {
            console.log("set mission: " + data.missionid);
            missionid = data.missionid;
            missiondata = data.missiondata;
            io.emit('set mission', {
                target: "unit",
                missionid: missionid,
                missiondata: missiondata
            });
        });
        socket.on('mission running', function () {
            missionRunning = true;
            io.emit('start mission');
        });
        socket.on('mission stopped', function () {
            missionRunning = false;
            io.emit('stop mission');
        });
        socket.on('mission time', function (data) {
            io.emit('set time', data);
        });
    });
})();