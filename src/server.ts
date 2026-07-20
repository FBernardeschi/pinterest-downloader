// server.ts
import express, { Request } from 'express';
import cors from 'cors';
import downloadRoutes from './routes/downloadRoutes';

// Расширяем тип Request для TypeScript
declare module 'express-serve-static-core' {
  interface Request {
    log?: Console;
  }
}

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Мидлвара для логгирования
app.use((req, res, next) => {
  req.log = console;
  next();
});

app.use('/api/download', downloadRoutes);

app.listen(PORT, () => {
  console.log(`🚀 Pinterest API Server запущен на http://localhost:${PORT}`);
  console.log(`👉 GET http://localhost:${PORT}/api/download?url=<PIN_URL>&type=video`);
});