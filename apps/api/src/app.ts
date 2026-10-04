import express from 'express';
import cors from 'cors';
import routes from './routes';
import { requestLogger } from './middlewares/requestLogger';
import { errorHandler } from './middlewares/errorHandler';

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(requestLogger);

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'OK', service: 'AutoGest API', timestamp: new Date() });
});

app.use('/api/v1', routes);

// Middleware global de tratamento de erros ao final da cadeia
app.use(errorHandler);

export default app;
