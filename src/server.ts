// server.ts
import express, { Request } from 'express';
import cors from 'cors';
import downloadRoutes from './routes/downloadRoutes';
import downloadApiRoutes from './routes/downloadApiRoutes'; // <--- ВОТ ЭТА СТРОКА
import chalk from 'chalk';

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

app.use('/download', downloadRoutes);
app.use('/api/download', downloadApiRoutes);

app.listen(PORT, () => {
  console.log(`🚀 Pinterest API Server запущен на http://localhost:${PORT}`);
  console.log(chalk.blue.underline(`👉 GET http://localhost:${PORT}/download?type=video&url=<PIN_URL>`));
  console.log(chalk.blue.underline(`👉 GET API http://localhost:${PORT}/api/download?type=video&url=<PIN_URL>`));
});