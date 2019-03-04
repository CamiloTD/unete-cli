#!/usr/bin/env node
require('colors');
const cli = require('commander');
const { encrypt, decrypt } =  require('./aes');
const net = require('net');
const Commands = require('./commands');
const fs = require('fs');
/*
cli
    .command('set <alias> <url>', 'Register an unete service into the registry')
    .command('unset <alias>', 'Register an unete service into the registry')
    .command('registry', 'List registered keys')
    .command('connect <url>', 'List registered keys');*/
    
cli.version('1.0.0')
   .option('-d, --debug', 'Starts a Debugger CLI')
   .option('-p, --port <port>', 'Set port')
   .option('-m, --module <filename>', 'Set module to export')
   .option('-l, --log <port>', 'Opens a tcp log server.')
   .action((cmd, ...args) => Commands[cmd] && Commands[cmd](...args))

cli.parse(process.argv)

let { port, connect, debug, log }  = cli;

if(connect) return connectToCli(connect);

if(log) {
    const { LOG_PASS } = process.env;
    const logfile = fs.createWriteStream(".unete-logs", { flags: 'a' });

    log = +log;

    if(isNaN(log))  {
        console.log('Invalid log port'.red.bold);
        console.log("Quitting...");
        process.exit();
    }
    
    if(!LOG_PASS) {
        console.log('Please define '.red.bold + 'LOG_PASS'.cyan.bold + ' as environment variable.'.red.bold);
        console.log("Quitting...");
        process.exit();
    }

    net.createServer((sock) => {
        sock.once('data', (chunk) => {
            try {
                let data = decrypt(chunk, LOG_PASS).toString().trim();
                if(data !== LOG_PASS) return sock.end();
                
                on_stdout((data) => {
                    try {
                        sock.write(encrypt(data, LOG_PASS));
                    } catch (exc) {
                        sock.end();
                    }
                });
            } catch (exc) {
                sock.end();
            }
        });
    }).listen(log);
}

function on_stdout (cb) {
    const old_write = process.stdout.write;

    process.stdout.write = (data) => {
        old_write.call(process.stdout, data);
        cb(data);
    }
}

process.on('uncaughtException', (exc) =>  {
    console.log({ UNCAUGHT_EXCEPTION: exc });
})