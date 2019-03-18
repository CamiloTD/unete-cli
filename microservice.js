const path = require('path');
const cwd = process.cwd()
const cp = require('child_process');

class Microservice {

    constructor (config, name) {
        this.name = name;
        this.config = config;
    }

    exec () {
        const folder = path.resolve(cwd, this.config.folder);
        const command = this.config.command;

        console.log(`Executing ${command.cyan.bold} on ${folder.cyan.bold}`);

        return this.child_process = cp.exec(command, { cwd: folder });
    }

    bind () {
        this.child_process.stderr.pipe(process.stderr);
        this.child_process.stdout.pipe(process.stdout);
    }

}

module.exports = Microservice;