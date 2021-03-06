const Storage = require('./storage');
const Registry = Storage('registry');
const Sock = require('unete-io/socket');
const repl = require('repl');
const net = require('net');
const readline = require('readline-sync');
const path = require('path');
const Server = require('unete-io/server');
const YAML = require('yamljs');
const Microservice = require('./microservice');
const https = require('https');
const fs = require('fs');

const { encrypt, decrypt } =  require('./aes');

const REGEX_ASSIGNMENT = /^\$\.([^(]+)=(.+)$/;
const REGEX_VALUE = /^(\$\.[^(=]+)$/;

const Commands = module.exports = {

    set (alias, url) {
        Registry.set(alias, url);
        console.log('Registry alias', alias.bold.magenta, 'was set to', url.bold.cyan);
    },

    unset (alias) {
        Registry.remove(alias);
        console.log('Registry alias', alias.bold.magenta, 'was removed');
    },

    registry () {
        let registry = Registry.data;
        
        console.log("unete-cli registry:".bold);

        for(const i in registry) console.log(
            ('  + ' + i.magenta + ': ' + registry[i].cyan).bold
        );
    },

    connect (url) {
        url = Registry.get(url) || url;

        console.log(`Connecting to ${url}...`.cyan.bold, '\n');
    
        (async () => {
            let API = Sock(url);
            let store = Storage('env-vars');
            const methods = await API.$public();
            const completions = plainify(methods);

            const r = repl.start({
                prompt: 'unete-cli> '.cyan.bold,
                eval: async (cmd, $, filename, cb) => {
                    cmd = cmd.trim();
                    if(cmd === "exit") process.exit(0);
                    
                    try {

                        if(cmd === "help") {
                            console.log(`Available methods for ${url}:`.bold.cyan, helpify(methods, "", "", "  "));

                            return cb(null);        
                        }

                        let match = REGEX_ASSIGNMENT.exec(cmd);
                        
                        if(match) {
                            const val = await eval(`(async () => { return ${match[2]} })()`);
                            
                            $[match[1].trim()] = val;

                            store.set(match[1].trim(), val);
                            
                            cb(null, val);
                            return;
                        }

                        match = REGEX_VALUE.exec(cmd);

                        if(match) {
                            cb(null, eval(cmd));
                            return;
                        }

                        let rs = await eval('API.' + cmd);
    
                        cb(null, rs);
                    } catch (exc) {
                        if(typeof exc === "string") exc = exc.bold.red;
                        else if(typeof exc === "object") {
                            if(exc.message) exc = exc.message;
                            else exc = JSON.stringify(exc);
                        }
                        
                        console.log(exc.red.bold);

                        cb();
                    }
                },
                completer: (line) => {
                    const hits = completions.filter((c) => c.startsWith(line));

                    return [hits.length ? hits : completions, line];
                }
            });

            for(let i in store.data) r.context[i] = store.data[i];
        })();
    },

    "export-registry" (data) {
        console.log("Exporting registry, use this command in the target machine:".bold);
        console.log("  +".bold, "unete-cli import-registry".bold.magenta, Registry._export().bold.cyan);
    },

    "import-registry" (data) {
        Registry._import(data);
        console.log("Registry successfully imported".cyan.bold);
        Commands.registry();
    },

    attach (url, pass) {
        let _url = url;
        url = Registry.get(url) || url;

        const socket = new net.Socket();
        const [host, port] = url.split(':');
        const password = pass || readline.question(`Please enter the log security password for ${url.cyan.bold}:`.green.bold, { hideEchoBack: true });
        const selected_color = ["green", "magenta", "cyan", "red", "yellow", "blue", "grey"][Math.floor(Math.random() * 7)];
            
        socket.connect(port, host, () => {

            socket.on('data', (chunk) => {
                const data = decrypt(chunk, password);

                process.stdout.write(`> ${_url}: `.bold[selected_color] + data);
            })

            socket.write(encrypt(password, password));
        });
    },

    start (_module, port, program) {
        if(!program) {
            program = port;
            port = undefined;
        }

        const config = program.config? YAML.load(program.config) : {};
        if(!port && !config.port) throw "PORT_EXPECTED";
        if(!port) port = config.port;

        _module = require(path.join(process.cwd(), _module || 'index.js'));

        var https_server; // HTTPS Server
        if(config.https) {
           https_server = https.createServer({
                key : fs.readFileSync(path.resolve(process.cwd(), config.https.key)),
                cert: fs.readFileSync(path.resolve(process.cwd(), config.https.cert)),
                ca  : fs.readFileSync(path.resolve(process.cwd(), config.https.ca))
            });

        }

        let server = new Server(_module, https_server);

        if(program.log) {
            server.on('connection', (sock) => {
                sock.on('call', ({ path, args, cb }) => {
                    if(!Array.isArray(path)) return;
                    const _args = args.map((arg, i) => {
                        let type = typeof arg;

                        if(cb[i]) type = "function";

                        return (type[0].toUpperCase() + type.substring(1)).bold.magenta;
                    }).join(", ");

                    let addr = sock.request.connection.remoteAddress;

                    if(addr.indexOf("::ffff:") === 0) addr = addr.substring(7);

                    console.log(`[${addr}]`.green.bold + ' => ' + `${path.join('.')}(${_args.bold.magenta}`.bold.cyan + ")".bold.cyan);
                });
            });
        }
    
        (async () => {
            if(config.https)
                await https_server.listen(port);
            else
                await server.listen(port);

            console.log(("Microservice running at port :" + port).bold.cyan);
        })();
    },

    watch (...connections) {
        connections.forEach((connection) => {
            if(typeof connection !== "string") return;
            const [url, pass] = connection.split("/");

            Commands.attach(url, pass);
        });
    },

    async admin (file) {
        const ms_config = YAML.load(file);
        const Services = {};

        for(const name in ms_config) {
            const config = ms_config[name];
            const ms = Services[name] = new Microservice(config, name);

            ms.exec();
            ms.bind();
        }
    }
}

function helpify (obj, header = "", pre = "", tabs="") {
    let str = (header && `+ ${pre + "*"}:`.bold.cyan) || "";

    for(let i in obj) {
        let fn = obj[i];

        if(typeof fn === "object" && !Array.isArray(fn)) str += "\n" + tabs + helpify(fn, i, i + ".", tabs + "  ");
        else {
            let args = Array.isArray(fn)? fn.map((x) => x.bold.magenta).join(', '.bold.cyan) : "...".bold.magenta;

            str += `\n${tabs}${'+'.bold.cyan} ${pre.bold.cyan}${i.bold.cyan}${`(${args})`.bold.cyan}`;
        }
    }

    return str;
}

function plainify (obj, pre="") {
    let x = [];

    for(let i in obj) {
        let y = obj[i];

        if(typeof y === "object" && !Array.isArray(y)) x = [...x, ...plainify(y, i + ".")];
        else x.push(pre + i);
    }

    return x;
}