const { listen } = require("../scripts/serve.cjs");

module.exports = async function startServer(config) {
  const url = new URL(config.projects[0].use.baseURL);
  const server = await listen(Number(url.port));
  return () => new Promise(resolve => {
    server.close(resolve);
    server.closeAllConnections();
  });
};
