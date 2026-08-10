import { hash } = require("@node-rs/argon2");
import { prisma } from "@/lib/prisma";
import { generateIdFromEntropySize } from "lucia";

async function createUser() {
  try {
    const password = "Torrax@2024Admin!";
    console.log("📧 Email: alexis.pro_sk8@hotmail.com");
    console.log("🔐 Contraseña: " + password);
    console.log("\n⏳ Hasheando contraseña...");

    const passwordHash = await hash(password, {
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });

    console.log("✓ Contraseña hasheada");

    const userId = generateIdFromEntropySize(16);
    const user = await prisma.user.create({
      data: {
        id: userId,
        email: "alexis.pro_sk8@hotmail.com",
        name: "Alexis",
        passwordHash: passwordHash,
        role: "OWNER",
        emailVerified: true,
      },
    });

    console.log("\n✅ Usuario creado exitosamente:");
    console.log(`  ID: ${user.id}`);
    console.log(`  Email: ${user.email}`);
    console.log(`  Nombre: ${user.name}`);
    console.log(`  Rol: ${user.role}`);
    console.log(`  Email verificado: ${user.emailVerified}`);

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

createUser();
