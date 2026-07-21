"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// server.ts
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const downloadRoutes_1 = __importDefault(require("./routes/downloadRoutes"));
const app = (0, express_1.default)();
const PORT = 3000;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Мидлвара для логгирования
app.use((req, res, next) => {
    req.log = console;
    next();
});
app.use('/api/download', downloadRoutes_1.default);
app.listen(PORT, () => {
    console.log(`🚀 Pinterest API Server запущен на http://localhost:${PORT}`);
    console.log(`👉 GET http://localhost:${PORT}/api/download?url=<PIN_URL>&type=video`);
});
