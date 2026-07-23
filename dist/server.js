"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// server.ts
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const downloadRoutes_1 = __importDefault(require("./routes/downloadRoutes"));
const downloadApiRoutes_1 = __importDefault(require("./routes/downloadApiRoutes")); // <--- ВОТ ЭТА СТРОКА
const chalk_1 = __importDefault(require("chalk"));
const app = (0, express_1.default)();
const PORT = 3000;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Мидлвара для логгирования
app.use((req, res, next) => {
    req.log = console;
    next();
});
app.use('/download', downloadRoutes_1.default);
app.use('/api/download', downloadApiRoutes_1.default);
app.listen(PORT, () => {
    console.log(`🚀 Pinterest API Server запущен на http://localhost:${PORT}`);
    console.log(chalk_1.default.blue.underline(`👉 GET http://localhost:${PORT}/download?type=video&url=<PIN_URL>`));
    console.log(chalk_1.default.blue.underline(`👉 GET API http://localhost:${PORT}/api/download?type=video&url=<PIN_URL>`));
});
