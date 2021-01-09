const fs = require('fs').promises;
const path = require('path');
const {EventEmitter} = require('events');

const mkdirp = require('mkdirp');
const rimraf = require('rimraf');
const cpy = require('cpy');

const socketio = require('socket.io');
const serveStatic = require('serve-static');
const esModuleMiddleware = require('@adobe/es-modules-middleware');

const prettyHtml = require('@starptech/prettyhtml');

const build = require('../lib/build.js');
const findElements = require('../lib/elements.js');
const topicMatch = require('../lib/topic-match.js');

// From: http://stackoverflow.com/a/28592528/3016654
function join(...paths) {
    const trimRegex = /^\/|\/$/g;

    return '/' + paths.map(e => {
        return e.replace(trimRegex, '');
    }).filter(e => {
        return e;
    }).join('/');
}

class Conn extends EventEmitter {

}

module.exports = function (RED) {
    const defaultSite = `<feezal-site><feezal-view class="iron-selected" name="view1" style="
            width: 100%;
            height: 100%;
            background: var(--primary-background-color);
        "></feezal-view></feezal-site>`;

    const conn = new Conn();
    let cache = {};

    const {log, server} = RED;
    const logger = {
        debug: string => log.debug.call(this, '[feezal] ' + string),
        info: string => log.info.call(this, '[feezal] ' + string),
        warn: string => log.warn.call(this, '[feezal] ' + string),
        error: string => log.error.call(this, '[feezal] ' + string)
    };
    const app = RED.httpNode || RED.httpAdmin;

    const feezalPath = path.join(RED.settings.userDir, 'feezal');
    const viewsFile = 'views.html';

    findElements(logger);

    const fullPath = join(RED.settings.httpNodeRoot, 'feezal');
    const socketIoPath = join(fullPath, 'socket.io');
    logger.debug('feezal socket.io path', socketIoPath);
    const io = socketio(server, {path: socketIoPath});

    app.use(esModuleMiddleware.middleware({
        paths: {
            [fullPath + '/node_modules']: path.join(__dirname, '..', 'www/node_modules'),
            [fullPath + '/editor']: path.join(__dirname, '..', 'www/editor'),
            [fullPath + '/src']: path.join(__dirname, '..', 'www/src')
        }
    }));

    app.use('/feezal', serveStatic(path.join(__dirname, '..', 'www')));

    app.get('/feezal/api/views', (request, res) => {
        fs.readdir(feezalPath).then(dir => {
            res.json(dir);
        });
    });

    app.post('/feezal/api/view/new', (request, res) => {
        logger.debug('new view ' + request.body.view);
        mkdirp(path.join(feezalPath, request.body.view)).then(() => {
            res.status(200).send('ok');
        }).catch(err => {
            res.status(500).send(err.message);
        });
    });

    app.post('/feezal/api/view/clone', (request, res) => {
        logger.debug('clone view', request.body.view);
        cpy(path.join(feezalPath, request.body.view), path.join(feezalPath, request.body.newName))
            .then(() => {
                res.status(200).send('ok');
            }).catch(error => {
                res.status(500).send(error.message);
            });
    });

    app.post('/feezal/api/view/delete', (request, res) => {
        logger.debug('delete view', request.body.view);
        rimraf(path.join(feezalPath, request.body.view), err => {
            if (err) {
                res.status(500).send(err.message);
            } else {
                res.status(200).send('ok');
            }
        });
    });

    app.post('/feezal/api/view/rename', (request, res) => {
        logger.debug('rename view', request.body.view, request.body.newName);
        fs.rename(path.join(feezalPath, request.body.view), path.join(feezalPath, request.body.newName))
            .then(() => {
                res.status(200).send('ok');
            }).catch(error => {
                res.status(500).send(error.message);
            });
    });

    logger.info('server path ' + fullPath);
    logger.info('persistence path ' + feezalPath);

    io.on('connection', socket => {
        const address = socket.request.connection.remoteAddress;
        logger.debug('Feezal connect from ' + address);
        const subscriptions = new Set();

        socket.on('deploy', (data, callback) => {
            data.site = data.site || {name: 'default'};
            mkdirp(path.join(feezalPath, data.site.name)).catch(err => {
                logger.error(err.message);
            });

            const viewerJson = path.join(feezalPath, data.site.name, 'viewer.json');
            const feezalFile = path.join(feezalPath, data.site.name, viewsFile);
            fs.writeFile(viewerJson, JSON.stringify({viewer: data.viewer, connection: data.connection})).then(() => {
                logger.info('saved ' + viewerJson);

                return fs.writeFile(feezalFile, prettyHtml(data.html, {
                    tabWidth: 4,
                    prettier: {
                        jsxBracketSameLine: true
                    }
                }).toString());
            }).then(() => {
                logger.info('saved ' + feezalFile);
                return build(data, {debug: logger.debug, info: logger.info, warn: logger.warn, error: logger.error});
            }).then(() => {
                logger.info('build done');
                io.emit('reload');
            }).catch(error => {
                logger.error('deploy error ' + error.message);
            }).finally(callback);
        });

        function messageHandler(message) {
            logger.debug('input', message);
            if (message && [...subscriptions].filter(topic => topicMatch(message.topic, topic)).length > 0) {
                socket.emit('input', message);
            }
        }

        conn.on('input', messageHandler);

        socket.on('subscribe', topics => {
            topics.forEach(topic => {
                logger.debug('subscribe', topic);
                subscriptions.add(topic);
                Object.keys(cache).filter(t => topicMatch(t, topic)).forEach(t => {
                    socket.emit('input', cache[t]);
                });
            });
        });

        socket.on('getSite', (site, callback) => {
            site = site || 'default';
            logger.debug('getSite', site);
            let views = defaultSite;
            let viewer = {};
            const feezalFile = path.join(feezalPath, site, viewsFile);
            fs.readFile(feezalFile).then(data => {
                views = data.toString();
                logger.info('loaded ' + feezalFile);
            }).then(() => {
                const metaFile = path.join(feezalPath, site, 'viewer.json');
                return fs.readFile(metaFile).then(data => {
                    viewer = JSON.parse(data.toString());
                    logger.info('loaded ' + metaFile);
                });
            }).catch(() => {
                logger.warn('error loading site', site);
            }).finally(() => {
                callback({views, viewer});
            });
        });

        socket.on('send', message => {
            logger.debug('socket on send', message);
            conn.emit('send', message);
            socket.emit('input', message); // Todo: Reflect makes sense? TBD...
        });

        socket.on('disconnect', () => {
            logger.debug('disconnect', address);
            conn.removeListener('input', messageHandler);
        });
    });

    io.on('connect_error', error => {
        logger.debug('connect_error', error);
    });

    class Feezal {
        constructor(config) {
            RED.nodes.createNode(this, config);

            cache = {};

            // This.send.bind(this);

            this.on('close', done => {
                // Conn.removeListener('send', this.send);
                done();
            });

            this.on('input', message => {
                cache[message.topic] = {cached: true, ...message};
                conn.emit('input', message);
            });

            conn.on('send', message => {
                this.send(message);
            });
        }
    }

    RED.nodes.registerType('feezal', Feezal);
};
