const fs = require('fs');
const path = require('path');
const DATA_PATH = path.join(__dirname, 'data')

try { fs.mkdirSync(DATA_PATH); } catch (exc) {}

class Storage {
    constructor (name) {
        this.path = path.join(DATA_PATH, name + '.json')
        this.data = {};

        this.load();
    }

    load () {
        try {
            return this.data = JSON.parse(fs.readFileSync(this.path));
        } catch (exc) {
            return this.data = {};
        }
    }
    
    save () {
        return fs.writeFileSync(this.path, JSON.stringify(this.data));
    }
    
    set (key, value) {
        this.data[key] = value;
        this.save();
    }
    
    get (key) {
        return this.data[key];
    }

    remove (key) {
        delete this.data[key];
        this.save();
    }

    _export () {
        return Buffer.from(JSON.stringify(this.data)).toString('base64');
    }

    _import (_data) {
        const data = JSON.parse(Buffer.from(_data, 'base64'));

        for(const i in data) this.data[i] = data[i];

        this.save();
    }
}

module.exports = (name) => new Storage(name);