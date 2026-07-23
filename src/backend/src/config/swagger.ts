import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'HEIMAT 2.0 API',
      version: '1.0.0',
      description: 'Open-Source Super App für Deutschland — ÖPNV, Finanzen, Gesundheit',
      contact: {
        name: 'HEIMAT Team',
        url: 'https://github.com/abatn/HEIMAT',
      },
      license: {
        name: 'AGPL-3.0',
        url: 'https://www.gnu.org/licenses/agpl-3.0.html',
      },
    },
    servers: [
      { url: 'https://heimat-backend.onrender.com', description: 'Production' },
      { url: 'http://localhost:3000', description: 'Local' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string', format: 'email' },
            display_name: { type: 'string' },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        AuthResponse: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'ok' },
            accessToken: { type: 'string', description: 'JWT Token' },
            user: { $ref: '#/components/schemas/User' },
          },
        },
        Stop: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            latitude: { type: 'number' },
            longitude: { type: 'number' },
            stop_type: { type: 'string', enum: ['bus', 'tram', 'subway', 'train'] },
          },
        },
        Doctor: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            specialty: { type: 'string' },
            address: { type: 'string' },
            phone: { type: 'string' },
            source: { type: 'string', enum: ['db', 'osm'] },
          },
        },
        Transaction: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            amount: { type: 'number' },
            currency: { type: 'string' },
            status: { type: 'string' },
            description: { type: 'string' },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ['./src/routes/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
