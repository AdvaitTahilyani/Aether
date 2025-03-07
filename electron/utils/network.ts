import http from "http";

/**
 * Finds an available port starting from the specified port number.
 * @param startPort The port number to start searching from
 * @returns A promise that resolves to an available port number
 */
export const findAvailablePort = async (startPort: number): Promise<number> => {
  return new Promise((resolve) => {
    const server = http.createServer();
    server.on("error", () => {
      // Port is in use, try the next one
      resolve(findAvailablePort(startPort + 1));
    });
    server.listen(startPort, () => {
      server.close(() => {
        resolve(startPort);
      });
    });
  });
};
