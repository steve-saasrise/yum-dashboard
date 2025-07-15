import '@testing-library/jest-dom';

// Polyfill for Next.js Request/Response objects
import { TextEncoder, TextDecoder } from 'util';

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Mock Supabase
jest.mock('@/lib/supabase', () => ({
  createClientComponentClient: jest.fn(() => ({
    auth: {
      getSession: jest.fn(() => Promise.resolve({ data: { session: null } })),
      getUser: jest.fn(() => Promise.resolve({ data: { user: null } })),
      onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
      signOut: jest.fn(() => Promise.resolve({ error: null })),
    },
    from: jest.fn(() => ({
      select: jest.fn(() => Promise.resolve({ data: [], error: null })),
      insert: jest.fn(() => Promise.resolve({ data: [], error: null })),
      update: jest.fn(() => Promise.resolve({ data: [], error: null })),
      delete: jest.fn(() => Promise.resolve({ data: [], error: null })),
    })),
  })),
  createServerComponentClient: jest.fn(() => ({
    auth: {
      getSession: jest.fn(() => Promise.resolve({ data: { session: null } })),
    },
  })),
}));

// Mock NextResponse for testing
jest.mock('next/server', () => ({
  NextRequest: class NextRequest {
    constructor(input, init) {
      Object.defineProperty(this, 'url', {
        value: typeof input === 'string' ? input : input.url,
        writable: false,
        enumerable: true,
        configurable: true
      });
      this.method = init?.method || 'GET';
      this.headers = new Map(Object.entries(init?.headers || {}));
      this.body = init?.body;
    }

    async json() {
      return this.body ? JSON.parse(this.body) : {};
    }
  },
  NextResponse: {
    json: (body, init) => ({
      json: async () => body,
      status: init?.status || 200,
      headers: init?.headers || {},
    }),
  },
}));

// Mock Next.js Request/Response if not available
if (typeof global.Request === 'undefined') {
  global.Request = class Request {
    constructor(input, init) {
      Object.defineProperty(this, 'url', {
        value: typeof input === 'string' ? input : input.url,
        writable: false,
        enumerable: true,
        configurable: true
      });
      this.method = init?.method || 'GET';
      this.headers = new Map(Object.entries(init?.headers || {}));
      this.body = init?.body;
    }

    async json() {
      return this.body ? JSON.parse(this.body) : {};
    }
  };
}

if (typeof global.Response === 'undefined') {
  global.Response = class Response {
    constructor(body, init) {
      this.body = body;
      this.status = init?.status || 200;
      this.headers = new Map(Object.entries(init?.headers || {}));
    }

    async json() {
      return typeof this.body === 'string' ? JSON.parse(this.body) : this.body;
    }

    static json(body, init) {
      return new Response(JSON.stringify(body), {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          ...init?.headers,
        },
      });
    }
  };
}

// Mock URL if not available (for Node.js < 18)
if (typeof global.URL === 'undefined') {
  global.URL = require('url').URL;
}
