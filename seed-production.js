const { randomBytes, scryptSync } = require('crypto');
const mongoose = require('mongoose');

function hashPassword(plain) {
  const salt = randomBytes(16).toString('base64url');
  const derived = scryptSync(String(plain), salt, 32).toString('base64url');
  return `scrypt$${salt}$${derived}`;
}

async function seed() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI no esta definido en las variables de entorno');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('Conectado a MongoDB');

  const db = mongoose.connection.db;
  const users = db.collection('users');

  await users.createIndex({ correo: 1 }, { unique: true, name: 'uniq_users_correo' });
  await users.createIndex(
    { numeroDocumento: 1 },
    { unique: true, sparse: true, name: 'uniq_users_numeroDocumento' },
  );

  const now = new Date();

  const adminEmail = process.env.ADMIN_EMAIL || 'admin@miuniclaretiana.edu.co';
  const adminPassword = process.env.ADMIN_PASSWORD;
  const docenteEmail = process.env.DOCENTE_EMAIL || 'docente@miuniclaretiana.edu.co';
  const docentePassword = process.env.DOCENTE_PASSWORD;

  if (adminPassword) {
    const hashed = hashPassword(adminPassword);
    await users.updateOne(
      { correo: adminEmail },
      {
        $setOnInsert: {
          nombreCompleto: 'Administrador Sistema',
          tipoDocumento: 'CC',
          numeroDocumento: '1000000000',
          correo: adminEmail,
          hashContrasena: hashed,
          rol: 'admin',
          bloqueado: false,
          createdAt: now,
        },
        $set: { updatedAt: now },
      },
      { upsert: true },
    );
    console.log(`Admin creado/actualizado: ${adminEmail}`);
  } else {
    console.log('ADMIN_PASSWORD no definido. Saltando creacion de admin.');
  }

  if (docentePassword) {
    const hashed = hashPassword(docentePassword);
    await users.updateOne(
      { correo: docenteEmail },
      {
        $setOnInsert: {
          nombreCompleto: 'Docente',
          tipoDocumento: 'CC',
          numeroDocumento: '2000000001',
          correo: docenteEmail,
          hashContrasena: hashed,
          rol: 'docente',
          programa: 'Facultad de Ingenieria',
          bloqueado: false,
          createdAt: now,
        },
        $set: { updatedAt: now },
      },
      { upsert: true },
    );
    console.log(`Docente creado/actualizado: ${docenteEmail}`);
  } else {
    console.log('DOCENTE_PASSWORD no definido. Saltando creacion de docente.');
  }

  const count = await users.countDocuments();
  console.log(`Total usuarios en BD: ${count}`);

  await mongoose.disconnect();
  console.log('Seed completado.');
}

seed().catch((err) => {
  console.error('Error en seed:', err);
  process.exit(1);
});
