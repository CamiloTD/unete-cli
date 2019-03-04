const UneteIO = require('../index');
const Server = new UneteIO.Server(require('./server'));
const Client = UneteIO.Socket('http://127.0.0.1:9999');
const Proxy = UneteIO.Socket('http://127.0.0.1:60000');

(async () => {
    Server.listen(9999);

    Client.step(function () {
        console.log("Hey! Hey! Hey!");
    });

})();