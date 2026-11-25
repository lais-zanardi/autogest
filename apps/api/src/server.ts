import app from './app';
import { env } from './config/env';
import { agendarJobColetaPrecosAnp } from './jobs/coletaPrecosAnpJob';
import { agendarJobResumoMensalEmail } from './jobs/resumoMensalEmailJob';

const PORT = env.port;

app.listen(PORT, () => {
  console.log(`🚀 Servidor AutoGest API rodando na porta ${PORT} [${env.nodeEnv}]`);
  if (env.nodeEnv !== 'test') {
    agendarJobColetaPrecosAnp();
    agendarJobResumoMensalEmail();
  }
});
