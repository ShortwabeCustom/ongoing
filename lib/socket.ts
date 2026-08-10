import { Server as SocketIOServer } from 'socket.io';
import { createServer, Server as HTTPServer } from 'http';
import { RealtimeService } from './services/realtime';

let httpServer: HTTPServer | null = null;
let io: SocketIOServer | null = null;

export function initializeSocketServer(server?: HTTPServer): SocketIOServer {
  if (io) {
    return io;
  }

  if (!server) {
    server = createServer();
    httpServer = server;
  }

  io = new SocketIOServer(server, {
    cors: {
      origin: process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    pingInterval: 25000,
    pingTimeout: 60000,
  });

  // Use Redis adapter if available
  if (process.env.REDIS_URL) {
    try {
      const { createAdapter } = require('@socket.io/redis-adapter');
      const { createClient } = require('redis');

      const pubClient = createClient({ url: process.env.REDIS_URL });
      const subClient = pubClient.duplicate();

      Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
        io?.adapter(createAdapter(pubClient, subClient));
        console.log('✓ Socket.io Redis adapter connected');
      });
    } catch (error) {
      console.warn('Redis adapter not available, using default adapter:', error);
    }
  }

  // Initialize realtime service
  RealtimeService.initialize(server);

  console.log('✓ Socket.io server initialized on port 3001');

  return io;
}

export function getIO(): SocketIOServer | null {
  return io;
}

export function closeSocketServer() {
  if (httpServer) {
    httpServer.close();
    httpServer = null;
  }
  io = null;
}
