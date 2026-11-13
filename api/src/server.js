import { app } from './app.js';

// Servidor HTTP para desarrollo local (npm run dev) y pruebas.
const port = Number(process.env.PORT) || 8080;
app.listen(port, () => console.log(`CheckHome API escuchando en ${port}`));
