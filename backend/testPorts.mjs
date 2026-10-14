// Preloaded by `npm test` (node --test --import ./testPorts.mjs).
//
// The tests start the app on port 0 and call it with fetch(). fetch refuses a fixed list of "bad"
// ports (the WHATWG list: 3659, 4045, 5060, 6000, 6665-6669, 10080, ...), and some systems give out
// ports from a low range: on this PC it is 1024-15000, so about one run in twenty got a port fetch
// won't call and a whole test file died with "fetch failed: bad port". Binding port 0 now picks a
// port fetch accepts. A server with a port of its own (the app itself) is not touched.
import net from "node:net";

// The part of the list above 1023 (the system never hands out the rest).
const BAD_PORTS = new Set([1719, 1720, 1723, 2049, 3659, 4045, 4190, 5060, 5061, 6000, 6566, 6665, 6666, 6667, 6668, 6669, 6679, 6697, 10080]);

const listen = net.Server.prototype.listen;

// A free port from the system that is not on the list: bind port 0 and let go until one comes up.
async function allowedPort() {
  for (;;) {
    const probe = net.createServer();
    await new Promise((resolve, reject) => {
      probe.once("error", reject);
      listen.call(probe, 0, resolve);
    });
    const { port } = probe.address();
    await new Promise((resolve) => probe.close(resolve));
    if (!BAD_PORTS.has(port)) return port;
  }
}

net.Server.prototype.listen = function (...args) {
  const first = args[0];
  const options = first && typeof first === "object" ? first : null;
  if ((options ? options.port : first) !== 0) return listen.apply(this, args);
  allowedPort().then(
    (port) => {
      args[0] = options ? { ...options, port } : port;
      listen.apply(this, args);
    },
    (err) => this.emit("error", err)
  );
  return this;
};
