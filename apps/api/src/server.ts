import app from './app';
import { env } from './config/env';

const PORT = env.port;

app.listen(PORT, () => {
  console.log(`🚀 Servidor AutoGest API rodando na porta ${PORT} [${env.nodeEnv}]`);
});
